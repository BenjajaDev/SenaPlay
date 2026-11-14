// Nombre legible de una seña para la pista de «mantener presionado». Una sola
// regla para letras, números, señas del club y del MINEDUC. JS puro (sin React).

import { formatGloss } from './clubDictionary';
import { toSignKey } from './signMedia';

// 'n~' es la variante de foto de la Ñ (ver PHOTO_SIGN_KEYS).
const LETTER_ALIASES = Object.freeze({ 'n~': 'ñ' });
const NUMBER_PATTERN = /^\d+$/;

/**
 * «buenos-dias» → «Buenos días», «a» → «Letra A», «7» → «Número 7».
 *
 *   signKey      clave de la seña tal como la usa el ejercicio
 *   wordByKey    palabras del club por clave (buildClubIndex), con tildes y nombres propios
 *   clip         clip publicado de esa seña, si existe (su glosa es el respaldo)
 *
 * Devuelve null si no hay clave: la UI no muestra un aviso vacío.
 */
export function signDisplayName(signKey, { wordByKey = new Map(), clip = null } = {}) {
  const raw = String(signKey ?? '').trim().toLocaleLowerCase('es');
  if (!raw) return null;
  const letter = LETTER_ALIASES[raw] ?? raw;
  if ([...letter].length === 1 && /\p{L}/u.test(letter)) return `Letra ${letter.toLocaleUpperCase('es')}`;
  if (NUMBER_PATTERN.test(raw)) return `Número ${raw}`;

  const key = toSignKey(raw);
  const clubWord = wordByKey.get(key);
  if (clubWord) return clubWord;
  if (clip?.gloss) return formatGloss(clip.gloss);
  return formatGloss(raw.replace(/[-_]+/g, ' '));
}
