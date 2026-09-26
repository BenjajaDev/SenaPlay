import { AlertTriangle, BarChart3, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useRepositories } from '@/data/RepositoriesProvider';
import { mergeRemoteConfig } from '@/lib/domain';
import { formatCount, STAT_ITEMS } from '@/lib/site';
import { useResource } from '@/lib/useResource';
import { Button, Card, EmptyState, PageHeader, Skeleton, StatTile } from '@/ui';

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
