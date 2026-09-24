import { storageKey } from '../../../core/storage/jsonStorage';
import { DEFAULT_LEVEL_PROGRESS, normalizeLevelProgress } from '../../levels/domain/levelProgress';
import { EMPTY_STATS, registerActivity, toLocalISODate } from '../domain/streak';

/**
 * Repositorio de progreso del usuario (niveles, racha y vidas), persistido en
 * el dispositivo por usuario (`senaplay.level.progress.v1.<id>`,
 * `senaplay.stats.v1.<id>`). Las claves antiguas `oratiolingo.*` se migran al
 * iniciar la app (core/storage/migrateLegacyStorage), sin perder progreso.
 */
export function createProgressRepository({ storage }) {
  const progressKey = (userId) => storageKey('level.progress', 'v1', userId);
  const statsKey = (userId) => storageKey('stats', 'v1', userId);
  const livesKey = (userId) => storageKey('lives', 'v1', userId);

  const repository = {
    async getLevelProgress(userId) {
      if (!userId) return normalizeLevelProgress(DEFAULT_LEVEL_PROGRESS);
      return normalizeLevelProgress(await storage.get(progressKey(userId), null));
    },

    async saveLevelProgress(userId, progress) {
      if (!userId) return false;
      return storage.set(progressKey(userId), normalizeLevelProgress(progress));
    },

    async getStats(userId) {
      if (!userId) return { ...EMPTY_STATS };
      return { ...EMPTY_STATS, ...(await storage.get(statsKey(userId), {})) };
    },

    async recordDailyActivity(userId, today = toLocalISODate()) {
      const current = await repository.getStats(userId);
      const next = registerActivity(current, today);
      if (next !== current && userId) await storage.set(statsKey(userId), next);
      return next;
    },

    async getLivesState(userId) {
      return storage.get(livesKey(userId || 'anon'), null);
    },

    async saveLivesState(userId, state) {
      return storage.set(livesKey(userId || 'anon'), state);
    },
  };

  return repository;
}
