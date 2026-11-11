import { ChevronLeft, ChevronRight, Flag, FlagOff, ImageIcon } from 'lucide-react';
import { snapToFrame, SIGN_CLIP_LIMITS, type ClipSource, type ClipTrim } from '@/lib/domain';
import { Button } from '@/ui';

const FRAME_MS = 1000 / SIGN_CLIP_LIMITS.frameRate;
export const formatMs = (ms: number) => `${(ms / 1000).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} s`;

/**
 * Línea de tiempo del editor: posición actual, inicio y fin del tramo, y
 * cuadro de la imagen fija. Usa controles deslizantes nativos, que ya se
 * operan con teclado y lector de pantalla; los botones marcan con el cuadro
 * actual (atajos I, O y K en el editor).
 */
export function TrimTimeline({
  source,
  trim,
  keyFrameMs,
  currentMs,
  onSeek,
  onTrimChange,
  onKeyFrameChange,
  trimError,
  keyFrameError,
}: {
  source: ClipSource;
  trim: ClipTrim;
  keyFrameMs: number;
  currentMs: number;
  onSeek: (ms: number) => void;
  onTrimChange: (trim: ClipTrim) => void;
  onKeyFrameChange: (ms: number) => void;
  trimError?: string;
  keyFrameError?: string;
}) {
  const max = source.durationMs;
  const step = Math.round(FRAME_MS);
  const duration = trim.endMs - trim.startMs;
  const pct = (ms: number) => `${(ms / max) * 100}%`;

  const slider = (id: string, label: string, value: number, onChange: (ms: number) => void) => (
    <div className="timeline__slider">
      <label htmlFor={id} className="field__label">
        {label} <span className="text-secondary">{formatMs(value)}</span>
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        aria-valuetext={`${label}: ${formatMs(value)}`}
        onChange={(event) => onChange(snapToFrame(Number(event.target.value)))}
      />
    </div>
  );

  return (
    <div className="timeline stack-sm">
      <div className="timeline__track" aria-hidden>
        <span className="timeline__range" style={{ left: pct(trim.startMs), width: pct(duration) }} />
        <span className="timeline__marker timeline__marker--key" style={{ left: pct(keyFrameMs) }} />
        <span className="timeline__marker" style={{ left: pct(currentMs) }} />
      </div>

      {slider('clip-position', 'Posición', currentMs, onSeek)}

      <div className="row">
        <Button variant="ghost" size="sm" icon={ChevronLeft} aria-label="Cuadro anterior (,)" onClick={() => onSeek(snapToFrame(Math.max(0, currentMs - FRAME_MS)))} />
        <Button variant="ghost" size="sm" icon={ChevronRight} aria-label="Cuadro siguiente (.)" onClick={() => onSeek(snapToFrame(Math.min(max, currentMs + FRAME_MS)))} />
        <Button variant="secondary" size="sm" icon={Flag} onClick={() => onTrimChange({ ...trim, startMs: currentMs })}>
          Inicio aquí (I)
        </Button>
        <Button variant="secondary" size="sm" icon={FlagOff} onClick={() => onTrimChange({ ...trim, endMs: currentMs })}>
          Fin aquí (O)
        </Button>
        <Button variant="secondary" size="sm" icon={ImageIcon} onClick={() => onKeyFrameChange(currentMs)}>
          Usar este cuadro (K)
        </Button>
      </div>

      <div className="grid-2">
        {slider('clip-start', 'Inicio', trim.startMs, (startMs) => onTrimChange({ ...trim, startMs }))}
        {slider('clip-end', 'Fin', trim.endMs, (endMs) => onTrimChange({ ...trim, endMs }))}
      </div>

      <p className="text-small">
        Tramo: <strong>{formatMs(Math.max(0, duration))}</strong> · Imagen fija en <strong>{formatMs(keyFrameMs)}</strong>
      </p>
      {trimError ? (
        <span className="field__error" role="alert">
          {trimError}
        </span>
      ) : null}
      {keyFrameError ? (
        <span className="field__error" role="alert">
          {keyFrameError}
        </span>
      ) : null}
    </div>
  );
}
