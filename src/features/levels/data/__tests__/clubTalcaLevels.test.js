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

  describe('distractores y posición de la respuesta', () => {
    const ofType = (type) => levels.flatMap((level) => level.exercises.filter((exercise) => exercise.type === type).map((exercise) => ({ level, exercise })));
    const plainWord = (text) => toSignKey(text);

    test('recognition: las opciones no son iguales a las correctas y hay al menos 2 distractores', () => {
      const items = ofType('recognition');
      expect(items).toHaveLength(18);
      items.forEach(({ level, exercise }) => {
        const distractors = exercise.options.filter((option) => !exercise.correct.includes(option));
        expect(distractors.length).toBeGreaterThanOrEqual(2);
        expect(distractors.length).toBeLessThanOrEqual(3);
        expect(new Set(exercise.options).size).toBe(exercise.options.length);
        exercise.correct.forEach((answer) => expect(exercise.options).toContain(answer));
        expect(exercise.title).toBe('Marca todas las palabras que corresponden a estas señas');
        // Un distractor nunca es la palabra de una seña que se muestra.
        const shown = new Set(exercise.signs);
        distractors.forEach((word) => expect(shown.has(plainWord(word))).toBe(false));
        expect(level.id).toBeGreaterThan(12);
      });
    });

    test('recognition: los distractores son palabras del mismo nivel', () => {
      ofType('recognition').forEach(({ level, exercise }) => {
        const levelKeys = new Set(
          level.exercises.flatMap((other) => [other.sign, ...(other.signs || []), ...(other.type === 'matching' ? other.letters : [])]).filter(Boolean),
        );
        exercise.options
          .filter((option) => !exercise.correct.includes(option))
          .forEach((word) => {
            const key = plainWord(word.split(' / ')[0]);
            // «Café» es la etiqueta de la seña «cafe-color» en el nivel de colores.
            expect(levelKeys.has(key) || (level.id === 18 && key === 'cafe')).toBe(true);
          });
      });
    });

    test('recognition: los distractores no quedan siempre al final', () => {
      const atTheEnd = ofType('recognition').filter(({ exercise }) =>
        exercise.options.slice(-2).every((option) => !exercise.correct.includes(option)),
      );
      expect(atTheEnd.length).toBeLessThan(ofType('recognition').length / 2);
    });

    test.each([
      ['word-meaning', (exercise) => exercise.options],
      ['sign-choice', (exercise) => exercise.signs],
    ])('%s: opciones sin repetir, con la respuesta y repartida en todas las posiciones', (type, optionsOf) => {
      const counts = {};
      ofType(type).forEach(({ exercise }) => {
        const options = optionsOf(exercise);
        expect(new Set(options).size).toBe(options.length);
        expect(options.indexOf(exercise.correct)).toBeGreaterThanOrEqual(0);
        const position = options.indexOf(exercise.correct);
        counts[position] = (counts[position] || 0) + 1;
      });
      expect(Object.keys(counts)).toHaveLength(3);
      Object.values(counts).forEach((count) => expect(count).toBeLessThanOrEqual(18));
    });

    test('word-meaning de una palabra: los distractores son otras señas del club, no la respuesta', () => {
      ofType('word-meaning')
        .filter(({ exercise }) => exercise.signs.length === 1 && usableKeys.has(exercise.signs[0]) && !exercise.title.includes('frase'))
        .forEach(({ exercise }) => {
          const wrong = exercise.options.filter((option) => option !== exercise.correct);
          expect(wrong).toHaveLength(exercise.options.length - 1);
          wrong.forEach((option) => expect(usableKeys.has(plainWord(option))).toBe(true));
        });
    });

    test('true-false: la afirmación verdadera nombra la seña y la falsa nombra otra del mismo nivel', () => {
      ofType('true-false').forEach(({ level, exercise }) => {
        const named = plainWord(/significa (.+)$/.exec(exercise.statement)[1]);
        const levelKeys = new Set(level.exercises.flatMap((other) => [other.sign, ...(other.signs || []), ...(other.letters || [])]).filter(Boolean));
        if (exercise.answer) expect(named).toBe(exercise.sign);
        else {
          expect(named).not.toBe(exercise.sign);
          expect(levelKeys.has(named)).toBe(true);
        }
      });
    });
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
