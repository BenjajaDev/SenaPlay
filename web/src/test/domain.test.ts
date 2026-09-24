import { describe, expect, test } from 'vitest';
import { compareVersions, EXERCISE_TYPE_KEYS, EXERCISE_TYPES, ExerciseFactory, mergeRemoteConfig, toUserMessage } from '@/lib/domain';

// El portal reutiliza el dominio de la app: estas pruebas fallan si el
// puente tipado deja de apuntar al código compartido.
describe('dominio compartido con la app móvil', () => {
  test('expone los 9 tipos de ejercicio con sus campos', () => {
    expect(EXERCISE_TYPE_KEYS).toHaveLength(9);
    expect(EXERCISE_TYPES['multiple-choice'].fields.correct).toMatchObject({ type: 'choice', of: 'options' });
  });

  test('ExerciseFactory valida igual que en la app', () => {
    expect(ExerciseFactory.validate({ type: 'typing', sign: 'a', answer: 'A' }).valid).toBe(true);
    expect(ExerciseFactory.validate({ type: 'typing', sign: 'a' }).error).toMatch(/answer/);
  });

  test('config remota y utilidades', () => {
    expect(mergeRemoteConfig([{ key: 'lives', value: { mode: 'pool' } }]).lives).toEqual({ mode: 'pool', maxLives: 3, refillMinutes: 20 });
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(toUserMessage({ message: 'permission denied for table levels' })).toMatch(/permisos/);
  });
});
