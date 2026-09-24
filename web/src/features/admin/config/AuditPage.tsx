import { History } from 'lucide-react';
import { useRepositories } from '@/data/RepositoriesProvider';
import { useResource } from '@/lib/useResource';
import { Badge, Button, EmptyState, PageHeader, SkeletonRows } from '@/ui';

const ACTION_TONE = { INSERT: 'success', UPDATE: 'info', DELETE: 'danger' } as const;
const ACTION_LABEL = { INSERT: 'Creado', UPDATE: 'Modificado', DELETE: 'Eliminado' } as const;

function valueOf(entry: unknown) {
  if (!entry || typeof entry !== 'object') return '';
  const record = entry as Record<string, unknown>;
  return JSON.stringify('value' in record ? record.value : { enabled: record.enabled, rollout: record.rollout_percentage });
}

/** Historial de cambios de configuración (tabla config_audit, llenada por trigger). */
export function AuditPage() {
  const { config } = useRepositories();
  const audit = useResource(() => config.listAudit(100), [config]);

  return (
    <>
      <PageHeader title="Historial de cambios" subtitle="Quién cambió la configuración remota y cuándo" actions={<Button variant="secondary" onClick={audit.reload}>Actualizar</Button>} />
      {audit.loading ? (
        <SkeletonRows rows={5} label="Cargando historial" />
      ) : !audit.data?.length ? (
        <EmptyState icon={History} title="Sin cambios registrados" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Elemento</th>
                <th scope="col">Acción</th>
                <th scope="col">Antes</th>
                <th scope="col">Después</th>
              </tr>
            </thead>
            <tbody>
              {audit.data.map((entry) => {
                const action = entry.action as keyof typeof ACTION_TONE;
                return (
                  <tr key={entry.id}>
                    <td className="text-small">{new Date(entry.changed_at).toLocaleString('es-CL')}</td>
                    <td>
                      <code>{entry.record_key}</code>
                      <div className="text-small text-muted">{entry.table_name === 'feature_flags' ? 'Flag' : 'Configuración'}</div>
                    </td>
                    <td>
                      <Badge tone={ACTION_TONE[action] || 'neutral'}>{ACTION_LABEL[action] || entry.action}</Badge>
                    </td>
                    <td className="text-small text-secondary" style={{ maxWidth: 260, wordBreak: 'break-word' }}>
                      {valueOf(entry.old_value)}
                    </td>
                    <td className="text-small" style={{ maxWidth: 260, wordBreak: 'break-word' }}>
                      {valueOf(entry.new_value)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
