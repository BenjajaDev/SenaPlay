import { AlertTriangle, BookOpen, CheckCircle2, Film, Layers, Type, Users, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useRepositories } from '@/data/RepositoriesProvider';
import { mergeRemoteConfig } from '@/lib/domain';
import { useResource } from '@/lib/useResource';
import { Card, PageHeader, SkeletonRows, StatTile } from '@/ui';

/** Resumen del panel: métricas de contenido y estado de la app móvil. */
export function DashboardPage() {
  const { stats, config } = useRepositories();
  const auth = useAuth();
  const summary = useResource(() => stats.publicStats(), []);
  const remote = useResource(async () => (auth.isAdmin ? mergeRemoteConfig(await config.getConfig()) : null), [auth.isAdmin]);

  const data = summary.data;
  const maintenance = remote.data?.maintenance?.enabled;

  return (
    <>
      <PageHeader title="Resumen" subtitle="Estado del contenido y de la app móvil" />
      {summary.loading ? (
        <SkeletonRows rows={2} label="Cargando métricas" />
      ) : (
        <div className="grid-3 stagger">
          <StatTile icon={Layers} label="Niveles disponibles" value={data?.levels ?? '–'} />
          <StatTile icon={CheckCircle2} label="Ejercicios" value={data?.exercises ?? '–'} tone="success" />
          <StatTile icon={Type} label="Entradas de diccionario" value={data?.dictionary ?? '–'} tone="info" />
          <StatTile icon={BookOpen} label="Vocabulario" value={data?.vocabulary ?? '–'} tone="warning" />
          <StatTile icon={Film} label="Videos publicados" value={data?.videos ?? '–'} />
          <StatTile icon={Users} label="Usuarios registrados" value={data?.learners ?? '–'} tone="neutral" />
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
