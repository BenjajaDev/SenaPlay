import { LEVELS_CATALOG } from '../../data/local/levelsCatalog';
import { evaluateAnswer } from '../evaluateAnswer';
import {
  canonicalLetter,
  collectSigns,
  exerciseKey,
  generateVariants,
  letterLabel,
  MIN_AUTHORED_SHARE,
  pickSessionExercises,
} from '../exerciseRotation';
import LevelBuilder from '../LevelBuilder';

// Generador pseudoaleatorio con semilla: mismas elecciones en cada corrida.
function seeded(seed = 1) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

const LEVELS = LEVELS_CATALOG.map((raw) => LevelBuilder.fromObject(raw).lenient().build());
const byId = (id) => LEVELS.find((level) => level.id === id);

/** Respuesta correcta de cualquier ejercicio (para comprobar que tiene solución). */
function correctAnswer(exercise) {
  switch (exercise.type) {
    case 'multiple-choice':
    case 'word-meaning':
      return exercise.correct;
    case 'typing':
      return exercise.answer;
    case 'true-false':
      return String(exercise.answer);
    case 'ordering':
      return exercise.letters;
    case 'recognition':
      return exercise.correct;
    case 'interpret-signs':
    case 'build-word':
      return [...exercise.word];
    default:
      return null;
  }
}

describe('rotación de ejercicios', () => {
  test('la Ñ se normaliza: n~, N~ y ñ son la misma letra y se muestran «Ñ»', () => {
    expect(canonicalLetter('n~')).toBe('ñ');
    expect(canonicalLetter('N~')).toBe('ñ');
    expect(letterLabel('n~')).toBe('Ñ');
    expect(letterLabel('hola')).toBe('HOLA');
    expect(collectSigns(byId(3)).letters).toEqual(['k', 'l', 'm', 'n', 'ñ']);
  });

  test('la clave de un ejercicio no depende de su posición ni del título', () => {
    const [matching, choice] = byId(1).exercises;
    expect(exerciseKey(choice)).toBe('multiple-choice:b');
    expect(exerciseKey({ ...choice, title: 'Otro título' })).toBe('multiple-choice:b');
    expect(exerciseKey(matching)).toBe('matching:a,b,c,d,e');
  });

  test('en alfabeto solo se usan las letras propias del nivel (no las de sus palabras)', () => {
    const tz = byId(5);
    expect(collectSigns(tz).letters).toEqual(['t', 'u', 'v', 'w', 'x', 'y', 'z']);
    generateVariants(tz, seeded(2)).forEach((exercise) => {
      const signs = [exercise.sign, ...(exercise.signs || [])].filter(Boolean);
      signs.forEach((sign) => expect('tuvwxyz').toContain(sign));
    });
  });

  test('en vocabulario y números las variantes son de palabras, nunca letras sueltas', () => {
    LEVELS.filter((level) => level.category !== 'alfabeto').forEach((level) => {
      const variants = generateVariants(level, seeded(level.id));
      expect(variants.length).toBeGreaterThan(0);
      variants.forEach((exercise) => {
        expect(['word-meaning', 'interpret-signs', 'true-false']).toContain(exercise.type);
        expect(exercise.sign).toBeUndefined();
        expect(exercise.signs.length).toBeGreaterThan(1);
      });
    });
  });

  test('los significados reutilizan los textos del nivel (con tildes)', () => {
    const food = collectSigns(byId(9)).words;
    expect(food.find((entry) => entry.word === 'CAFE').meaning).toBe('Café');
    expect(food.find((entry) => entry.word === 'AGUA').meaning).toBe('Agua');
    const numbers = collectSigns(byId(6)).words;
    expect(numbers.find((entry) => entry.word === 'TRES').meaning).toBe('Tres (3)');
  });

  test('todas las variantes de todos los niveles son válidas y tienen solución', () => {
    LEVELS.forEach((level) => {
      [1, 2, 3].forEach((seed) => {
        generateVariants(level, seeded(seed * 100 + level.id)).forEach((exercise) => {
          const verdict = evaluateAnswer(exercise, correctAnswer(exercise));
          if (verdict.status !== 'correct') throw new Error(`Nivel ${level.id}: ${exerciseKey(exercise)} sin solución`);
          if (exercise.options) expect(new Set(exercise.options).size).toBe(exercise.options.length);
        });
      });
    });
  });

  test('cada sesión: mismo largo, sin repetidos, ≥60 % escritos a mano y cambia entre intentos', () => {
    LEVELS.forEach((level) => {
      const random = seeded(level.id * 7);
      const authoredKeys = new Set(level.exercises.map(exerciseKey));
      const sessions = [1, 2, 3].map(() => pickSessionExercises(level, { random }));
      sessions.forEach((session) => {
        expect(session).toHaveLength(level.exercises.length);
        expect(new Set(session.map(exerciseKey)).size).toBe(session.length);
        const authored = session.filter((exercise) => authoredKeys.has(exerciseKey(exercise))).length;
        expect(authored).toBeGreaterThanOrEqual(Math.ceil(session.length * MIN_AUTHORED_SHARE));
      });
      const orders = new Set(sessions.map((session) => session.map(exerciseKey).join('|')));
      expect(orders.size).toBeGreaterThan(1);
    });
  });

  test('los ejercicios que el usuario falla entran primero al sorteo', () => {
    const session = pickSessionExercises(byId(1), { random: seeded(11), focusKeys: ['typing:e', 'no-existe'] });
    expect(session.map(exerciseKey)).toContain('typing:e');
  });
});
