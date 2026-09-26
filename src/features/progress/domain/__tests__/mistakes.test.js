import { createJsonStorage } from '../../../../core/storage/jsonStorage';
import { createMistakesRepository } from '../../data/MistakesRepository';
import { addMistake, describeAnswer, topMistakes } from '../mistakes';

const base = { levelId: 1, exerciseKey: 'multiple-choice:b', type: 'multiple-choice', title: '¿Qué letra es?', sign: 'b' };

function memoryBackend() {
  const data = new Map();
  return {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => data.set(key, value),
    removeItem: async (key) => data.delete(key),
  };
}

describe('errores frecuentes', () => {
  test('describe las respuestas de forma legible', () => {
    expect(describeAnswer('D')).toBe('D');
    expect(describeAnswer('true')).toBe('Verdadero');
    expect(describeAnswer(false)).toBe('Falso');
    expect(describeAnswer(['H', 'O', 'L', 'A'])).toBe('HOLA');
    expect(describeAnswer(['Hola', 'Chao'])).toBe('Hola Chao');
    expect(describeAnswer(null)).toBeNull();
  });

  test('cuenta errores, sin vidas y la respuesta más repetida', () => {
    let summary = addMistake({}, { ...base, given: 'D' }, 1);
    summary = addMistake(summary, { ...base, given: 'D', gameOver: true }, 2);
    summary = addMistake(summary, { ...base, given: 'A' }, 3);
    summary = addMistake(summary, { ...base, exerciseKey: 'typing:e', type: 'typing', given: 'F' }, 4);

    const [first, second] = topMistakes(summary);
    expect(first).toMatchObject({ exerciseKey: 'multiple-choice:b', count: 3, gameOvers: 1, topAnswer: 'D' });
    expect(second).toMatchObject({ exerciseKey: 'typing:e', count: 1 });
    expect(topMistakes(summary, { levelId: 2 })).toEqual([]);
  });

  test('el repositorio guarda en local y deja en cola lo que no pudo enviar', async () => {
    let online = false;
    const insert = jest.fn(async () => (online ? { error: null } : { error: { message: 'network request failed' } }));
    const repository = createMistakesRepository({
      supabase: { from: () => ({ insert }) },
      storage: createJsonStorage(memoryBackend()),
    });

    await repository.record('u1', { ...base, given: 'D', gameOver: true });
    expect(await repository.getFrequent('u1')).toEqual([expect.objectContaining({ count: 1, topAnswer: 'D' })]);
    expect(await repository.focusKeys('u1', 1)).toEqual(['multiple-choice:b']);

    online = true;
    await repository.record('u1', { ...base, given: 'A' });
    // La segunda vez se envían juntos el pendiente y el nuevo.
    expect(insert).toHaveBeenLastCalledWith([
      expect.objectContaining({ level_id: 1, exercise_key: 'multiple-choice:b', given_answer: 'D', game_over: true }),
      expect.objectContaining({ given_answer: 'A', game_over: false }),
    ]);
  });
});
