import { withTimeout } from '../../../core/net/withTimeout';
import { storageKey } from '../../../core/storage/jsonStorage';

const CACHE_KEY = storageKey('remoteConfig', 'v1');

// Deben coincidir con web/src/data/repositories.ts (REMOTE_CONFIG_*).
export const REMOTE_CONFIG_CHANNEL = 'remote-config';
export const REMOTE_CONFIG_EVENT = 'changed';

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
          withTimeout(supabase.from('app_config').select('key, value')),
          withTimeout(supabase.from('feature_flags').select('key, enabled, rollout_percentage, starts_at, ends_at')),
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

    /**
     * Avisa cuando el panel cambia la configuración, para aplicarla en
     * segundos y no recién al reabrir la app. Dos vías sobre un mismo canal:
     *
     *   broadcast «changed»   lo envía el panel al publicar (no depende de la
     *                         publicación de Realtime ni de RLS)
     *   postgres_changes      cambios en app_config / feature_flags hechos
     *                         por cualquier medio (migración 008)
     *
     *   onChange(reason)          'changed' (llegó un cambio) | 'reconnected'
     *                             (el canal volvió: puede haberse perdido algo)
     *   onConnectionChange(bool)  true mientras el canal está suscrito; con él
     *                             caído, quien llama debe sondear
     *
     * Devuelve la función para desuscribirse. Sin Realtime no hace nada y
     * nunca reporta conexión: el sondeo periódico cubre ese caso.
     */
    subscribe(onChange, onConnectionChange = () => {}) {
      if (!supabase?.channel) return () => {};
      try {
        const changed = () => onChange('changed');
        const channel = supabase
          .channel(REMOTE_CONFIG_CHANNEL)
          .on('broadcast', { event: REMOTE_CONFIG_EVENT }, changed)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, changed)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'feature_flags' }, changed)
          .subscribe((status) => {
            const connected = status === 'SUBSCRIBED';
            onConnectionChange(connected);
            if (connected) onChange('reconnected');
          });
        return () => {
          onConnectionChange(false);
          supabase.removeChannel(channel);
        };
      } catch {
        return () => {};
      }
    },
  };
}
