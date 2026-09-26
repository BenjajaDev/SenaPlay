import { evaluateAnswer } from '../evaluateAnswer';
import { collectSigns, exerciseKey, generateVariants, pickSessionExercises } from '../exerciseRotation';
import LevelBuilder from '../LevelBuilder';

// Generador pseudoaleatorio con semilla: mismas elecciones en cada corrida.
function seeded(seed = 1) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

const letters = new LevelBuilder(1)
  .title('Letras A-E')
  .addExercise({ type: 'matching', letters: ['a', 'b', 'c', 'd', 'e'] })
  .addExercise({ type: 'multiple-choice', sign: 'b', options: ['A', 'B', 'D'], correct: 'B' })
  .addExercise({ type: 'ordering', letters: ['A', 'B', 'C', 'D', 'E'] })
  .addExercise({ type: 'typing', sign: 'e', answer: 'E' })
  .addExercise({ type: 'true-false', statement: 'La A es un puño', answer: true })
  .addExercise({ type: 'multiple-choice', sign: 'c', options: ['A', 'C', 'E'], correct: 'C' })
  .build();

const words = new LevelBuilder(9)
  .title('Saludos')
  .category('vocabulario')
  .addExercise({ type: 'word-meaning', signs: ['hola'], options: ['Hola', 'Chao'], correct: 'Hola' })
  .addExercise({ type: 'word-meaning', signs: ['chao'], options: ['Hola', 'Chao'], correct: 'Chao' })
  .addExercise({ type: 'true-false', statement: 'Gracias se hace con una mano', answer: true, sign: 'gracias' })
  .build();

describe('rotación de ejercicios', () => {
  test('la clave de un ejercicio no depende de su posición', () => {
    expect(exerciseKey(letters.exercises[1])).toBe('multiple-choice:b');
    expect(exerciseKey({ ...letters.exercises[1], title: 'Otro título' })).toBe('multiple-choice:b');
    expect(exerciseKey(letters.exercises[0])).toBe('matching:a,b,c,d,e');
  });

  test('reúne letras y palabras del nivel', () => {
    expect(collectSigns(letters).letters.sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(collectSigns(words).words.sort()).toEqual(['chao', 'gracias', 'hola']);
  });

  test('las variantes generadas son válidas y tienen solución', () => {
    const variants = [...generateVariants(letters, seeded(3)), ...generateVariants(words, seeded(5))];
    expect(variants.length).toBeGreaterThan(10);
    expect(new Set(variants.map((exercise) => exercise.type))).toEqual(
      new Set(['multiple-choice', 'typing', 'true-false', 'ordering', 'word-meaning']),
    );
    variants.forEach((exercise) => {
      const answer = {
        'multiple-choice': exercise.correct,
        'word-meaning': exercise.correct,
        typing: exercise.answer,
        'true-false': String(exercise.answer),
        ordering: exercise.letters,
      }[exercise.type];
      expect(evaluateAnswer(exercise, answer).status).toBe('correct');
    });
  });

  test('cada sesión tiene el mismo largo, sin repetidos y con variedad de tipos', () => {
    const random = seeded(7);
    const first = pickSessionExercises(letters, { random });
    const second = pickSessionExercises(letters, { random });
    [first, second].forEach((session) => {
      expect(session).toHaveLength(letters.exercises.length);
      expect(new Set(session.map(exerciseKey)).size).toBe(session.length);
      expect(new Set(session.map((exercise) => exercise.type)).size).toBeGreaterThanOrEqual(4);
      session.slice(1).forEach((exercise, index) => {
        if (exercise.type === session[index].type) {
          // Solo se permite repetir tipo seguido si no quedaba otra opción.
          expect(session.slice(index + 1).every((item) => item.type === exercise.type)).toBe(true);
        }
      });
    });
    expect(first.map(exerciseKey)).not.toEqual(second.map(exerciseKey));
  });

  test('los ejercicios que el usuario falla entran primero al sorteo', () => {
    const session = pickSessionExercises(letters, { random: seeded(11), focusKeys: ['typing:e', 'no-existe'] });
    expect(session.map(exerciseKey)).toContain('typing:e');
  });
});
