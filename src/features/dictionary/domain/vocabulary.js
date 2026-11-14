// Reglas del diccionario: secciones y orden de cada modo, filtros, búsqueda y
// el detalle de una seña. JS puro, sin React.
import { CLUB_SOURCE, CLUB_THEME_ORDER } from '../../signs/domain/clubDictionary';
import { OBSERVED_NOTE } from '../../signs/domain/observedHints';
import { toSignKey } from '../../signs/domain/signMedia';

export const ALL_THEMES = 'Todos';

/** Minúsculas y sin tildes, para comparar lo que la persona escribe con los datos. */
export const normalizeText = (value) =>
  String(value || '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const byWord = (a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });

// Temas del curso del club primero, en su orden; los demás (MINEDUC) después, de la A a la Z.
const themeRank = (theme) => {
  const index = CLUB_THEME_ORDER.indexOf(theme);
  return index === -1 ? CLUB_THEME_ORDER.length : index;
};
const compareThemes = (a, b) => themeRank(a) - themeRank(b) || byWord(a, b);

/** Sección de las señas sin tema: va al final. */
export const UNTHEMED = 'Otras señas';

/** «Todos» y los temas que existen en los datos, en el orden del curso. */
export function themeFilters(signs) {
  const themes = new Set();
  signs.forEach((sign) => {
    if (sign.theme) themes.add(sign.theme);
  });
  return [ALL_THEMES, ...[...themes].sort(compareThemes)];
}

/**
 * Señas reales agrupadas por tema, como se enseñan: los temas en el orden del
 * curso del club y, dentro de cada uno, las del club en su orden (la seña del
 * tema primero; los números 1, 2, 3…), seguidas de las demás de la A a la Z.
 * `positionByKey` es la posición en el curso (buildClubIndex).
 * Devuelve [{ title, data }] para una SectionList; sin secciones vacías.
 */
export function groupSignsByTheme(signs, positionByKey = new Map()) {
  // Solo las del club tienen posición en el curso: una del MINEDUC con la misma
  // palabra («Caminar») no debe adelantarse en su propio tema.
  // Infinity − Infinity es NaN (falso): entre dos sin posición decide la palabra.
  const position = (sign) => {
    const course = sign.source === CLUB_SOURCE ? positionByKey.get(toSignKey(sign.word)) : undefined;
    return course ?? Number.POSITIVE_INFINITY;
  };
  const sections = new Map();
  signs.forEach((sign) => {
    const theme = sign.theme || UNTHEMED;
    if (!sections.has(theme)) sections.set(theme, []);
    sections.get(theme).push(sign);
  });
  const isUnthemed = (theme) => Number(theme === UNTHEMED);
  const themes = [...sections.keys()].sort((a, b) => isUnthemed(a) - isUnthemed(b) || compareThemes(a, b));
  return themes.map((title) => ({
    title,
    data: [...sections.get(title)].sort((a, b) => position(a) - position(b) || byWord(a.word, b.word)),
  }));
}

/** Sección de deletreo de cada categoría guardada: las dos mitades del abecedario van juntas. */
const SPELLING_SECTIONS = Object.freeze({ 'A-M': 'Abecedario', 'N-Z': 'Abecedario' });
const spellingSection = (entry) => SPELLING_SECTIONS[entry.category] ?? entry.category ?? UNTHEMED;

/** Filtros del modo deletreo: «Todos» y cada sección, en el orden de los datos. */
export function spellingFilters(entries) {
  return [ALL_THEMES, ...new Set(entries.map(spellingSection))];
}

/**
 * Entradas de deletreo en secciones («Abecedario», «Acciones»…), en el orden en
 * que llegan (sort_order: A…Z con la Ñ después de la N), filtradas por sección
 * y por texto. Devuelve [{ title, data }] sin secciones vacías.
 */
export function groupSpellingEntries(entries, { section = ALL_THEMES, query = '' } = {}) {
  const search = normalizeText(query.trim());
  const sections = new Map();
  entries.forEach((entry) => {
    const title = spellingSection(entry);
    if (section !== ALL_THEMES && title !== section) return;
    if (search && !normalizeText(`${entry.letter} ${entry.description}`).includes(search)) return;
    if (!sections.has(title)) sections.set(title, []);
    sections.get(title).push(entry);
  });
  return [...sections].map(([title, data]) => ({ title, data }));
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
