// Reglas de progreso entre niveles (desbloqueo y mejor resultado). Pura: la
// persistencia la hace ProgressRepository.

export const DEFAULT_LEVEL_PROGRESS = Object.freeze({ unlocked: [1], completed: {} });

export function normalizeLevelProgress(raw) {
  if (!raw || !Array.isArray(raw.unlocked) || typeof raw.completed !== 'object' || raw.completed === null) {
    return { unlocked: [...DEFAULT_LEVEL_PROGRESS.unlocked], completed: {} };
  }
  return { unlocked: [...new Set(raw.unlocked.map(Number))].sort((a, b) => a - b), completed: { ...raw.completed } };
}

/**
 * Registra un nivel completado: lo marca, desbloquea el siguiente disponible
 * y conserva el MEJOR resultado (repetir un nivel y sacar menos no borra el
 * récord anterior).
 */
export function completeLevel(progress, { levelId, score, hits, fails, stars = 0 }, nextLevel) {
  const base = normalizeLevelProgress(progress);
  const unlocked = new Set(base.unlocked);
  unlocked.add(levelId);
  if (nextLevel?.available) unlocked.add(nextLevel.id);

  const previous = base.completed[levelId];
  const best = !previous || score >= (previous.score ?? 0) ? { score, hits, fails, stars } : previous;

  return {
    unlocked: Array.from(unlocked).sort((a, b) => a - b),
    completed: { ...base.completed, [levelId]: { ...best, stars: Math.max(stars, previous?.stars ?? 0) } },
  };
}

export function isLevelUnlocked(progress, levelId) {
  return normalizeLevelProgress(progress).unlocked.includes(levelId);
}
