import { ArrowLeft, Gauge, Pause, Play, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useRepositories } from '@/data/RepositoriesProvider';
import type { SignClip, SignClipLicense } from '@/data/types';
import { clampCrop, createClipEdit, snapToFrame, SIGN_CLIP_LIMITS, validateClipEdit, type ClipEdit, type ClipSource } from '@/lib/domain';
import { Button, Card, EmptyState, PageHeader, SelectField, Spinner, Switch, TextField, useFeedback } from '@/ui';
import { CropOverlay } from './CropOverlay';
import { formatMs, TrimTimeline } from './TrimTimeline';
import { useClipExport } from './useClipExport';

const PREVIEW_SIZE = 240;
const REGION_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type Meta = { region: string; signerAlias: string; consentRef: string; license: SignClipLicense };

/** Reutiliza el encuadre guardado de un clip si el video nuevo tiene el mismo tamaño. */
function initialEdit(source: ClipSource, existing?: SignClip | null): ClipEdit {
  const fresh = createClipEdit(source);
  const saved = existing?.edit_params as Partial<ClipEdit> | undefined;
  const sameSource = saved?.source?.width === source.width && saved?.source?.height === source.height;
  if (!saved?.crop || !saved.trim || typeof saved.keyFrameMs !== 'number' || !sameSource) return fresh;
  const candidate = { source, crop: clampCrop(saved.crop, source), trim: saved.trim, keyFrameMs: saved.keyFrameMs };
  return validateClipEdit(candidate).valid ? candidate : fresh;
}

function useObjectUrl(file: File) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return url;
}

/**
 * Editor de un clip: encuadre 1:1, tramo, imagen fija, vista previa como en
 * la app y exportación en el navegador. El video original no sale del
 * computador; solo se suben el MP4 y la imagen ya procesados.
 *
 * Atajos (fuera de los campos de texto): «,» y «.» cuadro a cuadro; I y O
 * marcan inicio y fin; K usa el cuadro actual como imagen fija.
 */
export function ClipEditor({
  file,
  gloss,
  variant,
  existing,
  onDone,
  onCancel,
}: {
  file: File;
  gloss: string;
  variant: number;
  existing?: SignClip | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { signClips } = useRepositories();
  const { confirm, notify, runBlocking } = useFeedback();
  const exporter = useClipExport(file);
  const url = useObjectUrl(file);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [edit, setEdit] = useState<ClipEdit | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loopSelection, setLoopSelection] = useState(true);
  const [showGuide, setShowGuide] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [meta, setMeta] = useState<Meta>({
    region: existing?.region ?? 'general',
    signerAlias: existing?.signer_alias ?? '',
    consentRef: existing?.consent_ref ?? '',
    license: existing?.license ?? 'propia',
  });

  useEffect(() => {
    if (exporter.source) setEdit(initialEdit(exporter.source, existing));
  }, [exporter.source, existing]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const validation = useMemo(() => (edit ? validateClipEdit(edit) : null), [edit]);
  const metaErrors = {
    signerAlias: meta.signerAlias.trim() ? null : 'Indica quién seña (un seudónimo basta).',
    consentRef: meta.consentRef.trim() ? null : 'Falta la referencia al consentimiento firmado.',
    region: REGION_PATTERN.test(meta.region.trim()) ? null : 'Usa minúsculas y guiones, por ejemplo general o biobio.',
  };
  const metaValid = Boolean(existing) || Object.values(metaErrors).every((error) => !error);
  const converting = exporter.state.phase === 'converting';

  const update = (next: ClipEdit) => {
    setEdit(next);
    setDirty(true);
  };

  const seek = (ms: number) => {
    const video = videoRef.current;
    if (video) video.currentTime = ms / 1000;
    setCurrentMs(ms);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || !edit) return;
    if (playing) {
      video.pause();
      return;
    }
    if (loopSelection && (video.currentTime * 1000 < edit.trim.startMs || video.currentTime * 1000 >= edit.trim.endMs)) {
      video.currentTime = edit.trim.startMs / 1000;
    }
    void video.play();
  };

  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !edit) return;
    const ms = video.currentTime * 1000;
    if (loopSelection && playing && ms >= edit.trim.endMs) video.currentTime = edit.trim.startMs / 1000;
    setCurrentMs(snapToFrame(ms));
  };

  const onShortcut = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && (target as HTMLInputElement).type !== 'range';
    if (!edit || typing) return;
    const frame = 1000 / SIGN_CLIP_LIMITS.frameRate;
    const actions: Record<string, () => void> = {
      ',': () => seek(snapToFrame(Math.max(0, currentMs - frame))),
      '.': () => seek(snapToFrame(Math.min(edit.source.durationMs, currentMs + frame))),
      i: () => update({ ...edit, trim: { ...edit.trim, startMs: currentMs } }),
      o: () => update({ ...edit, trim: { ...edit.trim, endMs: currentMs } }),
      k: () => update({ ...edit, keyFrameMs: currentMs }),
    };
    const action = actions[event.key.toLowerCase()];
    if (!action) return;
    event.preventDefault();
    action();
  };

  const leave = async () => {
    if (converting) await exporter.cancel();
    if (!dirty) {
      onCancel();
      return;
    }
    const ok = await confirm({
      title: '¿Salir del editor?',
      message: 'Se pierde el encuadre que hiciste. El video original sigue en tu computador.',
      tone: 'warning',
      confirmLabel: 'Salir',
    });
    if (ok) onCancel();
  };

  const exportAndUpload = async () => {
    setSubmitted(true);
    if (!edit || !validation?.valid || !metaValid) return;
    videoRef.current?.pause();
    const exported = await exporter.run(edit);
    if (!exported) return;
    try {
      await runBlocking('Subiendo el clip…', () =>
        existing
          ? signClips.replaceMedia(existing, exported, edit)
          : signClips.create({ ...exported, gloss, variant, region: meta.region.trim(), signerAlias: meta.signerAlias, consentRef: meta.consentRef, license: meta.license, edit }),
      );
      notify({
        tone: 'success',
        title: 'Clip subido',
        message: existing ? 'Se reemplazó y volvió a borrador.' : 'Quedó como borrador. Envíalo a revisión cuando esté listo.',
      });
      setDirty(false);
      onDone();
    } catch (error) {
      notify({ tone: 'danger', title: 'No se pudo subir', message: (error as Error).message });
    }
  };

  const title = `${existing ? 'Reemplazar' : 'Nuevo'} clip · ${gloss} (variante ${variant})`;
  const header = <PageHeader title={title} subtitle={file.name} actions={<Button variant="secondary" icon={ArrowLeft} onClick={leave}>Volver</Button>} />;

  if (exporter.unsupported || exporter.sourceError) {
    return (
      <>
        {header}
        <EmptyState icon={X} title="No se puede editar este video aquí" message={exporter.unsupported || exporter.sourceError || ''} action={<Button onClick={onCancel}>Volver</Button>} />
      </>
    );
  }

  if (!edit || !validation) {
    return (
      <>
        {header}
        <div className="stack" style={{ alignItems: 'center', padding: 48 }}>
          <Spinner label="Preparando el editor…" />
        </div>
      </>
    );
  }

  return (
    <div onKeyDown={onShortcut}>
      {header}
      <div className="clip-editor">
        <Card className="stack">
          <h2 className="clip-editor__step">1. Encuadra la seña</h2>
          <CropOverlay source={edit.source} crop={edit.crop} onChange={(crop) => update({ ...edit, crop })} showGuide={showGuide}>
            <video
              ref={videoRef}
              src={url}
              muted
              playsInline
              preload="auto"
              className="crop-stage__video"
              aria-label={`Video original de ${gloss}`}
              onTimeUpdate={onTimeUpdate}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          </CropOverlay>
          {validation.errors.crop ? (
            <span className="field__error" role="alert">{validation.errors.crop}</span>
          ) : validation.warnings.crop ? (
            <span className="field__hint field__hint--warning" role="status">{validation.warnings.crop}</span>
          ) : null}
          <div className="row">
            <Button variant="secondary" icon={playing ? Pause : Play} onClick={togglePlay}>
              {playing ? 'Pausar' : loopSelection ? 'Reproducir el tramo' : 'Reproducir'}
            </Button>
            <Switch label="Repetir el tramo" checked={loopSelection} onChange={setLoopSelection} />
            <Switch label="Guía de signado" checked={showGuide} onChange={setShowGuide} />
          </div>

          <h2 className="clip-editor__step">2. Corta el tramo y elige la imagen fija</h2>
          <TrimTimeline
            source={edit.source}
            trim={edit.trim}
            keyFrameMs={edit.keyFrameMs}
            currentMs={currentMs}
            onSeek={seek}
            onTrimChange={(trim) => update({ ...edit, trim })}
            onKeyFrameChange={(keyFrameMs) => update({ ...edit, keyFrameMs })}
            trimError={validation.errors.trim}
            keyFrameError={validation.errors.keyFrame}
          />
        </Card>

        <div className="stack">
          <Card className="stack">
            <h2 className="clip-editor__step">3. Revisa cómo se verá</h2>
            <ClipPreview url={url} edit={edit} />
          </Card>

          <Card className="stack">
            <h2 className="clip-editor__step">4. Datos y exportación</h2>
            {existing ? (
              <p className="text-small text-secondary">
                Se mantienen quién seña ({existing.signer_alias}), el consentimiento ({existing.consent_ref}) y la región ({existing.region}). Al reemplazar, el clip vuelve a borrador.
              </p>
            ) : (
              <>
                <TextField label="Quién seña (seudónimo) *" value={meta.signerAlias} error={submitted ? metaErrors.signerAlias : null} onChange={(e) => setMeta({ ...meta, signerAlias: e.target.value })} />
                <TextField
                  label="Referencia del consentimiento *"
                  hint="Código del documento firmado. El documento no se sube aquí."
                  value={meta.consentRef}
                  error={submitted ? metaErrors.consentRef : null}
                  onChange={(e) => setMeta({ ...meta, consentRef: e.target.value })}
                />
                <div className="grid-2">
                  <TextField label="Región" hint="general, biobio, arica…" value={meta.region} error={metaErrors.region} onChange={(e) => setMeta({ ...meta, region: e.target.value })} />
                  <SelectField
                    label="Licencia"
                    value={meta.license}
                    onChange={(e) => setMeta({ ...meta, license: e.target.value as SignClipLicense })}
                    options={[
                      { value: 'propia', label: 'Grabación propia' },
                      { value: 'cedida', label: 'Cedida con permiso' },
                    ]}
                  />
                </div>
              </>
            )}

            {converting ? (
              <ExportProgress state={exporter.state} onCancel={exporter.cancel} />
            ) : (
              <Button icon={Upload} onClick={exportAndUpload} disabled={!exporter.ready}>
                Exportar y subir como borrador
              </Button>
            )}
            {exporter.state.phase === 'error' ? (
              <span className="field__error" role="alert">{exporter.state.message}</span>
            ) : null}
            {submitted && (!validation.valid || !metaValid) ? (
              <span className="field__error" role="alert">Revisa los campos marcados antes de exportar.</span>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ExportProgress({ state, onCancel }: { state: { phase: 'converting'; progress: number; retried: boolean } | { phase: string }; onCancel: () => void }) {
  const progress = 'progress' in state ? state.progress : 0;
  const percent = Math.round(progress * 100);
  return (
    <div className="stack-sm" role="status">
      <progress value={progress} max={1} aria-label="Progreso de la exportación" className="clip-progress" />
      <div className="row-between">
        <span className="text-small">Convirtiendo… {percent} %</span>
        <Button variant="ghost" size="sm" icon={X} onClick={onCancel}>Cancelar</Button>
      </div>
      {'retried' in state && state.retried ? (
        <span className="field__hint">El clip pesaba más de 1,5 MB: se está exportando de nuevo con menos calidad.</span>
      ) : null}
    </div>
  );
}

/**
 * Vista previa como en la app: caja cuadrada con el recorte aplicado por
 * CSS. En reposo muestra el cuadro de la imagen fija; «Ver seña» reproduce
 * el tramo una vez (1× o 0,5×) y vuelve a la imagen.
 */
function ClipPreview({ url, edit }: { url: string; edit: ClipEdit }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [slow, setSlow] = useState(false);
  const [playing, setPlaying] = useState(false);
  const scale = PREVIEW_SIZE / edit.crop.size;

  useEffect(() => {
    const video = ref.current;
    if (video && !playing) video.currentTime = edit.keyFrameMs / 1000;
  }, [edit.keyFrameMs, playing]);

  const play = () => {
    const video = ref.current;
    if (!video) return;
    video.currentTime = edit.trim.startMs / 1000;
    video.playbackRate = slow ? 0.5 : 1;
    setPlaying(true);
    void video.play();
  };

  const onTimeUpdate = () => {
    const video = ref.current;
    if (video && playing && video.currentTime * 1000 >= edit.trim.endMs) {
      video.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="stack-sm" style={{ alignItems: 'center' }}>
      <div className="clip-preview" style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}>
        <video
          ref={ref}
          src={url}
          muted
          playsInline
          preload="auto"
          aria-label="Vista previa del clip"
          onTimeUpdate={onTimeUpdate}
          style={{
            width: edit.source.width * scale,
            height: edit.source.height * scale,
            transform: `translate(${-edit.crop.left * scale}px, ${-edit.crop.top * scale}px)`,
          }}
        />
      </div>
      <div className="row">
        <Button variant="secondary" size="sm" icon={Play} onClick={play} disabled={playing}>
          Ver seña ({formatMs(edit.trim.endMs - edit.trim.startMs)})
        </Button>
        <Button variant={slow ? 'primary' : 'ghost'} size="sm" icon={Gauge} aria-pressed={slow} onClick={() => setSlow(!slow)}>
          Lento 0,5×
        </Button>
      </div>
    </div>
  );
}
