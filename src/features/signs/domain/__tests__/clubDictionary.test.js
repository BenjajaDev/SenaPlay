import clubTalcaLevels from '../../../levels/data/content/clubTalcaLevels.json';
import clubTalcaClips from '../../data/content/clubTalcaClips.json';
import {
  buildClubSigns,
  CLUB_EXCLUDED_VARIANTS,
  CLUB_SOURCE,
  formatGloss,
  normalizeWord,
  TOPIC_THEMES,
} from '../clubDictionary';
import { toSignKey } from '../signMedia';

const { clips } = clubTalcaClips;
const build = (hints = null) => buildClubSigns({ clips, levels: clubTalcaLevels.levels, hints, toSignKey });

describe('formatGloss', () => {
  test.each([
    ['BUENOS DIAS', 'Buenos dias'],
    ['PRESENTACIÓN', 'Presentación'],
    ['¿CÓMO ESTÁS?', '¿Cómo estás?'],
    ['CABALLO / YEGUA', 'Caballo / Yegua'],
    ['CAFÉ (COLOR)', 'Café (color)'],
    ['10', '10'],
    ['NO HAY / NO TENGO / NO ESTÁ', 'No hay / No tengo / No está'],
  ])('%s → %s', (gloss, expected) => {
    expect(formatGloss(gloss)).toBe(expected);
  });

  test('ciudades: cada palabra con mayúscula salvo de, del y y', () => {
    expect(formatGloss('VIÑA DEL MAR', { proper: true })).toBe('Viña del Mar');
    expect(formatGloss('LA SERENA', { proper: true })).toBe('La Serena');
    expect(formatGloss('NORTE Y SUR', { proper: true })).toBe('Norte y Sur');
  });
});

describe('señas del club para el diccionario', () => {
  const rows = build();

  test('solo señas sueltas: ni frases ni letras, y ninguna clave excluida por completo', () => {
    const isExcluded = (clip) => CLUB_EXCLUDED_VARIANTS.some(([key, variant]) => key === clip.key && variant === clip.variant);
    const signs = clips.filter((clip) => clip.kind === 'sign');
    const usable = new Set(signs.filter((clip) => !isExcluded(clip)).map((clip) => clip.key));
    expect(rows).toHaveLength(usable.size);
    expect(usable.size).toBeLessThan(new Set(signs.map((clip) => clip.key)).size);
    const rowKeys = new Set(rows.map((row) => toSignKey(row.word)));
    usable.forEach((key) => expect(rowKeys.has(key)).toBe(true));
    clips.filter((clip) => clip.kind !== 'sign').forEach((clip) => expect(rowKeys.has(clip.key)).toBe(false));
  });

  test('cada palabra lleva de vuelta a su clip (toSignKey) y no se repite', () => {
    const keys = rows.map((row) => toSignKey(row.word));
    expect(new Set(keys).size).toBe(keys.length);
    const words = rows.map((row) => normalizeWord(row.word));
    expect(new Set(words).size).toBe(words.length);
    // «Café» (bebida) y el color no se confunden.
    expect(keys).toContain('cafe');
    expect(keys).toContain('cafe-color');
  });

  test('la palabra usa la etiqueta del nivel y corrige glosas sin tilde', () => {
    const words = rows.map((row) => row.word);
    expect(words).toContain('Buenos días');
    expect(words).toContain('Clínica');
    expect(words).toContain('Presentación');
    expect(words).toContain('Viña del Mar');
    expect(words).not.toContain('BUENOS DIAS');
    expect(words.filter((word) => /^[\p{Lu}\s]{3,}$/u.test(word))).toEqual([]);
  });

  test('tema legible, tipo «Seña», fuente del club y sin significados inventados', () => {
    const themes = new Set(Object.values(TOPIC_THEMES));
    rows.forEach((row) => {
      expect(themes.has(row.theme)).toBe(true);
      expect(row.type).toBe('Seña');
      expect(row.source).toBe(CLUB_SOURCE);
      expect(row.meaning).toBeNull();
      expect(row.page).toBeNull();
      expect(row.how_to).toBeNull();
    });
    expect(rows.length).toBeGreaterThan(250);
    expect(new Set(rows.map((row) => row.theme)).size).toBeGreaterThanOrEqual(15);
  });

  test('how_to es el texto de la pista observada cuando existe', () => {
    const hints = { pistas: { hola: { manos: 1, ubicacion: 'cerca de la frente', texto: ' Se hace con una mano. ' }, chao: { manos: 2 } } };
    const withHints = build(hints);
    expect(withHints.find((row) => row.word === 'Hola').how_to).toBe('Se hace con una mano.');
    expect(withHints.find((row) => row.word === 'Chao').how_to).toBeNull();
  });
});
