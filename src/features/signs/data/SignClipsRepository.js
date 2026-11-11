import { createCachedResource } from '../../../core/data/cachedResource';
import { withTimeout } from '../../../core/net/withTimeout';
import { storageKey } from '../../../core/storage/jsonStorage';
import { isPlayableClip } from '../domain/signMedia';

const CACHE_KEY = storageKey('signClips', 'v1');
export const SIGN_CLIPS_BUCKET = 'sign-clips';

/**
 * Clips de señas con movimiento (tabla `sign_clips` + bucket `sign-clips`).
 * La app solo ve los publicados, que la base de datos exige validados.
 *
 * La tabla guarda rutas, no URLs: la URL pública se arma aquí con
 * getPublicUrl, que no consulta la red. Así un cambio de dominio de Supabase
 * no deja URLs viejas guardadas.
 *
 * Misma estrategia remoto → caché que MediaRepository: una lista vacía es
 * válida (si el panel despublica todo, la app vuelve a las fotos), y sin red
 * ni caché no se inventan clips.
 *
 *   listClips()       → { clips, source }
 *   getCachedClips()  → { clips, source: 'cache' } | null
 */
export function createSignClipsRepository({ supabase, storage }) {
  const publicUrl = (path) => supabase.storage.from(SIGN_CLIPS_BUCKET).getPublicUrl(path).data.publicUrl;

  const toClip = (row) => ({
    id: row.id,
    signKey: row.sign_key,
    gloss: row.gloss,
    variant: row.variant,
    region: row.region,
    videoUrl: publicUrl(row.video_path),
    posterUrl: publicUrl(row.poster_path),
    durationMs: row.duration_ms,
  });

  const clips = createCachedResource({
    storage,
    cacheKey: CACHE_KEY,
    local: [],
    isValid: Array.isArray,
    fetchRemote: async () => {
      const { data, error } = await withTimeout(
        supabase
          .from('sign_clips')
          .select('id, sign_key, gloss, variant, region, video_path, poster_path, duration_ms')
          .eq('published', true)
          .order('sign_key', { ascending: true })
          .order('variant', { ascending: true }),
      );
      if (error) throw error;
      return (data || []).map(toClip).filter(isPlayableClip);
    },
  });

  return {
    async listClips() {
      const { value, source } = await clips.read();
      return { clips: value, source };
    },

    async getCachedClips() {
      const cached = await clips.readCached();
      return cached ? { clips: cached, source: 'cache' } : null;
    },
  };
}
