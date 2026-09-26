/**
 * Errores frecuentes (JS puro).
 *
 * Resumen local por usuario: { [levelId|exerciseKey]: entrada }, con cuántas
 * veces falló cada ejercicio, cuántas de esas lo dejaron sin vidas y qué
 * respondió más seguido. Alimenta la sección «Tus errores frecuentes» de
 * Progreso y el sorteo de ejercicios (los que más cuestan vuelven primero).
 */

const MAX_ENTRIES = 150;
const MAX_ANSWERS = 5;

export const mistakeId = (levelId, key) => `${levelId}|${key}`;

/** Respuesta del usuario → texto corto legible («D», «Verdadero», «HOLA»). */
export function describeAnswer(answer) {
  if (answer === null || answer === undefined || answer === '') return null;
  if (answer === true || answer === 'true') return 'Verdadero';
  if (answer === false || answer === 'false') return 'Falso';
  if (Array.isArray(answer)) {
    const parts = answer.filter((item) => typeof item === 'string' && item);
    return parts.length ? parts.join(parts.every((item) => item.length === 1) ? '' : ' ').slice(0, 120) : null;
  }
  return typeof answer === 'string' ? answer.trim().slice(0, 120) || null : null;
}

export function addMistake(summary = {}, mistake, now = Date.now()) {
  const id = mistakeId(mistake.levelId, mistake.exerciseKey);
  const previous = summary[id] || {
    levelId: mistake.levelId,
    exerciseKey: mistake.exerciseKey,
    type: mistake.type,
    title: mistake.title || null,
    sign: mistake.sign || null,
    count: 0,
    gameOvers: 0,
    answers: {},
  };
  const answers = { ...previous.answers };
  if (mistake.given) answers[mistake.given] = (answers[mistake.given] || 0) + 1;
  // Solo se guardan las respuestas más repetidas, para no crecer sin límite.
  const trimmedAnswers = Object.fromEntries(
    Object.entries(answers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_ANSWERS),
  );

  const next = {
    ...summary,
    [id]: {
      ...previous,
      title: mistake.title || previous.title,
      sign: mistake.sign || previous.sign,
      count: previous.count + 1,
      gameOvers: previous.gameOvers + (mistake.gameOver ? 1 : 0),
      answers: trimmedAnswers,
      lastAt: now,
    },
  };

  const ids = Object.keys(next);
  if (ids.length <= MAX_ENTRIES) return next;
  // Se descartan los más antiguos.
  const keep = new Set(ids.sort((a, b) => (next[b].lastAt || 0) - (next[a].lastAt || 0)).slice(0, MAX_ENTRIES));
  return Object.fromEntries(Object.entries(next).filter(([key]) => keep.has(key)));
}

/** Los más fallados primero (a igual cantidad, el más reciente). */
export function topMistakes(summary = {}, { limit = 5, levelId } = {}) {
  return Object.values(summary)
    .filter((entry) => levelId === undefined || entry.levelId === levelId)
    .sort((a, b) => b.count - a.count || (b.lastAt || 0) - (a.lastAt || 0))
    .slice(0, limit)
    .map((entry) => {
      const [topAnswer] = Object.entries(entry.answers || {}).sort((a, b) => b[1] - a[1]);
      return { ...entry, topAnswer: topAnswer ? topAnswer[0] : null };
    });
}
