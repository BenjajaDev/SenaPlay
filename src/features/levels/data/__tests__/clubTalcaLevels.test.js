import clubTalcaClips from '../../../signs/data/content/clubTalcaClips.json';
import { describeSign, normalizeHint } from '../../../signs/domain/signDescription';
import { toSignKey } from '../../../signs/domain/signMedia';
import { exerciseKey } from '../../domain/exerciseRotation';
import LevelBuilder from '../../domain/LevelBuilder';
import clubTalcaLevels from '../content/clubTalcaLevels.json';
import { LEVELS_CATALOG } from '../local/levelsCatalog';

// Clips que duran más de 10 s y no se suben (se excluyen por clave y variante).
// «conversar» variante 2 sí existe, así que la clave se puede usar.
const EXCLUDED_VARIANTS = [
  ['conversar', 1],
  ['19', 1],
  ['nosotros', 1],
  ['datos-personales', 1],
  ['avion', 1],
  ['furgon', 1],
  ['puerto-montt', 1],
  ['t', 1],
];
const isExcluded = (clip) => EXCLUDED_VARIANTS.some(([key, variant]) => key === clip.key && variant === clip.variant);

const { clips } = clubTalcaClips;
const usableKeys = new Set(clips.filter((clip) => clip.kind !== 'letter' && !isExcluded(clip)).map((clip) => clip.key));

// Claves que un ejercicio muestra como seña (los textos de opciones no cuentan).
function signKeysOf(exercise) {
  const keys = [exercise.sign, ...(exercise.signs || [])];
  if (exercise.type === 'matching') keys.push(...exercise.letters);
  return keys.filter(Boolean);
}

describe('catálogo del Club de Sordos de Talca', () => {
  test('toSignKey(glosa) coincide con la clave de cada clip (salvo cafe-color)', () => {
    const mismatches = clips
      .filter((clip) => clip.key !== 'cafe-color' && toSignKey(clip.gloss) !== clip.key)
      .map((clip) => `${clip.gloss} → ${toSignKey(clip.gloss)} (esperada ${clip.key})`);
    expect(mismatches).toEqual([]);
  });

  test('no repite (clave, variante)', () => {
    const ids = clips.map((clip) => `${clip.key}#${clip.variant}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('las exclusiones existen en el catálogo y duran más de 10 s', () => {
    EXCLUDED_VARIANTS.forEach(([key, variant]) => {
      const clip = clips.find((item) => item.key === key && item.variant === variant);
      expect(clip).toBeTruthy();
      expect(clip.sourceDurationMs).toBeGreaterThan(10000);
    });
  });
});

describe('niveles nuevos (13 en adelante)', () => {
  const { levels } = clubTalcaLevels;

  test('ids únicos, sin chocar con los niveles locales, sort_order igual al id y no disponibles', () => {
    const ids = levels.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
    const local = new Set(LEVELS_CATALOG.map((level) => level.id));
    ids.forEach((id) => expect(local.has(id)).toBe(false));
    levels.forEach((level) => {
      expect(level.sort_order).toBe(level.id);
      expect(level.available).toBe(false);
    });
  });

  test.each(levels.map((level) => [level.id, level]))('nivel %s pasa LevelBuilder en modo estricto', (_id, level) => {
    const built = LevelBuilder.fromObject(level).build();
    expect(built.exercises.length).toBeGreaterThanOrEqual(6);
    expect(built.exercises.length).toBeLessThanOrEqual(8);
    // Dos ejercicios con la misma clave se descartan al sortear la sesión.
    const keys = built.exercises.map(exerciseKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('toda seña usada existe en el catálogo, no es una letra y no está excluida', () => {
    const invalid = [];
    levels.forEach((level) =>
      level.exercises.forEach((exercise) =>
        signKeysOf(exercise).forEach((key) => {
          if (!usableKeys.has(key)) invalid.push(`nivel ${level.id}: ${key}`);
        }),
      ),
    );
    expect(invalid).toEqual([]);
  });

  test('sign-choice: la respuesta es una candidata y no se repiten candidatas', () => {
    levels.forEach((level) =>
      level.exercises
        .filter((exercise) => exercise.type === 'sign-choice')
        .forEach((exercise) => {
          expect(exercise.signs).toContain(exercise.correct);
          expect(new Set(exercise.signs).size).toBe(exercise.signs.length);
        }),
    );
  });

  test('emparejar de palabras trae textos y como máximo 4 parejas', () => {
    levels.forEach((level) =>
      level.exercises
        .filter((exercise) => exercise.type === 'matching')
        .forEach((exercise) => {
          expect(exercise.labels).toHaveLength(exercise.letters.length);
          expect(exercise.letters.length).toBeLessThanOrEqual(4);
        }),
    );
  });

  describe('pistas que no filtran la respuesta', () => {
    const plain = (text) =>
      String(text ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();
    // Textos que son la respuesta del ejercicio (glosas y palabras), sin tildes.
    const answersOf = (exercise) => {
      const raw = [exercise.word, ...[].concat(exercise.correct ?? []), ...(exercise.labels || [])];
      if (exercise.type === 'sign-choice' || exercise.type === 'matching' || exercise.type === 'word-meaning') {
        raw.push(...(exercise.signs || []), ...(exercise.letters || []));
      }
      raw.push(exercise.sign, ...(exercise.signs || []));
      const shown = /significa (.+)$/.exec(exercise.statement || '')?.[1];
      if (shown) raw.push(shown);
      return raw.filter(Boolean).map((answer) => plain(answer).replace(/-/g, ' ').replace(/[¿?¡!.]/g, '').trim());
    };
    // Compara por palabras completas, sin regex: la respuesta puede traer signos.
    const contains = (text, answer) => ` ${plain(text).replace(/[^a-zñ0-9]+/g, ' ')} `.includes(` ${answer.replace(/[^a-zñ0-9]+/g, ' ').trim()} `);

    test('ningún hint contiene la respuesta, la palabra ni la glosa', () => {
      const leaks = [];
      clubTalcaLevels.levels.forEach((level) =>
        level.exercises.forEach((exercise, index) => {
          if (!exercise.hint) return;
          answersOf(exercise).forEach((answer) => {
            if (answer && contains(exercise.hint, answer)) leaks.push(`nivel ${level.id} #${index + 1}: «${answer}»`);
          });
        }),
      );
      expect(leaks).toEqual([]);
    });

    test('con una seña a la vista, siempre hay hint propio: así no cae la descripción del diccionario', () => {
      // showHint(undefined) usa normalizeHint(exercise.hint, exercise.sign); sin hint propio,
      // una seña con descripción en el diccionario mostraría una pista que la identifica.
      const unprotected = [];
      clubTalcaLevels.levels.forEach((level) =>
        level.exercises.forEach((exercise, index) => {
          if (exercise.sign && !exercise.hint && describeSign(exercise.sign)) unprotected.push(`nivel ${level.id} #${index + 1}`);
          if (exercise.hint) expect(normalizeHint(exercise.hint, exercise.sign).texto).toBe(exercise.hint);
        }),
      );
      expect(unprotected).toEqual([]);
    });
  });
});
