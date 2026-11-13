import { evaluateAnswer } from '../evaluateAnswer';
import ExerciseFactory from '../ExerciseFactory';
import { isWordMatching } from '../exerciseTypes';
import { exerciseKey, collectSigns } from '../exerciseRotation';
import { completeLevel, resolveUnlockedIds } from '../levelProgress';

const SIGN_CHOICE = { type: 'sign-choice', word: 'PERRO', signs: ['perro', 'gato', 'caballo'], correct: 'perro' };

describe('sign-choice', () => {
  test('lo acepta con 2 a 4 señas y la respuesta entre ellas', () => {
    expect(ExerciseFactory.validate(SIGN_CHOICE).valid).toBe(true);
    expect(ExerciseFactory.validate({ ...SIGN_CHOICE, signs: ['perro'] }).valid).toBe(false);
    expect(ExerciseFactory.validate({ ...SIGN_CHOICE, signs: ['a', 'b', 'c', 'd', 'e'], correct: 'a' }).valid).toBe(false);
    expect(ExerciseFactory.validate({ ...SIGN_CHOICE, correct: 'oso' }).valid).toBe(false);
    expect(ExerciseFactory.validate({ ...SIGN_CHOICE, word: undefined }).valid).toBe(false);
  });

  test('se evalúa por la clave elegida; sin elegir no cuesta vida', () => {
    const exercise = ExerciseFactory.create(SIGN_CHOICE);
    expect(evaluateAnswer(exercise, '').status).toBe('incomplete');
    expect(evaluateAnswer(exercise, undefined).status).toBe('incomplete');
    expect(evaluateAnswer(exercise, 'perro').status).toBe('correct');
    expect(evaluateAnswer(exercise, 'gato').status).toBe('incorrect');
  });

  test('no genera variantes de palabra ni choca por clave con otros ejercicios', () => {
    const exercise = ExerciseFactory.create(SIGN_CHOICE);
    expect(collectSigns({ exercises: [exercise] }).words).toEqual([]);
    expect(exerciseKey(exercise)).toBe('sign-choice:perro');
  });
});

describe('matching con palabras', () => {
  test('labels debe tener el mismo largo que letters', () => {
    const base = { type: 'matching', letters: ['perro', 'gato'] };
    expect(ExerciseFactory.validate({ ...base, labels: ['Perro', 'Gato'] }).valid).toBe(true);
    expect(ExerciseFactory.validate({ ...base, labels: ['Perro'] }).valid).toBe(false);
  });

  test('admite como máximo 4 parejas de palabras, pero no limita las letras', () => {
    const words = ['a1', 'b1', 'c1', 'd1', 'e1'];
    expect(ExerciseFactory.validate({ type: 'matching', letters: words, labels: words }).valid).toBe(false);
    expect(ExerciseFactory.validate({ type: 'matching', letters: ['a', 'b', 'c', 'd', 'e', 'f'] }).valid).toBe(true);
  });

  test('isWordMatching: palabras o labels sí; letras (incluida n~) no', () => {
    expect(isWordMatching({ letters: ['a', 'b'] })).toBe(false);
    expect(isWordMatching({ letters: ['a', 'n~'] })).toBe(false);
    expect(isWordMatching({ letters: ['perro', 'gato'] })).toBe(true);
    expect(isWordMatching({ letters: ['1', '2'], labels: ['1', '2'] })).toBe(true);
  });
});

describe('resolveUnlockedIds', () => {
  const levels = [
    { id: 1, available: true, sortOrder: 1 },
    { id: 2, available: true, sortOrder: 2 },
    { id: 3, available: true, sortOrder: 3 },
    { id: 4, available: false, sortOrder: 4 },
  ];
  const done = { score: 10, hits: 1, fails: 0, stars: 1 };

  test('respeta lo ya desbloqueado y desbloquea el nivel disponible tras uno completado', () => {
    const progress = { unlocked: [1, 2], completed: { 1: done, 2: done } };
    expect(resolveUnlockedIds(levels, progress)).toEqual([1, 2, 3]);
  });

  test('un nivel activado después se desbloquea para quien ya completó el anterior', () => {
    const before = completeLevel({ unlocked: [1], completed: {} }, { levelId: 3, score: 5, hits: 1, fails: 0 }, { id: 4, available: false });
    expect(before.unlocked).not.toContain(4);
    const after = [...levels.slice(0, 3), { id: 4, available: true, sortOrder: 4 }];
    expect(resolveUnlockedIds(after, before)).toContain(4);
  });

  test('no desbloquea si el anterior no está completado ni salta niveles no disponibles', () => {
    expect(resolveUnlockedIds(levels, { unlocked: [1], completed: {} })).toEqual([1]);
    const gap = [{ id: 1, available: true }, { id: 2, available: false }, { id: 3, available: true }];
    expect(resolveUnlockedIds(gap, { unlocked: [1], completed: { 1: done } })).toEqual([1, 3]);
  });

  test('sin progreso deja el primer nivel', () => {
    expect(resolveUnlockedIds(levels, null)).toEqual([1]);
  });
});
