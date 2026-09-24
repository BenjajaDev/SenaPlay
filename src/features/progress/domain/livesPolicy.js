// Política de vidas, configurable remotamente (`lives` en app_config):
//
//  mode 'session' (default): cada nivel empieza con `maxLives`; perderlas solo
//                  reinicia ese nivel. Es el comportamiento original.
//  mode 'pool':    las vidas son globales y se recargan de a una cada
//                  `refillMinutes`. Sin vidas no se puede empezar un nivel
//                  hasta que se recargue alguna (mecánica tipo Duolingo).
//
// Todo es puro y recibe `now` (ms) para poder testearlo.

export const DEFAULT_LIVES_CONFIG = Object.freeze({ mode: 'session', maxLives: 3, refillMinutes: 20 });

export function resolveLivesConfig(config) {
  const merged = { ...DEFAULT_LIVES_CONFIG, ...(config || {}) };
  return {
    mode: merged.mode === 'pool' ? 'pool' : 'session',
    maxLives: Math.max(1, Math.min(10, Number(merged.maxLives) || DEFAULT_LIVES_CONFIG.maxLives)),
    refillMinutes: Math.max(1, Number(merged.refillMinutes) || DEFAULT_LIVES_CONFIG.refillMinutes),
  };
}

/**
 * Estado actual del pool tras aplicar las recargas pendientes.
 * state = { lives, updatedAt } → { lives, updatedAt, nextRefillAt | null }
 */
export function refillLives(state, config, now) {
  const { maxLives, refillMinutes } = resolveLivesConfig(config);
  const refillMs = refillMinutes * 60 * 1000;
  const lives = Math.min(maxLives, Math.max(0, state?.lives ?? maxLives));
  const updatedAt = state?.updatedAt ?? now;

  if (lives >= maxLives) return { lives: maxLives, updatedAt: now, nextRefillAt: null };

  const gained = Math.floor((now - updatedAt) / refillMs);
  const nextLives = Math.min(maxLives, lives + Math.max(0, gained));
  if (nextLives >= maxLives) return { lives: maxLives, updatedAt: now, nextRefillAt: null };

  const nextUpdatedAt = updatedAt + Math.max(0, gained) * refillMs;
  return { lives: nextLives, updatedAt: nextUpdatedAt, nextRefillAt: nextUpdatedAt + refillMs };
}

/** Descuenta vidas del pool (al fallar en un nivel). */
export function consumeLives(state, amount, config, now) {
  const current = refillLives(state, config, now);
  const lives = Math.max(0, current.lives - amount);
  // Si estaba lleno, el reloj de recarga arranca ahora.
  const updatedAt = current.nextRefillAt === null ? now : current.updatedAt;
  return refillLives({ lives, updatedAt }, config, now);
}

/** Vidas con las que empieza una sesión de nivel según el modo. */
export function livesForSession(poolState, config, now) {
  const resolved = resolveLivesConfig(config);
  if (resolved.mode === 'session') return resolved.maxLives;
  return refillLives(poolState, resolved, now).lives;
}
