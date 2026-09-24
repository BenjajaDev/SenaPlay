import { Flag, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRepositories } from '@/data/RepositoriesProvider';
import type { FeatureFlag } from '@/data/types';
import { useResource } from '@/lib/useResource';
import { Badge, Button, Card, Dialog, EmptyState, PageHeader, SkeletonRows, Switch, TextField, useFeedback } from '@/ui';

const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 16) : '');
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);
const KEY_RE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/;

function flagStatus(flag: FeatureFlag): { label: string; tone: 'success' | 'warning' | 'neutral' | 'info' } {
  if (!flag.enabled) return { label: 'Apagado', tone: 'neutral' };
  const now = Date.now();
  if (flag.starts_at && now < new Date(flag.starts_at).getTime()) return { label: 'Programado', tone: 'info' };
  if (flag.ends_at && now > new Date(flag.ends_at).getTime()) return { label: 'Finalizado', tone: 'neutral' };
  if (flag.rollout_percentage < 100) return { label: `Activo ${flag.rollout_percentage}%`, tone: 'warning' };
  return { label: 'Activo', tone: 'success' };
}

/**
 * Módulos experimentales y eventos temporales (feature flags). Cada flag se
 * puede encender para un porcentaje de usuarios (rollout gradual y estable) y
 * dentro de una ventana de fechas (eventos). Los cambios piden confirmación.
 */
export function FeatureFlagsPage() {
  const { config } = useRepositories();
  const { confirm, notify } = useFeedback();
  const flags = useResource(() => config.listFlags(), [config]);
  const [drafts, setDrafts] = useState<Record<string, FeatureFlag>>({});
  const [creating, setCreating] = useState<FeatureFlag | null>(null);

  useEffect(() => {
    if (flags.data) setDrafts(Object.fromEntries(flags.data.map((flag) => [flag.key, { ...flag }])));
  }, [flags.data]);

  const original = (key: string) => flags.data?.find((flag) => flag.key === key);
  const dirty = (key: string) => JSON.stringify(drafts[key]) !== JSON.stringify(original(key));
  const patch = (key: string, value: Partial<FeatureFlag>) => setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...value } }));

  const save = async (flag: FeatureFlag, isNew = false) => {
    try {
      const done = await confirm({
        title: isNew ? `¿Crear el flag «${flag.key}»?` : `¿Publicar «${flag.key}»?`,
        message: `${flag.enabled ? `Activo para el ${flag.rollout_percentage}% de los usuarios` : 'Apagado'}${flag.starts_at ? ` desde ${new Date(flag.starts_at).toLocaleString('es-CL')}` : ''}${flag.ends_at ? ` hasta ${new Date(flag.ends_at).toLocaleString('es-CL')}` : ''}.`,
        tone: 'warning',
        confirmLabel: 'Publicar',
        onConfirm: () => config.saveFlag(flag),
      });
      if (done) {
        notify({ tone: 'success', message: 'Flag publicado.' });
        setCreating(null);
        flags.reload();
      }
    } catch (error) {
      notify({ tone: 'danger', message: (error as Error).message });
    }
  };

  const remove = async (flag: FeatureFlag) => {
    try {
      const done = await confirm({
        title: `¿Eliminar «${flag.key}»?`,
        message: 'La app volverá a usar su valor por defecto para este módulo.',
        tone: 'danger',
        confirmLabel: 'Eliminar',
        onConfirm: () => config.deleteFlag(flag.key),
      });
      if (done) {
        notify({ tone: 'success', message: 'Flag eliminado.' });
        flags.reload();
      }
    } catch (error) {
      notify({ tone: 'danger', message: (error as Error).message });
    }
  };

  const newKeyError = creating && !KEY_RE.test(creating.key) ? 'Usa el formato modulo.nombre (ej: events.navidad).' : null;

  return (
    <>
      <PageHeader
        title="Módulos y eventos"
        subtitle="Activa o desactiva funciones de la app, con despliegue gradual y ventanas de fechas"
        actions={
          <Button icon={Plus} onClick={() => setCreating({ key: 'events.', enabled: false, rollout_percentage: 100, starts_at: null, ends_at: null, description: '' })}>
            Nuevo flag
          </Button>
        }
      />
      {flags.loading ? (
        <SkeletonRows rows={5} label="Cargando flags" />
      ) : flags.error ? (
        <EmptyState icon={Flag} title="No se pudieron cargar" message={flags.error} action={<Button onClick={flags.reload}>Reintentar</Button>} />
      ) : (
        <div className="stack stagger">
          {Object.values(drafts).map((flag) => {
            const status = flagStatus(flag);
            return (
              <Card key={flag.key} variant="raised" className="stack-sm">
                <div className="row-between">
                  <div>
                    <code style={{ fontWeight: 700 }}>{flag.key}</code>
                    {flag.description ? <div className="text-small text-secondary">{flag.description}</div> : null}
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {dirty(flag.key) ? <Badge tone="warning">Sin publicar</Badge> : null}
                  </div>
                </div>
                <div className="grid-3" style={{ alignItems: 'end' }}>
                  <Switch label="Activo" checked={flag.enabled} onChange={(enabled) => patch(flag.key, { enabled })} />
                  <label className="field">
                    <span className="field__label">Usuarios alcanzados: {flag.rollout_percentage}%</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={flag.rollout_percentage}
                      onChange={(e) => patch(flag.key, { rollout_percentage: Number(e.target.value) })}
                      aria-valuetext={`${flag.rollout_percentage} por ciento`}
                    />
                  </label>
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                    <Button size="sm" icon={Save} disabled={!dirty(flag.key)} onClick={() => save(flag)}>
                      Publicar
                    </Button>
                    <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Eliminar ${flag.key}`} onClick={() => remove(flag)} />
                  </div>
                  <TextField label="Inicio (opcional)" type="datetime-local" value={toLocalInput(flag.starts_at)} onChange={(e) => patch(flag.key, { starts_at: fromLocalInput(e.target.value) })} />
                  <TextField label="Fin (opcional)" type="datetime-local" value={toLocalInput(flag.ends_at)} onChange={(e) => patch(flag.key, { ends_at: fromLocalInput(e.target.value) })} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={Boolean(creating)}
        wide
        title="Nuevo flag"
        message="Los módulos que la app ya conoce empiezan con games., videos., feedback. o levels.; los eventos nuevos, con events."
        onClose={() => setCreating(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setCreating(null)}>
              Cancelar
            </Button>
            <Button disabled={Boolean(newKeyError)} onClick={() => creating && save(creating, true)}>
              Crear
            </Button>
          </>
        }
      >
        {creating ? (
          <div className="grid-2" style={{ marginBottom: 20 }}>
            <TextField label="Clave *" value={creating.key} error={newKeyError} onChange={(e) => setCreating({ ...creating, key: e.target.value.trim() })} />
            <TextField label="Descripción" value={creating.description || ''} onChange={(e) => setCreating({ ...creating, description: e.target.value })} />
            <Switch label="Activo" checked={creating.enabled} onChange={(enabled) => setCreating({ ...creating, enabled })} />
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
