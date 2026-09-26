import { AlertTriangle, BarChart3, CheckCircle2, RefreshCw, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useRepositories } from '@/data/RepositoriesProvider';
import { mergeRemoteConfig } from '@/lib/domain';
import { formatCount, STAT_ITEMS } from '@/lib/site';
import { useResource } from '@/lib/useResource';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton, SkeletonRows, StatTile } from '@/ui';

const EXERCISE_LABELS: Record<string, string> = {
  matching: 'Emparejar',
  'multiple-choice': 'Elegir letra',
  ordering: 'Ordenar',
  typing: 'Escribir',
  recognition: 'Reconocer',
  'build-word': 'Construir palabra',
  'interpret-signs': 'Interpretar señas',
  'word-meaning': 'Significado',
  'true-false': 'Verdadero o falso',
};

/**
 * Ejercicios donde más se equivocan los usuarios de la app (últimos 30
 * días). Ayuda a detectar ejercicios confusos o señas que conviene reforzar.
 */
function MistakesCard() {
  const { stats } = useRepositories();
  const mistakes = useResource(() => stats.mistakeStats(10, 30), [stats]);

  return (
    <Card variant="raised" className="stack" style={{ marginTop: 20 }}>
      <div className="row-between">
        <div className="stack-sm" style={{ gap: 2 }}>
          <h2 style={{ fontSize: 18 }}>Ejercicios con más errores</h2>
          <span className="text-small text-secondary">Últimos 30 días · incluye cuántas veces dejaron a alguien sin vidas</span>
        </div>
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={mistakes.reload} aria-label="Actualizar errores frecuentes" />
      </div>
      {mistakes.loading ? (
        <SkeletonRows rows={3} label="Cargando errores frecuentes" />
      ) : mistakes.error ? (
        <EmptyState icon={AlertTriangle} title="No se pudieron cargar" message={mistakes.error} action={<Button onClick={mistakes.reload}>Reintentar</Button>} />
      ) : !mistakes.data?.length ? (
        <EmptyState icon={CheckCircle2} title="Sin errores registrados" message="Cuando los usuarios fallen ejercicios en la app, aparecerán aquí." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Nivel</th>
                <th scope="col">Ejercicio</th>
                <th scope="col">Errores</th>
                <th scope="col">Personas</th>
                <th scope="col">Sin vidas</th>
                <th scope="col">Respuesta más común</th>
              </tr>
            </thead>
            <tbody>
              {mistakes.data.map((row) => (
                <tr key={`${row.level_id}-${row.exercise_key}`}>
                  <td>
                    <Link to={`/admin/levels/${row.level_id}`}>Nivel {row.level_id}</Link>
                  </td>
                  <td>
                    <div className="stack-sm" style={{ gap: 2 }}>
                      <strong>{row.exercise_title || EXERCISE_LABELS[row.exercise_type] || row.exercise_type}</strong>
                      <span className="text-small text-secondary">
                        {EXERCISE_LABELS[row.exercise_type] || row.exercise_type}
                        {row.sign ? ` · seña «${row.sign.toLocaleUpperCase('es')}»` : ''}
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong>{formatCount(row.mistakes)}</strong>
                  </td>
                  <td>{formatCount(row.people)}</td>
                  <td>{row.game_overs ? <Badge tone="warning">{formatCount(row.game_overs)}</Badge> : '–'}</td>
                  <td>{row.top_answer ? `«${row.top_answer}»` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Resumen del panel: métricas de contenido y estado de la app móvil. */
export function DashboardPage() {
  const { stats, config } = useRepositories();
  const auth = useAuth();
  const summary = useResource(() => stats.publicStats(), [stats]);
  const remote = useResource(async () => (auth.isAdmin ? mergeRemoteConfig(await config.getConfig()) : null), [auth.isAdmin]);

  const data = summary.data;
  const maintenance = remote.data?.maintenance?.enabled;

  return (
    <>
      <PageHeader title="Resumen" subtitle="Estado del contenido y de la app móvil" />
      {summary.loading ? (
        <div className="grid-3" role="status" aria-label="Cargando métricas">
          {STAT_ITEMS.map((item) => (
            <Skeleton key={item.key} height={76} radius={14} />
          ))}
        </div>
      ) : !data ? (
        // publicStats devuelve null si el RPC falla (p. ej. falta aplicar la migración 005).
        <Card>
          <EmptyState
            icon={BarChart3}
            title="No se pudieron cargar las métricas"
            message="Revisa la conexión o que la función public_stats exista en Supabase."
            action={<Button onClick={summary.reload}>Reintentar</Button>}
          />
        </Card>
      ) : (
        <div className="grid-3 stagger">
          {STAT_ITEMS.map(({ key, label, icon, tone, to, adminOnly }) => {
            const tile = <StatTile icon={icon} label={label} value={formatCount(data[key])} tone={tone} />;
            // Editores no ven la página de usuarios: su cifra se muestra sin enlace.
            return adminOnly && !auth.isAdmin ? (
              <div key={key}>{tile}</div>
            ) : (
              <Link key={key} to={to} className="stat-link" aria-label={`${label}: ${formatCount(data[key])}. Ir a gestionar`}>
                {tile}
              </Link>
            );
          })}
        </div>
      )}

      <MistakesCard />

      {auth.isAdmin && remote.data ? (
        <Card variant="raised" style={{ marginTop: 20 }}>
          <div className="row-between">
            <div className="row">
              {maintenance ? <AlertTriangle color="var(--color-warning-text)" aria-hidden /> : <Wrench color="var(--color-success-text)" aria-hidden />}
              <div>
                <strong>{maintenance ? 'La app está en modo mantenimiento' : 'La app está operativa'}</strong>
                <div className="text-small text-secondary">
                  Versión mínima {remote.data.appVersion.minimum} · Vidas en modo «{remote.data.lives.mode === 'pool' ? 'pool con recarga' : 'por nivel'}»
                </div>
              </div>
            </div>
            <Link className="btn btn--secondary btn--sm" to="/admin/config">
              Configurar
            </Link>
          </div>
        </Card>
      ) : null}
    </>
  );
}
