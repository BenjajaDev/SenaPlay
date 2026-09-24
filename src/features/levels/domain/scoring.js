// Reglas de puntaje. Los valores por defecto replican la fórmula original y
// se pueden ajustar desde la configuración remota (`scoring` en app_config)
// sin publicar una nueva versión de la app.

export const DEFAULT_SCORING = Object.freeze({
  hitPoints: 100,
  failPenalty: 30,
  lifeBonus: 20,
  hintPenalty: 5,
  // Umbrales de estrellas como fracción del puntaje máximo posible.
  starThresholds: [0.4, 0.7, 0.9],
});

export function computeScore({ hits = 0, fails = 0, lives = 0, hintsUsed = 0 }, rules = DEFAULT_SCORING) {
  const r = { ...DEFAULT_SCORING, ...rules };
  return Math.max(0, hits * r.hitPoints - fails * r.failPenalty + lives * r.lifeBonus - hintsUsed * r.hintPenalty);
}

export function maxScore({ totalExercises = 0, maxLives = 3 }, rules = DEFAULT_SCORING) {
  const r = { ...DEFAULT_SCORING, ...rules };
  return totalExercises * r.hitPoints + maxLives * r.lifeBonus;
}

/** 0 a 3 estrellas según el puntaje relativo al máximo posible. */
export function computeStars(score, context, rules = DEFAULT_SCORING) {
  const r = { ...DEFAULT_SCORING, ...rules };
  const max = maxScore(context, r);
  if (!max) return 0;
  const ratio = score / max;
  return r.starThresholds.filter((threshold) => ratio >= threshold).length;
}
