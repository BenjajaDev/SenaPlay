import { storageKey } from '../../../core/storage/jsonStorage';

const CACHE_KEY = storageKey('remoteConfig', 'v1');

/**
 * Lee `app_config` y `feature_flags` de Supabase (lectura pública por RLS).
 *
 *   getCached()  → { configRows, flagRows, fetchedAt } | null   (instantáneo)
 *   fetch()      → { configRows, flagRows, fetchedAt, source }
 *
 * Al arrancar, la app usa la caché al instante y refresca en segundo plano:
 * así un modo mantenimiento activado recién se aplica al próximo refresco,
 * pero la app nunca espera a la red para mostrarse.
 */
export function createRemoteConfigRepository({ supabase, storage }) {
  return {
    async getCached() {
      return storage.get(CACHE_KEY, null);
    },

    async fetch() {
      try {
        const [configResult, flagsResult] = await Promise.all([
          supabase.from('app_config').select('key, value'),
          supabase.from('feature_flags').select('key, enabled, rollout_percentage, starts_at, ends_at'),
        ]);
        if (configResult.error && flagsResult.error) throw configResult.error;
        const snapshot = {
          configRows: configResult.data || [],
          flagRows: flagsResult.data || [],
          fetchedAt: Date.now(),
        };
        await storage.set(CACHE_KEY, snapshot);
        return { ...snapshot, source: 'remote' };
      } catch {
        const cached = await storage.get(CACHE_KEY, null);
        if (cached) return { ...cached, source: 'cache' };
        return { configRows: [], flagRows: [], fetchedAt: null, source: 'default' };
      }
    },
  };
}
