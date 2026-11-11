// Qué material se muestra para una seña: clip con movimiento, foto fija o
// placeholder. Es la única regla de prioridad; SignImage y el panel la usan
// sin repetirla. Diseño en docs/10-senas-en-video.md.
//
// JS puro: lo reutiliza el portal web vía el alias `@domain`.

/** Límites de un clip. La migración `sign_clips` repite los mismos con `check`. */
export const SIGN_CLIP_LIMITS = Object.freeze({
  minDurationMs: 500,
  maxDurationMs: 6000,
  exportSize: 480,
  minCropSize: 240,
  frameRate: 30,
  maxVideoBytes: 1500000,
});

const SIGN_KEY_PATTERN = /^[a-z0-9ñ~]+(-[a-z0-9ñ~]+)*$/;
const HTTP_URL_PATTERN = /^https?:\/\/[^\s"'<>]+$/i;

/**
 * Clave canónica de una seña a partir de su glosa: minúsculas, sin tildes
 * (la ñ se conserva), guiones entre palabras y sin lo que va después de «/».
 * Así «MÉDICO / DOCTOR» y «médico» apuntan al mismo clip: `medico`.
 * Devuelve '' si la glosa no tiene ningún carácter válido.
 */
export function toSignKey(gloss) {
  const head = String(gloss ?? '').split('/')[0];
  return head
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/ñ/g, 'ñ')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ~]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isValidSignKey(value) {
  return typeof value === 'string' && SIGN_KEY_PATTERN.test(value);
}

/** true si el clip trae todo lo necesario para reproducirse sin riesgos. */
export function isPlayableClip(clip) {
  if (!clip || typeof clip !== 'object') return false;
  const { id, signKey, variant, videoUrl, posterUrl, durationMs } = clip;
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    isValidSignKey(signKey) &&
    Number.isInteger(variant) &&
    variant >= 1 &&
    typeof videoUrl === 'string' &&
    HTTP_URL_PATTERN.test(videoUrl) &&
    typeof posterUrl === 'string' &&
    HTTP_URL_PATTERN.test(posterUrl) &&
    Number.isFinite(durationMs) &&
    durationMs >= SIGN_CLIP_LIMITS.minDurationMs &&
    durationMs <= SIGN_CLIP_LIMITS.maxDurationMs
  );
}

/** Agrupa los clips reproducibles por clave, ordenados por variante. Descarta los inválidos. */
export function groupClipsByKey(clips) {
  if (!Array.isArray(clips)) return {};
  const groups = {};
  clips.filter(isPlayableClip).forEach((clip) => {
    if (!groups[clip.signKey]) groups[clip.signKey] = [];
    groups[clip.signKey].push(clip);
  });
  Object.values(groups).forEach((list) => list.sort((a, b) => a.variant - b.variant));
  return groups;
}

/**
 * Decide qué mostrar para una seña. Prioridad: clip → foto → placeholder.
 *
 *   signKey       clave tal como viene del ejercicio o del diccionario
 *   clipsByKey    resultado de groupClipsByKey
 *   stills        imágenes locales de la seña (getSignAssets)
 *   clipsEnabled  flag remoto `signs.clips`; apagado, se ignoran los clips
 *   label         texto del placeholder; por defecto la clave en mayúsculas
 */
export function resolveSignMedia({ signKey, clipsByKey = {}, stills = [], clipsEnabled = true, label }) {
  const variants = clipsEnabled ? clipsByKey[toSignKey(signKey)] || [] : [];
  if (variants.length > 0) return { kind: 'clip', clip: variants[0], variants };
  if (Array.isArray(stills) && stills.length > 0) return { kind: 'still', sources: stills };
  const text = label !== undefined ? label : String(signKey ?? '').toLocaleUpperCase('es');
  return { kind: 'placeholder', label: text };
}
