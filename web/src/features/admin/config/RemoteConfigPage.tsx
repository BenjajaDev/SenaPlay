import { Heart, Megaphone, Plus, Save, Sliders, Smartphone, Trash2, Trophy, Wrench } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useRepositories } from '@/data/RepositoriesProvider';
import { compareVersions, mergeRemoteConfig, type Announcement, type RemoteConfigShape } from '@/lib/domain';
import { useResource } from '@/lib/useResource';
import { Badge, Button, Card, EmptyState, PageHeader, SelectField, SkeletonRows, Switch, TextArea, TextField, useFeedback } from '@/ui';

type Section = keyof RemoteConfigShape;

function SectionCard({ icon, title, subtitle, dirty, onSave, children }: { icon: ReactNode; title: string; subtitle: string; dirty: boolean; onSave: () => void; children: ReactNode }) {
  return (
    <Card variant="raised" className="stack">
      <div className="row-between">
        <div className="row">
          {icon}
          <div>
            <h2 style={{ fontSize: 18 }}>{title}</h2>
            <p className="text-small text-secondary">{subtitle}</p>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {dirty ? <Badge tone="warning">Sin publicar</Badge> : null}
          <Button icon={Save} size="sm" disabled={!dirty} onClick={onSave}>
            Publicar
          </Button>
        </div>
      </div>
      {children}
    </Card>
  );
}

const toLocalInput = (iso?: string) => (iso ? iso.slice(0, 16) : '');
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : undefined);

/**
 * Configuración remota de la app móvil (solo administradores). Cada sección
 * se publica por separado, con confirmación que muestra el valor nuevo; la
 * app aplica los cambios en su próximo refresco (al abrirse o volver a primer
 * plano) sin publicar una versión nueva.
 */
export function RemoteConfigPage() {
  const { config } = useRepositories();
  const { confirm, notify } = useFeedback();
  const remote = useResource(async () => mergeRemoteConfig(await config.getConfig()), [config]);
  const [draft, setDraft] = useState<RemoteConfigShape | null>(null);

  useEffect(() => {
    if (remote.data) setDraft(structuredClone(remote.data));
  }, [remote.data]);

  if (remote.loading || !draft) return <SkeletonRows rows={4} label="Cargando configuración" />;
  if (remote.error) return <EmptyState icon={Wrench} title="No se pudo cargar" message={remote.error} action={<Button onClick={remote.reload}>Reintentar</Button>} />;

  const saved = remote.data as RemoteConfigShape;
  const isDirty = (key: Section) => JSON.stringify(draft[key]) !== JSON.stringify(saved[key]);
  const patch = <K extends Section>(key: K, value: Partial<RemoteConfigShape[K]> | RemoteConfigShape[K]) =>
    setDraft((prev) => (prev ? { ...prev, [key]: Array.isArray(value) ? value : { ...(prev[key] as object), ...(value as object) } } : prev));

  const publish = async (key: Section, label: string, extraWarning?: string) => {
    try {
      const done = await confirm({
        title: `¿Publicar «${label}»?`,
        message: (
          <div className="stack-sm" style={{ textAlign: 'left' }}>
            {extraWarning ? <strong className="text-danger">{extraWarning}</strong> : null}
            <span>Todos los usuarios de la app recibirán este valor:</span>
            <pre className="json-preview">{JSON.stringify(draft[key], null, 2)}</pre>
          </div>
        ),
        tone: extraWarning ? 'danger' : 'warning',
        confirmLabel: 'Publicar',
        onConfirm: () => config.setConfig(key, draft[key]),
      });
      if (done) {
        notify({ tone: 'success', title: 'Configuración publicada', message: `${label} actualizado.` });
        remote.reload();
      }
    } catch (error) {
      notify({ tone: 'danger', title: 'No se pudo publicar', message: (error as Error).message });
    }
  };

  const versionError =
    compareVersions(draft.appVersion.minimum || '0', draft.appVersion.recommended || '0') > 0 ? 'La mínima no puede ser mayor que la recomendada.' : null;

  const updateAnnouncement = (index: number, value: Partial<Announcement>) =>
    patch('announcements', draft.announcements.map((item, i) => (i === index ? { ...item, ...value } : item)) as Announcement[]);

  return (
    <>
      <PageHeader title="Configuración remota" subtitle="Ajusta la app móvil sin publicar una versión nueva" />
      <div className="stack">
        <SectionCard
          icon={<Wrench aria-hidden color="var(--color-warning-text)" />}
          title="Modo mantenimiento"
          subtitle="Bloquea la app con un aviso. Los administradores pueden seguir entrando."
          dirty={isDirty('maintenance')}
          onSave={() => publish('maintenance', 'Modo mantenimiento', draft.maintenance.enabled ? 'Esto BLOQUEARÁ la app para todos los usuarios.' : undefined)}
        >
          <Switch label="Activar mantenimiento" checked={draft.maintenance.enabled} onChange={(enabled) => patch('maintenance', { enabled })} />
          <div className="grid-2">
            <TextField label="Título" value={draft.maintenance.title} onChange={(e) => patch('maintenance', { title: e.target.value })} />
            <TextArea label="Mensaje" rows={2} value={draft.maintenance.message} onChange={(e) => patch('maintenance', { message: e.target.value })} />
          </div>
        </SectionCard>

        <SectionCard
          icon={<Megaphone aria-hidden color="var(--color-info-text)" />}
          title="Avisos globales y eventos"
          subtitle="Banner en la parte superior de la app, con fechas de inicio y fin."
          dirty={isDirty('announcements')}
          onSave={() => publish('announcements', 'Avisos globales')}
        >
          {draft.announcements.length === 0 ? <p className="text-secondary">No hay avisos.</p> : null}
          {draft.announcements.map((item, index) => (
            <Card key={item.id} className="stack-sm">
              <div className="grid-2">
                <TextField label="Título" value={item.title || ''} onChange={(e) => updateAnnouncement(index, { title: e.target.value })} />
                <SelectField
                  label="Tono"
                  value={item.tone || 'info'}
                  onChange={(e) => updateAnnouncement(index, { tone: e.target.value as Announcement['tone'] })}
                  options={[{ value: 'info', label: 'Información' }, { value: 'success', label: 'Novedad' }, { value: 'warning', label: 'Advertencia' }, { value: 'danger', label: 'Urgente' }]}
                />
                <TextField label="Desde" type="datetime-local" value={toLocalInput(item.startsAt)} onChange={(e) => updateAnnouncement(index, { startsAt: fromLocalInput(e.target.value) })} />
                <TextField label="Hasta" type="datetime-local" value={toLocalInput(item.endsAt)} onChange={(e) => updateAnnouncement(index, { endsAt: fromLocalInput(e.target.value) })} />
              </div>
              <TextArea label="Mensaje" rows={2} value={item.message || ''} onChange={(e) => updateAnnouncement(index, { message: e.target.value })} />
              <div className="row-between">
                <Switch label="El usuario puede descartarlo" checked={item.dismissible !== false} onChange={(dismissible) => updateAnnouncement(index, { dismissible })} />
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => patch('announcements', draft.announcements.filter((_, i) => i !== index) as Announcement[])}>
                  Quitar
                </Button>
              </div>
            </Card>
          ))}
          <div>
            <Button
              variant="secondary"
              icon={Plus}
              onClick={() => patch('announcements', [...draft.announcements, { id: crypto.randomUUID(), title: '', message: '', tone: 'info', dismissible: true }] as Announcement[])}
            >
              Agregar aviso
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          icon={<Heart aria-hidden color="var(--color-danger)" />}
          title="Vidas y recarga"
          subtitle="Por nivel (cada nivel empieza lleno) o pool global que se recarga con el tiempo."
          dirty={isDirty('lives')}
          onSave={() => publish('lives', 'Vidas y recarga')}
        >
          <div className="grid-3">
            <SelectField
              label="Modo"
              value={draft.lives.mode}
              onChange={(e) => patch('lives', { mode: e.target.value as 'session' | 'pool' })}
              options={[{ value: 'session', label: 'Por nivel' }, { value: 'pool', label: 'Pool con recarga' }]}
            />
            <TextField label="Vidas máximas" type="number" min={1} max={10} value={draft.lives.maxLives} onChange={(e) => patch('lives', { maxLives: Number(e.target.value) })} />
            <TextField
              label="Minutos por vida"
              type="number"
              min={1}
              disabled={draft.lives.mode !== 'pool'}
              value={draft.lives.refillMinutes}
              onChange={(e) => patch('lives', { refillMinutes: Number(e.target.value) })}
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={<Trophy aria-hidden color="var(--color-gold)" />}
          title="Puntaje y penalizaciones"
          subtitle="Cómo se calcula el puntaje de cada nivel y cuántas estrellas otorga."
          dirty={isDirty('scoring')}
          onSave={() => publish('scoring', 'Puntaje')}
        >
          <div className="grid-3">
            <TextField label="Puntos por acierto" type="number" value={draft.scoring.hitPoints} onChange={(e) => patch('scoring', { hitPoints: Number(e.target.value) })} />
            <TextField label="Penalización por error" type="number" value={draft.scoring.failPenalty} onChange={(e) => patch('scoring', { failPenalty: Number(e.target.value) })} />
            <TextField label="Bono por vida restante" type="number" value={draft.scoring.lifeBonus} onChange={(e) => patch('scoring', { lifeBonus: Number(e.target.value) })} />
            <TextField label="Penalización por pista" type="number" value={draft.scoring.hintPenalty} onChange={(e) => patch('scoring', { hintPenalty: Number(e.target.value) })} />
            <TextField
              label="Umbrales de estrellas"
              hint="Fracción del máximo, separadas por coma (ej: 0.4, 0.7, 0.9)"
              value={draft.scoring.starThresholds.join(', ')}
              onChange={(e) => patch('scoring', { starThresholds: e.target.value.split(',').map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v)) })}
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={<Sliders aria-hidden color="var(--color-primary)" />}
          title="Dificultad"
          subtitle="Tiempos de los juegos y exigencia del reconocimiento con IA."
          dirty={isDirty('difficulty')}
          onSave={() => publish('difficulty', 'Dificultad')}
        >
          <div className="grid-3">
            <TextField label="Segundos por pregunta (quiz)" type="number" min={3} value={draft.difficulty.quizSecondsPerQuestion} onChange={(e) => patch('difficulty', { quizSecondsPerQuestion: Number(e.target.value) })} />
            <TextField
              label="Confianza mínima IA (traducción)"
              type="number"
              step={0.05}
              min={0}
              max={1}
              hint="0 a 1. Más alto = más exigente"
              value={draft.difficulty.aiConfidenceThreshold}
              onChange={(e) => patch('difficulty', { aiConfidenceThreshold: Number(e.target.value) })}
            />
            <TextField
              label="Confianza mínima IA (deletreo)"
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={draft.difficulty.spellingConfidenceThreshold}
              onChange={(e) => patch('difficulty', { spellingConfidenceThreshold: Number(e.target.value) })}
            />
          </div>
          <Switch label="Pistas habilitadas" description="Muestra la ampolleta flotante en los niveles." checked={draft.difficulty.hintsEnabled} onChange={(hintsEnabled) => patch('difficulty', { hintsEnabled })} />
        </SectionCard>

        <SectionCard
          icon={<Smartphone aria-hidden color="var(--color-info-text)" />}
          title="Versionado"
          subtitle="Versión mínima (bloquea y pide actualizar) y recomendada (muestra un aviso)."
          dirty={isDirty('appVersion')}
          onSave={() => (versionError ? notify({ tone: 'warning', message: versionError }) : publish('appVersion', 'Versionado', 'Las apps con versión menor a la mínima quedarán bloqueadas.'))}
        >
          <div className="grid-3">
            <TextField label="Versión mínima" placeholder="1.0.0" value={draft.appVersion.minimum} error={versionError} onChange={(e) => patch('appVersion', { minimum: e.target.value.trim() })} />
            <TextField label="Versión recomendada" placeholder="1.2.0" value={draft.appVersion.recommended} onChange={(e) => patch('appVersion', { recommended: e.target.value.trim() })} />
            <TextField label="Enlace a la tienda" placeholder="https://play.google.com/…" value={draft.appVersion.storeUrl} onChange={(e) => patch('appVersion', { storeUrl: e.target.value.trim() })} />
          </div>
        </SectionCard>
      </div>
    </>
  );
}
