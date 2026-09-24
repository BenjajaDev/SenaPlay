import { storageKey } from '../../../core/storage/jsonStorage';

const CACHE_KEYS = { dictionary: storageKey('dictionary', 'v1'), vocabulary: storageKey('vocabulary', 'v1') };

/**
 * Repositorio de contenido de señas: diccionario (letras, números, acciones)
 * y vocabulario léxico (palabras del diccionario MINEDUC). Misma estrategia
 * remoto → caché → local que el catálogo de niveles.
 *
 *   getDictionary() → { entries, source }
 *   getVocabulary() → { signs, source }
 */
export function createSignsRepository({ supabase, storage, localDictionary, localVocabulary }) {
  const withFallback = async (cacheKey, fetchRemote, local) => {
    try {
      const remote = await fetchRemote();
      if (remote?.length) {
        await storage.set(cacheKey, remote);
        return { items: remote, source: 'remote' };
      }
    } catch {
      /* sin red */
    }
    const cached = await storage.get(cacheKey, null);
    if (Array.isArray(cached) && cached.length) return { items: cached, source: 'cache' };
    return { items: local, source: 'local' };
  };

  return {
    async getDictionary() {
      const { items, source } = await withFallback(
        CACHE_KEYS.dictionary,
        async () => {
          const { data, error } = await supabase
            .from('dictionary')
            .select('letter, sign, description, category, difficulty')
            .order('sort_order', { ascending: true });
          return error ? null : data;
        },
        localDictionary,
      );
      return { entries: items, source };
    },

    async getVocabulary() {
      const { items, source } = await withFallback(
        CACHE_KEYS.vocabulary,
        async () => {
          const { data, error } = await supabase
            .from('signs')
            .select('word, type, meaning, how_to, theme, page')
            .order('word', { ascending: true });
          if (error) return null;
          // how_to (columna SQL) → howTo (forma que usa la app).
          return data.map(({ how_to: howTo, ...rest }) => ({ ...rest, howTo }));
        },
        localVocabulary,
      );
      return { signs: items, source };
    },
  };
}
