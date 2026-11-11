import { CheckCircle2, Clock, Eye, EyeOff, Film, PencilLine, Plus, RefreshCw, Send, ShieldCheck, Trash2, Upload, XCircle, type LucideIcon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { useRepositories } from '@/data/RepositoriesProvider';
import { MAX_UPLOAD_BYTES, nextVariant } from '@/data/repositories';
import type { SignClip, SignClipStatus } from '@/data/types';
import { MVP_CLIP_CATALOG, MVP_CLIP_LEVEL_LABELS, isValidSignKey, toSignKey } from '@/lib/domain';
import { useResource } from '@/lib/useResource';
import { Badge, Button, Card, Dialog, EmptyState, PageHeader, SkeletonRows, TextArea, TextField, useFeedback, type Tone } from '@/ui';
import { ClipEditor } from './ClipEditor';

const STATUS: Record<SignClipStatus, { label: string; tone: Tone; icon: LucideIcon }> = {
  draft: { label: 'Borrador', tone: 'neutral', icon: PencilLine },
  in_review: { label: 'En revisión', tone: 'info', icon: Clock },
  validated: { label: 'Validada', tone: 'success', icon: ShieldCheck },
  rejected: { label: 'Rechazada', tone: 'danger', icon: XCircle },
};

const ACCEPT = 'video/mp4,video/quicktime,video/webm';

type EditorTarget = { file: File; gloss: string; variant: number; existing?: SignClip };
type PickTarget = { gloss: string; existing?: SignClip };

/**
 * Señas en video: avance por glosa del catálogo del MVP, editor de clips y
 * flujo de validación. El staff sube borradores y los envía a revisión; solo
 * un admin valida, rechaza o publica (la base de datos también lo exige).
 */
export function SignClipsPage() {
  const { signClips } = useRepositories();
  const { isAdmin } = useAuth();
  const { confirm, notify } = useFeedback();
  const clips = useResource(() => signClips.list(), [signClips]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pick, setPick] = useState<PickTarget | null>(null);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [rejecting, setRejecting] = useState<SignClip | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [watching, setWatching] = useState<SignClip | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherGloss, setOtherGloss] = useState('');

  const all = useMemo(() => clips.data || [], [clips.data]);
  const byKey = useMemo(() => {
    const groups = new Map<string, SignClip[]>();
    all.forEach((clip) => groups.set(clip.sign_key, [...(groups.get(clip.sign_key) || []), clip]));
    return groups;
  }, [all]);
  const catalogKeys = useMemo(() => new Set(MVP_CLIP_CATALOG.map((entry) => toSignKey(entry.gloss))), []);
  const others = useMemo(() => [...byKey.entries()].filter(([key]) => !catalogKeys.has(key)), [byKey, catalogKeys]);
  const publishedCount = MVP_CLIP_CATALOG.filter((entry) => byKey.get(toSignKey(entry.gloss))?.some((clip) => clip.published)).length;

  const choose = (target: PickTarget) => {
    setPick(target);
    inputRef.current?.click();
  };

  const onFile = (file: File | undefined) => {
    if (!file || !pick) return;
    if (!file.type.startsWith('video/')) {
      notify({ tone: 'warning', title: 'Archivo no válido', message: 'Elige un video MP4, MOV o WebM.' });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      notify({ tone: 'warning', title: 'Archivo muy grande', message: 'El video original puede pesar hasta 200 MB.' });
      return;
    }
    const variant = pick.existing?.variant ?? nextVariant(all, toSignKey(pick.gloss));
    setEditor({ file, gloss: pick.gloss, variant, existing: pick.existing });
    setPick(null);
  };

  const act = async (title: string, message: string, confirmLabel: string, tone: 'info' | 'warning' | 'danger', task: () => Promise<void>, done: string) => {
    try {
      const ok = await confirm({ title, message, confirmLabel, tone, onConfirm: task });
      if (ok) {
        notify({ tone: 'success', message: done });
        clips.reload();
      }
    } catch (error) {
      notify({ tone: 'danger', message: (error as Error).message });
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    try {
      await signClips.setStatus(rejecting.id, 'rejected', rejectNotes);
      notify({ tone: 'success', message: 'Clip rechazado. Quien lo subió verá la nota.' });
      setRejecting(null);
      clips.reload();
    } catch (error) {
      notify({ tone: 'danger', message: (error as Error).message });
    }
  };

  if (editor) {
    return (
      <ClipEditor
        file={editor.file}
        gloss={editor.gloss}
        variant={editor.variant}
        existing={editor.existing}
        onDone={() => {
          setEditor(null);
          clips.reload();
        }}
        onCancel={() => setEditor(null)}
      />
    );
  }

  const clipCard = (clip: SignClip) => {
    const status = STATUS[clip.validation_status];
    const name = `${clip.gloss} (variante ${clip.variant})`;
    return (
      <div key={clip.id} className="clip-item">
        <button type="button" className="clip-item__poster" onClick={() => setWatching(clip)} aria-label={`Ver el clip de ${name}`}>
          <img src={clip.poster_url} alt="" loading="lazy" />
        </button>
        <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 6 }}>
            <strong>Variante {clip.variant}</strong>
            <Badge tone={status.tone} icon={status.icon}>{status.label}</Badge>
            {clip.published ? <Badge tone="success" icon={Eye}>Publicada</Badge> : null}
            <span className="text-small text-muted">
              {(clip.duration_ms / 1000).toLocaleString('es-CL', { maximumFractionDigits: 1 })} s · {clip.region} · {clip.signer_alias}
            </span>
          </div>
          {clip.validation_status === 'rejected' && clip.validation_notes ? (
            <span className="text-small" style={{ color: 'var(--color-danger-text)' }}>Nota de revisión: {clip.validation_notes}</span>
          ) : null}
          <div className="row" style={{ gap: 4 }}>
            {clip.validation_status === 'draft' || clip.validation_status === 'rejected' ? (
              <Button
                size="sm"
                icon={Send}
                onClick={() =>
                  act(`¿Enviar ${name} a revisión?`, 'Un administrador lo revisará con la persona intérprete.', 'Enviar', 'info', () => signClips.setStatus(clip.id, 'in_review'), 'Enviado a revisión.')
                }
              >
                Enviar a revisión
              </Button>
            ) : null}
            {isAdmin && clip.validation_status === 'in_review' ? (
              <>
                <Button
                  size="sm"
                  variant="success"
                  icon={CheckCircle2}
                  onClick={() =>
                    act(`¿Validar ${name}?`, 'Confirma que la seña fue revisada por la comunidad o una persona intérprete.', 'Validar', 'info', () => signClips.setStatus(clip.id, 'validated'), 'Clip validado.')
                  }
                >
                  Validar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={XCircle}
                  onClick={() => {
                    setRejectNotes('');
                    setRejecting(clip);
                  }}
                >
                  Rechazar
                </Button>
              </>
            ) : null}
            {isAdmin && clip.validation_status === 'validated' && !clip.published ? (
              <Button
                size="sm"
                icon={Eye}
                onClick={() => act(`¿Publicar ${name}?`, 'Se verá en la app en los niveles, el diccionario y los juegos.', 'Publicar', 'info', () => signClips.setPublished(clip.id, true), 'Clip publicado.')}
              >
                Publicar
              </Button>
            ) : null}
            {clip.published ? (
              <Button
                size="sm"
                variant="secondary"
                icon={EyeOff}
                onClick={() => act(`¿Despublicar ${name}?`, 'La app volverá a la foto o al placeholder de la seña. No se borra.', 'Despublicar', 'warning', () => signClips.setPublished(clip.id, false), 'Clip despublicado.')}
              >
                Despublicar
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => choose({ gloss: clip.gloss, existing: clip })}>
              Reemplazar video
            </Button>
            {isAdmin ? (
              <Button
                size="sm"
                variant="ghost"
                icon={Trash2}
                aria-label={`Eliminar ${name}`}
                onClick={() => act(`¿Eliminar ${name}?`, 'Se borran el video y la imagen del almacenamiento. No se puede deshacer.', 'Eliminar', 'danger', () => signClips.remove(clip), 'Clip eliminado.')}
              />
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const glossRow = (gloss: string, list: SignClip[]) => (
    <Card key={gloss} className="stack-sm">
      <div className="row-between">
        <div className="row" style={{ gap: 8 }}>
          <strong>{gloss}</strong>
          <code className="text-small text-muted">{toSignKey(gloss)}</code>
          {list.length === 0 ? <Badge tone="warning" icon={Film}>Sin clip</Badge> : null}
        </div>
        <Button size="sm" variant={list.length ? 'ghost' : 'primary'} icon={Upload} onClick={() => choose({ gloss })}>
          {list.length ? 'Otra variante' : 'Subir clip'}
        </Button>
      </div>
      {list.map(clipCard)}
    </Card>
  );

  return (
    <>
      <PageHeader
        title="Señas en video"
        subtitle={`${publishedCount} de ${MVP_CLIP_CATALOG.length} glosas del catálogo publicadas`}
        actions={<Button variant="secondary" icon={Plus} onClick={() => setOtherOpen(true)}>Clip de otra glosa</Button>}
      />
      <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={(event) => { onFile(event.target.files?.[0]); event.target.value = ''; }} />

      {clips.loading ? (
        <SkeletonRows rows={4} label="Cargando clips" />
      ) : clips.error ? (
        <EmptyState icon={Film} title="No se pudieron cargar los clips" message={clips.error} action={<Button onClick={clips.reload}>Reintentar</Button>} />
      ) : (
        <div className="stack">
          {([1, 2, 3] as const).map((level) => (
            <section key={level} className="stack-sm" aria-labelledby={`clips-level-${level}`}>
              <h2 id={`clips-level-${level}`} className="clip-editor__step">{MVP_CLIP_LEVEL_LABELS[level]}</h2>
              {MVP_CLIP_CATALOG.filter((entry) => entry.level === level).map((entry) => glossRow(entry.gloss, byKey.get(toSignKey(entry.gloss)) || []))}
            </section>
          ))}
          {others.length ? (
            <section className="stack-sm" aria-labelledby="clips-others">
              <h2 id="clips-others" className="clip-editor__step">Otras glosas</h2>
              {others.map(([, list]) => glossRow(list[0].gloss, list))}
            </section>
          ) : null}
        </div>
      )}

      <Dialog
        open={otherOpen}
        title="Clip de otra glosa"
        message="Para señas que no están en el catálogo del MVP."
        onClose={() => setOtherOpen(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setOtherOpen(false)}>Cancelar</Button>
            <Button
              icon={Upload}
              disabled={!isValidSignKey(toSignKey(otherGloss))}
              onClick={() => {
                setOtherOpen(false);
                choose({ gloss: otherGloss.trim().toLocaleUpperCase('es') });
                setOtherGloss('');
              }}
            >
              Elegir video
            </Button>
          </>
        }
      >
        <TextField
          label="Glosa"
          value={otherGloss}
          hint={otherGloss.trim() ? `Clave: ${toSignKey(otherGloss) || '—'}` : 'Ej: CABEZA, ESTÓMAGO'}
          error={otherGloss.trim() && !isValidSignKey(toSignKey(otherGloss)) ? 'La glosa no tiene letras válidas.' : null}
          onChange={(event) => setOtherGloss(event.target.value)}
        />
      </Dialog>

      <Dialog
        open={Boolean(rejecting)}
        tone="danger"
        title={rejecting ? `Rechazar ${rejecting.gloss} (variante ${rejecting.variant})` : ''}
        onClose={() => setRejecting(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>Cancelar</Button>
            <Button variant="danger" icon={XCircle} disabled={!rejectNotes.trim()} onClick={reject}>Rechazar</Button>
          </>
        }
      >
        <TextArea
          label="¿Qué hay que corregir? *"
          rows={3}
          value={rejectNotes}
          hint="Ej: la mano sale del cuadro al final, o la seña corresponde a otra región."
          onChange={(event) => setRejectNotes(event.target.value)}
        />
      </Dialog>

      <Dialog open={Boolean(watching)} wide title={watching ? `${watching.gloss} · variante ${watching.variant}` : ''} onClose={() => setWatching(null)}>
        {watching ? (
          <div className="stack-sm" style={{ alignItems: 'center' }}>
            <video src={watching.video_url} poster={watching.poster_url} controls muted playsInline className="clip-watch" aria-label={`Clip de ${watching.gloss}`} />
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
