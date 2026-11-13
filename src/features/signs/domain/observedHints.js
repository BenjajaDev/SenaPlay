// Pistas «observadas» de las señas del Club de Sordos de Talca.
//
// Las genera una herramienta aparte, mirando los videos con MediaPipe, y llegan
// en `signs/data/content/clubTalcaHints.json`. NO son una descripción
// lingüística: son lo que un programa vio (cuántas manos, dónde, cómo se
// mueve) y esperan la validación de una persona Sorda. Por eso siempre viajan
// con una nota visible y nunca llenan la configuración de la mano.
//
// JS puro y SIN imports: lo usan la app, Jest y los scripts de scripts/clubTalca.

export const OBSERVED_NOTE = 'Observada en el video, pendiente de validación por una persona sorda.';

const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const clean = (value) => (isText(value) ? value.trim() : null);

/** Una pista válida trae al menos un dato útil; todo lo demás se descarta. */
function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const manos = raw.manos === 1 || raw.manos === 2 ? raw.manos : null;
  const entry = { manos, ubicacion: clean(raw.ubicacion), movimiento: clean(raw.movimiento), texto: clean(raw.texto) };
  return entry.manos || entry.ubicacion || entry.movimiento || entry.texto ? entry : null;
}

/** «Se hace con una mano.» / «Se hace con dos manos.» (null si no se sabe). */
export function handsSentence(manos) {
  if (manos === 1) return 'Se hace con una mano.';
  if (manos === 2) return 'Se hace con dos manos.';
  return null;
}

// Acepta la frase hecha del archivo («un movimiento corto», «casi sin moverse») o solo el adjetivo («corto»).
function movementPhrase(movimiento) {
  if (!movimiento) return null;
  if (/^casi sin/.test(movimiento)) return movimiento;
  return /^un movimiento/.test(movimiento) ? `con ${movimiento}` : `con un movimiento ${movimiento}`;
}

/** Frase completa de una pista: la que viene en el archivo o una armada con sus partes. */
export function fullSentence(entry) {
  if (entry.texto) return entry.texto;
  const parts = [
    entry.manos === 1 ? 'con una mano' : entry.manos === 2 ? 'con dos manos' : null,
    entry.ubicacion,
    movementPhrase(entry.movimiento),
  ].filter(Boolean);
  return parts.length ? `Se hace ${parts.join(', ')}.` : null;
}

/**
 * Catálogo de pistas observadas a partir del contenido del JSON (o null si el
 * archivo todavía no existe). `forSign(clave)` devuelve la pista o null.
 */
export function createObservedHints(doc) {
  const source = doc && typeof doc === 'object' ? doc : {};
  const raw = source.pistas && typeof source.pistas === 'object' ? source.pistas : {};
  const entries = new Map();
  Object.keys(raw).forEach((key) => {
    const entry = normalizeEntry(raw[key]);
    if (entry) entries.set(key, entry);
  });
  return Object.freeze({
    fuente: clean(source.fuente),
    size: entries.size,
    forSign: (signKey) => entries.get(String(signKey ?? '').normalize('NFC').trim().toLocaleLowerCase('es')) ?? null,
  });
}

export const NO_OBSERVED_HINTS = createObservedHints(null);
