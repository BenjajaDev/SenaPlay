import type { ExportedClip } from '@/data/repositories';
import { SIGN_CLIP_LIMITS, type ClipEdit, type ClipSource, type CropSquare } from '@/lib/domain';

// Exportación en el navegador con mediabunny (WebCodecs): recorta, corta el
// tramo y codifica a MP4 H.264 480 × 480 sin audio, y saca la imagen fija
// WebP del cuadro clave. La librería se carga con import() solo aquí: el
// resto del panel no paga su peso. Sin React, para probarla aparte.

type Mediabunny = typeof import('mediabunny');
type Quality = InstanceType<Mediabunny['Quality']>;

export const loadMediabunny = (): Promise<Mediabunny> => import('mediabunny');

export class ClipExportError extends Error {}

const UNSUPPORTED = 'Este navegador no puede exportar el video. Usa Chrome, Edge o Firefox actualizados.';

/** Rectángulo de recorte en el formato de mediabunny. */
export function toCropRectangle(crop: CropSquare) {
  return { left: crop.left, top: crop.top, width: crop.size, height: crop.size };
}

/** Opciones de Conversion para una edición. Pura: el valor de calidad se recibe hecho. */
export function conversionOptions(edit: ClipEdit, bitrate: Quality | number) {
  const size = SIGN_CLIP_LIMITS.exportSize;
  return {
    trim: { start: edit.trim.startMs / 1000, end: edit.trim.endMs / 1000 },
    video: {
      crop: toCropRectangle(edit.crop),
      width: size,
      height: size,
      // El recorte ya es cuadrado: «fill» solo escala, sin deformar ni agregar bordes.
      fit: 'fill' as const,
      frameRate: SIGN_CLIP_LIMITS.frameRate,
      codec: 'avc' as const,
      bitrate,
      forceTranscode: true,
    },
    audio: { discard: true },
  };
}

/** null si el navegador puede exportar; si no, el mensaje para mostrar. */
export async function checkExportSupport(mb: Mediabunny): Promise<string | null> {
  if (typeof VideoEncoder === 'undefined') return UNSUPPORTED;
  const size = SIGN_CLIP_LIMITS.exportSize;
  if (!(await mb.canEncodeVideo('avc', { width: size, height: size }))) return UNSUPPORTED;
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8));
  return blob?.type === 'image/webp' ? null : UNSUPPORTED;
}

const openInput = (mb: Mediabunny, file: Blob) => new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });

/** Tamaño (ya rotado, como se ve) y duración del video original. */
export async function readSource(mb: Mediabunny, file: Blob): Promise<ClipSource> {
  const input = openInput(mb, file);
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new ClipExportError('El archivo no tiene una pista de video.');
    const seconds = await input.computeDuration();
    return { width: track.displayWidth, height: track.displayHeight, durationMs: Math.round(seconds * 1000) };
  } finally {
    input.dispose();
  }
}

async function canvasToWebp(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<Blob> {
  const blob =
    'convertToBlob' in canvas
      ? await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 })
      : await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8));
  if (!blob || blob.type !== 'image/webp') throw new ClipExportError(UNSUPPORTED);
  return blob;
}

/** Imagen fija: el cuadro clave con el mismo recorte, a 480 × 480. */
export async function renderPoster(mb: Mediabunny, file: Blob, edit: ClipEdit): Promise<Blob> {
  const input = openInput(mb, file);
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new ClipExportError('El archivo no tiene una pista de video.');
    const size = SIGN_CLIP_LIMITS.exportSize;
    const sink = new mb.CanvasSink(track, { crop: toCropRectangle(edit.crop), width: size, height: size, fit: 'fill' });
    const frame = await sink.getCanvas(edit.keyFrameMs / 1000);
    if (!frame) throw new ClipExportError('No se pudo leer el cuadro de la imagen fija.');
    return await canvasToWebp(frame.canvas);
  } finally {
    input.dispose();
  }
}

export type ExportHandle = { cancel: () => Promise<void> };

/**
 * Exporta el video. Si a calidad media supera el máximo del bucket, lo
 * reintenta una vez a calidad baja (`onRetry` avisa); si aún no cabe, pide
 * acortar el tramo. `onStart` entrega cómo cancelar la conversión en curso.
 */
export async function exportVideo(
  mb: Mediabunny,
  file: Blob,
  edit: ClipEdit,
  { onProgress, onRetry, onStart }: { onProgress?: (ratio: number) => void; onRetry?: () => void; onStart?: (handle: ExportHandle) => void } = {},
): Promise<Blob> {
  for (const [attempt, quality] of [mb.QUALITY_MEDIUM, mb.QUALITY_LOW].entries()) {
    if (attempt > 0) onRetry?.();
    const input = openInput(mb, file);
    const target = new mb.BufferTarget();
    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target });
    try {
      const conversion = await mb.Conversion.init({ input, output, ...conversionOptions(edit, quality), showWarnings: false });
      if (!conversion.isValid) throw new ClipExportError(UNSUPPORTED);
      conversion.onProgress = (ratio) => onProgress?.(ratio);
      onStart?.({ cancel: () => conversion.cancel() });
      await conversion.execute();
    } finally {
      input.dispose();
    }
    if (!target.buffer) throw new ClipExportError('La exportación no produjo un archivo.');
    if (target.buffer.byteLength <= SIGN_CLIP_LIMITS.maxVideoBytes) return new Blob([target.buffer], { type: 'video/mp4' });
  }
  throw new ClipExportError('El clip pesa más de 1,5 MB incluso a calidad baja. Acorta el tramo.');
}

/** Video + imagen fija listos para subir. */
export async function exportClip(
  mb: Mediabunny,
  file: Blob,
  edit: ClipEdit,
  callbacks?: Parameters<typeof exportVideo>[3],
): Promise<ExportedClip> {
  const video = await exportVideo(mb, file, edit, callbacks);
  const poster = await renderPoster(mb, file, edit);
  return { video, poster, durationMs: edit.trim.endMs - edit.trim.startMs, size: SIGN_CLIP_LIMITS.exportSize };
}

export const isCanceled = (mb: Mediabunny, error: unknown) => error instanceof mb.ConversionCanceledError;
