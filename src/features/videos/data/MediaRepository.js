import { createCachedResource } from '../../../core/data/cachedResource';
import { withTimeout } from '../../../core/net/withTimeout';
import { storageKey } from '../../../core/storage/jsonStorage';

const CACHE_KEY = storageKey('media', 'v1');

/**
 * Recursos multimedia administrados desde el Gestor de Medios del panel web
 * (tabla `media` + bucket `media` de Storage). La app solo ve los publicados.
 * Misma estrategia remoto → caché que el catálogo, con una diferencia: una
 * lista vacía es válida. Si el panel despublica o borra todos los videos,
 * la app deja de mostrarlos (y la pantalla avisa que aquí se añadirán). Sin
 * red ni caché no se inventan videos: la lista queda vacía con `source: 'local'`.
 *
 *   listVideos()        → { videos, source }
 *   getCachedVideos()   → { videos, source: 'cache' } | null
 */
export function createMediaRepository({ supabase, storage }) {
  const toVideo = (row) => ({
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category || 'General',
    durationSeconds: row.duration_seconds || null,
    url: row.public_url,
    thumbnailUrl: row.thumbnail_url || null,
    captionsUrl: row.captions_url || null,
    signKey: row.sign_key || null,
  });

  const videos = createCachedResource({
    storage,
    cacheKey: CACHE_KEY,
    local: [],
    isValid: Array.isArray,
    fetchRemote: async () => {
      const { data, error } = await withTimeout(
        supabase
          .from('media')
          .select('id, title, description, category, duration_seconds, public_url, thumbnail_url, captions_url, sign_key')
          .eq('kind', 'video')
          .eq('published', true)
          .order('sort_order', { ascending: true }),
      );
      if (error) throw error;
      return (data || []).map(toVideo);
    },
  });

  return {
    async listVideos() {
      const { value, source } = await videos.read();
      return { videos: value, source };
    },

    async getCachedVideos() {
      const cached = await videos.readCached();
      return cached ? { videos: cached, source: 'cache' } : null;
    },
  };
}

export function formatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = String(Math.round(seconds % 60)).padStart(2, '0');
  return `${String(m).padStart(2, '0')}:${s}`;
}
