import { storageKey } from '../../../core/storage/jsonStorage';
import { addMistake, topMistakes } from '../domain/mistakes';

const MAX_QUEUE = 200;

/**
 * Errores por ejercicio (patrón Repository), local primero:
 *
 *   record(userId, mistake)          guarda en el resumen local y envía a
 *                                    Supabase (tabla exercise_mistakes); sin
 *                                    red, queda en cola y se reintenta.
 *   getFrequent(userId, { limit })   → errores más frecuentes (para Progreso)
 *   focusKeys(userId, levelId)       → claves a repasar en ese nivel
 *   flush(userId)                    envía la cola pendiente
 *
 * mistake = { levelId, exerciseKey, type, title, sign, given, gameOver }
 * Nunca lanza: un fallo de red no debe interrumpir el nivel.
 */
export function createMistakesRepository({ supabase, storage }) {
  const summaryKey = (userId) => storageKey('mistakes', 'v1', userId);
  const queueKey = (userId) => storageKey('mistakes.queue', 'v1', userId);
  // Las escrituras se encadenan para que dos errores seguidos no se pisen.
  let chain = Promise.resolve();
  const serial = (task) => {
    chain = chain.then(task, task);
    return chain;
  };

  const toRow = (mistake) => ({
    level_id: mistake.levelId,
    exercise_key: mistake.exerciseKey,
    exercise_type: mistake.type,
    exercise_title: mistake.title || null,
    sign: mistake.sign || null,
    given_answer: mistake.given || null,
    game_over: Boolean(mistake.gameOver),
  });

  const send = async (rows) => {
    if (!rows.length) return true;
    try {
      const { error } = await supabase.from('exercise_mistakes').insert(rows);
      return !error;
    } catch {
      return false;
    }
  };

  const flush = (userId) =>
    serial(async () => {
      if (!userId) return;
      const queue = await storage.get(queueKey(userId), []);
      if (queue.length && (await send(queue))) await storage.set(queueKey(userId), []);
    });

  return {
    record(userId, mistake) {
      if (!userId || !mistake?.exerciseKey) return Promise.resolve();
      return serial(async () => {
        const summary = await storage.get(summaryKey(userId), {});
        await storage.set(summaryKey(userId), addMistake(summary, mistake));
        const queue = await storage.get(queueKey(userId), []);
        const pending = [...queue, toRow(mistake)];
        if (await send(pending)) await storage.set(queueKey(userId), []);
        else await storage.set(queueKey(userId), pending.slice(-MAX_QUEUE));
      });
    },

    async getFrequent(userId, { limit = 5, levelId } = {}) {
      if (!userId) return [];
      return topMistakes(await storage.get(summaryKey(userId), {}), { limit, levelId });
    },

    async focusKeys(userId, levelId, limit = 3) {
      if (!userId) return [];
      const top = topMistakes(await storage.get(summaryKey(userId), {}), { limit, levelId });
      return top.map((entry) => entry.exerciseKey);
    },

    flush,
  };
}
