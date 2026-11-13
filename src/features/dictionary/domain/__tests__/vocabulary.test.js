import { OBSERVED_NOTE } from '../../../signs/domain/observedHints';
import {
  ALL_THEMES,
  buildSearchIndex,
  filterSigns,
  normalizeText,
  signSourceLabel,
  signToDetail,
  themeFilters,
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

  test('los temas salen de los datos, sin repetir y con «Todos» primero', () => {
    const result = themeFilters(signs);
    expect(result[0]).toBe(ALL_THEMES);
    expect(result.slice(1)).toEqual([...new Set(result.slice(1))].sort((a, b) => a.localeCompare(b, 'es')));
    expect(result).toEqual(expect.arrayContaining(['Animales', 'Saludos', 'Tiempo']));
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
