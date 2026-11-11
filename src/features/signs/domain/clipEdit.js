// Reglas del editor de clips del panel: encuadre cuadrado, tramo y cuadro
// clave. Coordenadas en píxeles del video original (ya rotado, como se ve) y
// tiempos en milisegundos. JS puro, reutilizado por el portal vía `@domain`.
//
// Una edición tiene esta forma (y así se guarda en sign_clips.edit_params):
//   { source: { width, height, durationMs },
//     crop: { left, top, size },
//     trim: { startMs, endMs },
//     keyFrameMs }

import { SIGN_CLIP_LIMITS } from './signMedia';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const formatSeconds = (ms) =>
  (ms / 1000).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

function isValidSource(source) {
  return (
    source != null &&
    Number.isFinite(source.width) &&
    Number.isFinite(source.height) &&
    Number.isFinite(source.durationMs) &&
    source.width > 0 &&
    source.height > 0 &&
    source.durationMs > 0
  );
}

/** Lado máximo posible del recorte para este video. */
export function maxCropSize(source) {
  return Math.floor(Math.min(source.width, source.height));
}

/** El cuadrado más grande centrado: punto de partida del encuadre. */
export function initialCrop(source) {
  const size = maxCropSize(source);
  return {
    left: Math.floor((source.width - size) / 2),
    top: Math.floor((source.height - size) / 2),
    size,
  };
}

/** Ajusta el recorte para que sea entero, respete el tamaño mínimo y no se salga del video. */
export function clampCrop(crop, source) {
  const max = maxCropSize(source);
  const size = clamp(Math.round(crop.size), Math.min(SIGN_CLIP_LIMITS.minCropSize, max), max);
  return {
    left: clamp(Math.round(crop.left), 0, Math.floor(source.width) - size),
    top: clamp(Math.round(crop.top), 0, Math.floor(source.height) - size),
    size,
  };
}

export function moveCrop(crop, dx, dy, source) {
  return clampCrop({ ...crop, left: crop.left + dx, top: crop.top + dy }, source);
}

/** Agranda o achica manteniendo el centro, para que la seña no se desplace al escalar. */
export function resizeCrop(crop, delta, source) {
  const centerX = crop.left + crop.size / 2;
  const centerY = crop.top + crop.size / 2;
  const max = maxCropSize(source);
  const size = clamp(crop.size + delta, Math.min(SIGN_CLIP_LIMITS.minCropSize, max), max);
  return clampCrop({ left: centerX - size / 2, top: centerY - size / 2, size }, source);
}

/** Lleva un instante al cuadro más cercano, para que inicio, fin y cuadro clave coincidan con un fotograma. */
export function snapToFrame(ms, frameRate = SIGN_CLIP_LIMITS.frameRate) {
  const frameMs = 1000 / frameRate;
  return Math.round(Math.round(ms / frameMs) * frameMs);
}

/** Tramo inicial: desde el comienzo, hasta la duración máxima permitida. */
export function initialTrim(source) {
  return { startMs: 0, endMs: snapToFrame(Math.min(source.durationMs, SIGN_CLIP_LIMITS.maxDurationMs)) };
}

/** Cuadro clave sugerido: el punto medio del tramo. */
export function defaultKeyFrame(trim) {
  return snapToFrame((trim.startMs + trim.endMs) / 2);
}

/** Edición inicial al abrir un video en el editor. */
export function createClipEdit(source) {
  const trim = initialTrim(source);
  return { source: { ...source }, crop: initialCrop(source), trim, keyFrameMs: defaultKeyFrame(trim) };
}

/**
 * Valida una edición antes de exportar. Los errores bloquean la exportación;
 * las advertencias solo se muestran. Los mensajes van junto al control
 * correspondiente (recorte, línea de tiempo o cuadro clave).
 *
 * → { valid, errors: { source?, crop?, trim?, keyFrame? }, warnings: { crop? } }
 */
export function validateClipEdit(edit) {
  const errors = {};
  const warnings = {};
  const { source, crop, trim, keyFrameMs } = edit || {};

  if (!isValidSource(source)) {
    errors.source = 'No se pudo leer el tamaño o la duración del video.';
    return { valid: false, errors, warnings };
  }

  const cropIsNumeric = crop != null && [crop.left, crop.top, crop.size].every(Number.isFinite);
  if (!cropIsNumeric) {
    errors.crop = 'Falta el encuadre.';
  } else if (crop.left < 0 || crop.top < 0 || crop.left + crop.size > source.width || crop.top + crop.size > source.height) {
    errors.crop = 'El encuadre se sale del video.';
  } else if (crop.size < Math.min(SIGN_CLIP_LIMITS.minCropSize, maxCropSize(source))) {
    errors.crop = `El encuadre es muy chico: debe medir al menos ${SIGN_CLIP_LIMITS.minCropSize} px.`;
  } else if (crop.size < SIGN_CLIP_LIMITS.exportSize) {
    warnings.crop = `El encuadre mide ${Math.round(crop.size)} px, menos que los ${SIGN_CLIP_LIMITS.exportSize} px del clip: se verá borroso.`;
  }

  const trimIsNumeric = trim != null && Number.isFinite(trim.startMs) && Number.isFinite(trim.endMs);
  if (!trimIsNumeric) {
    errors.trim = 'Falta marcar el inicio y el fin.';
  } else if (trim.startMs < 0 || trim.endMs > source.durationMs || trim.endMs <= trim.startMs) {
    errors.trim = 'El inicio debe ir antes del fin y ambos dentro del video.';
  } else {
    const duration = trim.endMs - trim.startMs;
    if (duration < SIGN_CLIP_LIMITS.minDurationMs || duration > SIGN_CLIP_LIMITS.maxDurationMs) {
      errors.trim = `El tramo dura ${formatSeconds(duration)} s; debe durar entre ${formatSeconds(
        SIGN_CLIP_LIMITS.minDurationMs,
      )} y ${formatSeconds(SIGN_CLIP_LIMITS.maxDurationMs)} s.`;
    }
  }

  if (!Number.isFinite(keyFrameMs)) {
    errors.keyFrame = 'Elige el cuadro de la imagen fija.';
  } else if (trimIsNumeric && (keyFrameMs < trim.startMs || keyFrameMs > trim.endMs)) {
    errors.keyFrame = 'La imagen fija debe estar dentro del tramo.';
  }

  return { valid: Object.keys(errors).length === 0, errors, warnings };
}
