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

// Orden del catálogo: sort_order (o id si falta) y, en empate, el id.
const compareByCatalogOrder = (a, b) =>
  (a.sortOrder ?? a.sort_order ?? a.id) - (b.sortOrder ?? b.sort_order ?? b.id) || a.id - b.id;

/**
 * Número visible de cada nivel (1, 2, 3…) según su POSICIÓN en el catálogo, no
 * según su id: los ids no se renumeran (el progreso guardado los usa) y pueden
 * tener saltos. Numera todos los niveles, también los no disponibles, porque la
 * grilla los muestra como bloqueados y la secuencia no debe tener huecos.
 * Devuelve un Map id → número; quien consulte usa el id si falta.
 */
export function numerarNiveles(levels) {
  const ordered = [...(Array.isArray(levels) ? levels : [])].filter((level) => level && level.id != null).sort(compareByCatalogOrder);
  return new Map(ordered.map((level, index) => [level.id, index + 1]));
}

/**
 * Ids desbloqueados según el catálogo actual. `completeLevel` solo desbloquea
 * el siguiente si ya estaba disponible; si un admin activa niveles después,
 * quien ya completó el último nunca los vería. Por eso un nivel disponible
 * también está desbloqueado cuando el nivel disponible anterior (en el orden
 * del catálogo) está completado. Se calcula al leer: no se persiste.
 */
export function resolveUnlockedIds(levels, progress) {
  const base = normalizeLevelProgress(progress);
  const unlocked = new Set(base.unlocked);
  const ordered = [...(Array.isArray(levels) ? levels : [])].filter((level) => level?.available).sort(compareByCatalogOrder);
  ordered.forEach((level, index) => {
    const previous = ordered[index - 1];
    if (previous && base.completed[previous.id]) unlocked.add(level.id);
  });
  return [...unlocked].sort((a, b) => a - b);
}
