import { DEFAULT_SCORING } from '../../levels/domain/scoring';
import { DEFAULT_LIVES_CONFIG } from '../../progress/domain/livesPolicy';

/**
 * Configuración remota (Remote Config) y feature flags.
 *
 * Se administra desde el panel web (tablas `app_config` y `feature_flags` en
 * Supabase) y permite cambiar el comportamiento de la app SIN recompilar:
 * mantenimiento, avisos, vidas, puntaje, dificultad, versión mínima y
 * activación de módulos/eventos.
 *
 * Los DEFAULTS reproducen el comportamiento actual: si Supabase no responde o
 * una clave falta, la app funciona exactamente igual que antes.
 */

export const DEFAULT_REMOTE_CONFIG = Object.freeze({
  maintenance: { enabled: false, title: 'Estamos en mantenimiento', message: 'Volvemos en unos minutos. ¡Gracias por tu paciencia!' },
  announcements: [],
  lives: { ...DEFAULT_LIVES_CONFIG },
  scoring: { ...DEFAULT_SCORING },
  difficulty: {
    quizSecondsPerQuestion: 10,
    aiConfidenceThreshold: 0.6,
    spellingConfidenceThreshold: 0.55,
    hintsEnabled: true,
  },
  appVersion: { minimum: '1.0.0', recommended: '1.0.0', storeUrl: '' },
});

// Flags conocidos por la app (con su valor si no hay configuración remota).
export const DEFAULT_FLAGS = Object.freeze({
  'games.memory': true,
  'games.quiz': true,
  'games.practice': true,
  'games.spelling': true,
  'games.cameraTranslation': true,
  'games.dynamicMonitor': true,
  'videos.enabled': true,
  'feedback.haptics': true,
  'levels.celebration': true,
});

/** Compara versiones semver simples ('1.2.10' > '1.2.9'). */
export function compareVersions(a = '0', b = '0') {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Filas `app_config` [{ key, value }] → objeto de config fusionado con defaults. */
export function mergeRemoteConfig(rows = []) {
  const config = JSON.parse(JSON.stringify(DEFAULT_REMOTE_CONFIG));
  rows.forEach(({ key, value }) => {
    if (!(key in config) || value === undefined || value === null) return;
    config[key] = isPlainObject(config[key]) && isPlainObject(value) ? { ...config[key], ...value } : value;
  });
  return config;
}

function inWindow({ starts_at: startsAt, ends_at: endsAt, startsAt: s2, endsAt: e2 }, now) {
  const start = startsAt || s2;
  const end = endsAt || e2;
  if (start && now < new Date(start).getTime()) return false;
  if (end && now > new Date(end).getTime()) return false;
  return true;
}

// Hash estable (FNV-1a) usuario+flag → 0..99, para rollouts graduales: el
// mismo usuario siempre cae en el mismo grupo.
export function rolloutBucket(flagKey, userId = 'anon') {
  let hash = 0x811c9dc5;
  const input = `${flagKey}:${userId}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 100;
}

/** Filas `feature_flags` → { [key]: boolean } evaluado para este usuario y momento. */
export function evaluateFlags(rows = [], { userId, now = Date.now() } = {}) {
  const flags = { ...DEFAULT_FLAGS };
  rows.forEach((row) => {
    const rollout = row.rollout_percentage ?? 100;
    flags[row.key] = Boolean(row.enabled) && inWindow(row, now) && rolloutBucket(row.key, userId) < rollout;
  });
  return flags;
}

/**
 * Estado derivado que la app necesita para decidir qué mostrar:
 *   gate: 'maintenance' | 'updateRequired' | null   (bloquea la app)
 *   updateAvailable: hay versión recomendada más nueva (aviso no bloqueante)
 *   announcements: avisos vigentes ahora
 */
export function evaluateRemoteState(config, { appVersion, now = Date.now(), isAdmin = false }) {
  const minimum = config.appVersion?.minimum || '0';
  const recommended = config.appVersion?.recommended || minimum;
  const updateRequired = compareVersions(appVersion, minimum) < 0;
  const maintenance = Boolean(config.maintenance?.enabled) && !isAdmin;

  return {
    gate: maintenance ? 'maintenance' : updateRequired ? 'updateRequired' : null,
    updateAvailable: !updateRequired && compareVersions(appVersion, recommended) < 0,
    announcements: (config.announcements || []).filter((item) => item && inWindow(item, now)),
  };
}
