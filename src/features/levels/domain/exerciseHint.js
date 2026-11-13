// Qué pista muestra un ejercicio. Regla única para el botón de la ampolleta y
// para mantener presionada una seña. JS puro (sin React).
//
// Si la seña relevante del ejercicio tiene una pista OBSERVADA en el video
// (signs/domain/observedHints.js), esa pista reemplaza al `exercise.hint`
// genérico. Nunca nombra la seña: el título es «Pista» y el texto describe solo
// manos, ubicación y movimiento. Sin pista observada se conserva el
// comportamiento de siempre.

import { OBSERVED_HINTS } from '../../signs/data/local/clubHintsData';
import { fullSentence, OBSERVED_NOTE } from '../../signs/domain/observedHints';
import { normalizeHint } from '../../signs/domain/signDescription';

/** Claves de las señas que el ejercicio muestra y de las que se puede dar una pista. */
export function hintSignKeys(exercise, matched = []) {
  switch (exercise?.type) {
    case 'word-meaning':
    case 'true-false':
    case 'recognition':
      return exercise.sign ? [exercise.sign] : exercise.signs || [];
    case 'sign-choice':
      // La seña de la palabra pedida; la pista no dice cuál tarjeta es.
      return exercise.correct ? [exercise.correct] : [];
    case 'matching': {
      // Los ids de pareja son `s-<posición>`: se pide la primera seña sin emparejar.
      const done = Array.isArray(matched) ? matched : [];
      const pending = exercise.letters.findIndex((_, index) => !done.includes(`s-${index}`));
      return pending >= 0 ? [exercise.letters[pending]] : [];
    }
    default:
      return [];
  }
}

function observedHint(exercise, keys, observed) {
  const found = keys.map((key) => observed.forSign(key));
  if (!found.some(Boolean)) return null;
  if (keys.length === 1) {
    const single = normalizeHint(null, keys[0], observed);
    if (!single) return null;
    // En emparejar la pista no sabe cuál de las filas es: se avisa.
    return exercise?.type === 'matching'
      ? { ...single, texto: `Una de las señas que faltan. ${single.texto ?? ''}`.trim() }
      : single;
  }
  const lines = found.map((entry, index) => `Seña ${index + 1}: ${(entry && fullSentence(entry)) || 'sin pista todavía.'}`);
  return { texto: lines.join('\n'), parametros: [], nota: OBSERVED_NOTE };
}

/**
 * Pista para mostrar, o null si no hay ninguna (la UI pone una frase general).
 *  - `signKey` + `conceal: false`: pista de esa seña, con su nombre en el título.
 *  - `signKey` + `conceal: true`: la glosa es la respuesta; se usa la pista
 *    observada de esa seña sin nombrarla, o la general del ejercicio.
 *  - sin `signKey`: botón de pista del ejercicio.
 * `matched` son los ids ya emparejados (solo importa en emparejar).
 */
export function resolveHint(exercise, { signKey, conceal = false, matched = [] } = {}, observed = OBSERVED_HINTS) {
  if (signKey && !conceal) {
    const own = normalizeHint(null, signKey, observed);
    return own && { ...own, title: `Pista: ${String(signKey).replace(/[-_]+/g, ' ').toLocaleUpperCase('es')}` };
  }
  const keys = signKey ? [signKey] : hintSignKeys(exercise, matched);
  const seen = keys.length ? observedHint(exercise, keys, observed) : null;
  if (seen) return { ...seen, title: 'Pista' };
  const general = normalizeHint(exercise?.hint, exercise?.sign, observed);
  return general && { ...general, title: 'Pista' };
}
