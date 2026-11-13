// Qué material se muestra para una seña: clip con movimiento, foto fija o
// placeholder. Es la única regla de prioridad; SignImage y el panel la usan
// sin repetirla. Diseño en docs/10-senas-en-video.md.
//
// JS puro: lo reutiliza el portal web vía el alias `@domain`.

/** Límites de un clip. La migración `sign_clips` repite los mismos con `check`. */
export const SIGN_CLIP_LIMITS = Object.freeze({
  minDurationMs: 500,
  maxDurationMs: 10000,
  exportSize: 480,
  minCropSize: 240,
  frameRate: 30,
  maxVideoBytes: 1500000,
});

/**
 * Claves con foto empaquetada en la app (signs/data/local/signAssets.js).
 * Se repiten aquí porque el panel no puede importar los PNG; una prueba
 * compara ambas listas para que no diverjan.
 */
export const PHOTO_SIGN_KEYS = Object.freeze([...'abcdefghijklmnopqrstuvwxyz'.split(''), 'ñ', 'n~']);

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

/**
 * Carpeta del bucket `sign-clips` para una clave. Supabase Storage solo acepta
 * `[A-Za-z0-9_/!.*'() &$=@;:+,?-]` en las rutas, así que la ñ pasa a `n_` y
 * la `~` (n~) a `_`. La migración repite la regla en `public.sign_clip_folder`
 * (supabase/migrations/20261113000100_club_talca_content.sql, con sus asserts en
 * supabase/tests/10_rls_policies.sql) y el script scripts/clubTalca la reutiliza
 * desde aquí: si cambias una, cambia la otra.
 */
export function toStorageFolder(signKey) {
  return String(signKey ?? '').replace(/ñ/g, 'n_').replace(/~/g, '_');
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

/**
 * Señas de la lista que no tienen clip publicado ni foto: en la app se verán
 * como placeholder. Sirve para avisar en el editor de niveles (no bloquea).
 * Devuelve las claves tal como vienen, sin repetir.
 */
export function missingSignMedia(signKeys, { clipKeys = [], photoKeys = PHOTO_SIGN_KEYS } = {}) {
  const clips = new Set(clipKeys);
  const photos = new Set(photoKeys);
  const keys = (Array.isArray(signKeys) ? signKeys : []).map((key) => String(key ?? '').trim()).filter(Boolean);
  return [...new Set(keys)].filter((key) => !clips.has(toSignKey(key)) && !photos.has(key.toLocaleLowerCase('es')));
}
