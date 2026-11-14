import clubTalcaClips from '../../../signs/data/content/clubTalcaClips.json';
import { DICTIONARY_ENTRIES } from '../../../signs/data/local/dictionaryData';
import { buildClubIndex, CLUB_SOURCE, CLUB_THEME_ORDER } from '../../../signs/domain/clubDictionary';
import { OBSERVED_NOTE } from '../../../signs/domain/observedHints';
import {
  ALL_THEMES,
  buildSearchIndex,
  filterSigns,
  groupSignsByTheme,
  groupSpellingEntries,
  normalizeText,
  signSourceLabel,
  signToDetail,
  spellingFilters,
  themeFilters,
  UNTHEMED,
} from '../vocabulary';

const mineduc = { word: 'ABEJA', type: 'Sustantivo', meaning: 'Insecto que produce miel.', howTo: 'Mano en pinza.', theme: 'Animales', page: 21, source: null };
const club = { word: 'Buenos días', type: 'Seña', meaning: null, howTo: 'Se hace con una mano.', theme: 'Saludos', page: null, source: 'Club de Sordos de Talca' };
const clubBare = { word: 'Año', type: 'Seña', meaning: null, howTo: null, theme: 'Tiempo', page: null, source: 'Club de Sordos de Talca' };

describe('detalle de una seña', () => {
  test('MINEDUC: fuente con la página y sin nota', () => {
    const detail = signToDetail(mineduc);
    expect(detail.source).toBe('Diccionario MINEDUC · pág. 21');
    expect(detail.howToNote).toBeNull();
    expect(detail.description).toBe('Insecto que produce miel.');
  });

  test('club: fuente visible y nota de validación en la descripción observada', () => {
    const detail = signToDetail(club);
    expect(detail.source).toBe('Fuente: Club de Sordos de Talca');
    expect(detail.howToNote).toBe(OBSERVED_NOTE);
    expect(signToDetail(clubBare).howToNote).toBeNull();
    expect(signSourceLabel({ word: 'x' })).toBeNull();
  });
});

describe('temas y búsqueda con ~300 señas', () => {
  const themes = ['Saludos', 'Animales', 'Colores', 'Verbos', 'Lugares'];
  const signs = Array.from({ length: 320 }, (_, index) => ({
    word: `Palabra ${index}`,
    type: 'Seña',
    meaning: null,
    howTo: null,
    theme: themes[index % themes.length],
    page: null,
    source: 'Club de Sordos de Talca',
  })).concat([mineduc, club, clubBare]);

  test('los temas salen de los datos, sin repetir, con «Todos» primero y en el orden del curso', () => {
    const result = themeFilters([...signs, { word: 'ABOGADO', theme: 'Profesiones' }]);
    expect(result).toEqual([ALL_THEMES, 'Saludos', 'Colores', 'Animales', 'Verbos', 'Tiempo', 'Lugares', 'Profesiones']);
    expect(themeFilters([])).toEqual([ALL_THEMES]);
  });

  test('filtra por tema y por texto sin importar tildes ni mayúsculas', () => {
    const index = buildSearchIndex(signs);
    expect(filterSigns(index)).toHaveLength(signs.length);
    expect(filterSigns(index, { theme: 'Animales' }).every((sign) => sign.theme === 'Animales')).toBe(true);
    expect(filterSigns(index, { query: 'BUENOS DIAS' })).toEqual([club]);
    expect(filterSigns(index, { query: ' insecto ' })).toEqual([mineduc]);
    expect(filterSigns(index, { query: 'saludos', theme: 'Saludos' }).length).toBeGreaterThan(60);
    expect(filterSigns(index, { query: 'abeja', theme: 'Saludos' })).toEqual([]);
    expect(filterSigns(index, { query: 'no existe esta palabra' })).toEqual([]);
  });

  test('indexar y filtrar 300+ señas es rápido', () => {
    const start = Date.now();
    const index = buildSearchIndex(signs);
    for (let i = 0; i < 200; i += 1) filterSigns(index, { query: `palabra ${i}`, theme: ALL_THEMES });
    expect(Date.now() - start).toBeLessThan(1500);
  });

  test('normalizeText', () => {
    expect(normalizeText('Cómo ESTÁS')).toBe('como estas');
    expect(normalizeText(null)).toBe('');
  });
});

describe('señas reales por tema, en el orden del curso', () => {
  const { positionByKey } = buildClubIndex(clubTalcaClips.clips);
  const clubSign = (word, theme) => ({ word, theme, type: 'Seña', source: CLUB_SOURCE });
  const signs = [
    clubSign('10', 'Números'),
    clubSign('2', 'Números'),
    clubSign('Números', 'Números'),
    clubSign('1', 'Números'),
    { ...mineduc, word: 'ZORRO' },
    mineduc,
    clubSign('Perro', 'Animales'),
    clubSign('Animales', 'Animales'),
    { word: 'CAMINAR', theme: 'Acciones', source: null },
    { word: 'ABRAZAR', theme: 'Acciones', source: null },
    { word: 'Sin tema', theme: null, source: null },
    clubSign('Chao', 'Saludos'),
    clubSign('Hola', 'Saludos'),
  ];
  const sections = groupSignsByTheme(signs, positionByKey);

  test('temas del club en su orden, después los demás de la A a la Z y al final las señas sin tema', () => {
    const titles = sections.map((section) => section.title);
    expect(titles).toEqual(['Saludos', 'Números', 'Animales', 'Acciones', UNTHEMED]);
    expect(CLUB_THEME_ORDER.indexOf('Números')).toBeLessThan(CLUB_THEME_ORDER.indexOf('Animales'));
  });

  test('dentro del tema: primero el club en el orden del curso (números 1, 2… 10), luego el resto alfabético', () => {
    const words = (title) => sections.find((section) => section.title === title).data.map((sign) => sign.word);
    expect(words('Números')).toEqual(['Números', '1', '2', '10']);
    expect(words('Saludos')).toEqual(['Hola', 'Chao']);
    expect(words('Animales')).toEqual(['Animales', 'Perro', 'ABEJA', 'ZORRO']);
    // Una del MINEDUC con la misma palabra que una del club no se adelanta.
    expect(words('Acciones')).toEqual(['ABRAZAR', 'CAMINAR']);
  });

  test('sin datos no hay secciones, y no cambia la lista recibida', () => {
    expect(groupSignsByTheme([])).toEqual([]);
    const copy = [...signs];
    groupSignsByTheme(signs, positionByKey);
    expect(signs).toEqual(copy);
  });
});

describe('deletreo por secciones', () => {
  test('el abecedario va junto (A–Z con la Ñ), sin números deletreados', () => {
    const sections = groupSpellingEntries(DICTIONARY_ENTRIES);
    expect(sections.map((section) => section.title)).toEqual(['Abecedario', 'Acciones']);
    const letters = sections[0].data.map((entry) => entry.letter);
    expect(letters).toHaveLength(27);
    expect(letters.slice(12, 16)).toEqual(['M', 'N', 'Ñ', 'O']);
    expect(DICTIONARY_ENTRIES.some((entry) => /deletrea/i.test(entry.description))).toBe(false);
    expect(DICTIONARY_ENTRIES.some((entry) => entry.category === 'Números')).toBe(false);
  });

  test('filtra por sección y por texto, y descarta las secciones vacías', () => {
    expect(spellingFilters(DICTIONARY_ENTRIES)).toEqual([ALL_THEMES, 'Abecedario', 'Acciones']);
    expect(groupSpellingEntries(DICTIONARY_ENTRIES, { section: 'Acciones' }).map((section) => section.title)).toEqual(['Acciones']);
    const found = groupSpellingEntries(DICTIONARY_ENTRIES, { query: 'BÓCA' });
    expect(found.flatMap((section) => section.data).map((entry) => entry.letter)).toEqual(['COMER', 'HABLAR']);
    expect(groupSpellingEntries(DICTIONARY_ENTRIES, { query: 'no existe' })).toEqual([]);
  });
});
