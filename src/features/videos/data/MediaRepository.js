import { storageKey } from '../../../core/storage/jsonStorage';

const CACHE_KEY = storageKey('media', 'v1');

// Respaldo cuando aún no hay videos cargados desde el panel de administración.
export const LOCAL_VIDEOS = [
  { id: 'local-1', title: 'Pronunciación diaria', category: 'Básico', durationSeconds: 372, url: null },
  { id: 'local-2', title: 'Vocabulario para saludos', category: 'Básico', durationSeconds: 525, url: null },
  { id: 'local-3', title: 'Frases en contexto', category: 'Intermedio', durationSeconds: 603, url: null },
  { id: 'local-4', title: 'Conversaciones reales', category: 'Avanzado', durationSeconds: 740, url: null },
];

/**
 * Recursos multimedia administrados desde el Gestor de Medios del panel web
 * (tabla `media` + bucket `media` de Storage). La app solo ve los publicados.
 *
 *   listVideos() → { videos, source }
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

  return {
    async listVideos() {
      try {
        const { data, error } = await supabase
          .from('media')
          .select('id, title, description, category, duration_seconds, public_url, thumbnail_url, captions_url, sign_key')
          .eq('kind', 'video')
          .eq('published', true)
          .order('sort_order', { ascending: true });
        if (!error && data?.length) {
          const videos = data.map(toVideo);
          await storage.set(CACHE_KEY, videos);
          return { videos, source: 'remote' };
        }
      } catch {
        /* sin red */
      }
      const cached = await storage.get(CACHE_KEY, null);
      if (Array.isArray(cached) && cached.length) return { videos: cached, source: 'cache' };
      return { videos: LOCAL_VIDEOS, source: 'local' };
    },
  };
}

export function formatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = String(Math.round(seconds % 60)).padStart(2, '0');
  return `${String(m).padStart(2, '0')}:${s}`;
}
