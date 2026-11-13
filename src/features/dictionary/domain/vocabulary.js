// Reglas del modo «Señas reales» del diccionario: temas como filtros, búsqueda
// y el detalle de una seña. JS puro, sin React.
import { OBSERVED_NOTE } from '../../signs/domain/observedHints';

export const ALL_THEMES = 'Todos';

/** Minúsculas y sin tildes, para comparar lo que la persona escribe con los datos. */
export const normalizeText = (value) =>
  String(value || '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** «Todos» y los temas que existen en los datos, en orden alfabético. */
export function themeFilters(signs) {
  const themes = new Set();
  signs.forEach((sign) => {
    if (sign.theme) themes.add(sign.theme);
  });
  return [ALL_THEMES, ...[...themes].sort((a, b) => a.localeCompare(b, 'es'))];
}

/** Línea de fuente que ve la persona: la del club, o la página del diccionario MINEDUC. */
export function signSourceLabel(sign) {
  if (sign.source) return `Fuente: ${sign.source}`;
  if (sign.page) return `Diccionario MINEDUC · pág. ${sign.page}`;
  return null;
}

/**
 * Objeto que recibe SignDetailModal. Las señas con `source` (las del club) traen
 * una descripción observada por un programa: se avisa que falta validarla.
 */
export function signToDetail(sign) {
  return {
    signKey: sign.word,
    title: sign.word,
    subtitle: sign.theme,
    badge: sign.type,
    description: sign.meaning,
    howTo: sign.howTo,
    howToNote: sign.source && sign.howTo ? OBSERVED_NOTE : null,
    source: signSourceLabel(sign),
  };
}

/** Texto en el que busca la barra: se normaliza una vez por seña, no por tecla. */
export const buildSearchIndex = (signs) =>
  signs.map((sign) => ({ sign, haystack: normalizeText(`${sign.word} ${sign.meaning || ''} ${sign.theme || ''}`) }));

export function filterSigns(index, { theme = ALL_THEMES, query = '' } = {}) {
  const search = normalizeText(query.trim());
  return index
    .filter((item) => (theme === ALL_THEMES || item.sign.theme === theme) && (!search || item.haystack.includes(search)))
    .map((item) => item.sign);
}
