import { createCachedResource } from '../../../core/data/cachedResource';
import { withTimeout } from '../../../core/net/withTimeout';
import { storageKey } from '../../../core/storage/jsonStorage';

const CACHE_KEYS = { dictionary: storageKey('dictionary', 'v1'), vocabulary: storageKey('vocabulary', 'v1') };

/**
 * Repositorio de contenido de señas: diccionario (letras, números, acciones)
 * y vocabulario léxico (palabras del diccionario MINEDUC). Misma estrategia
 * remoto → caché → local que el catálogo de niveles, y la lectura remota se
 * recuerda unos minutos: entrar y salir del Diccionario no repite consultas.
 *
 *   getDictionary()        → { entries, source }
 *   getCachedDictionary()  → { entries, source: 'cache' } | null
 *   getVocabulary()        → { signs, source }
 *   getCachedVocabulary()  → { signs, source: 'cache' } | null
 */
export function createSignsRepository({ supabase, storage, localDictionary, localVocabulary }) {
  const dictionary = createCachedResource({
    storage,
    cacheKey: CACHE_KEYS.dictionary,
    local: localDictionary,
    fetchRemote: async () => {
      const { data, error } = await withTimeout(
        supabase
          .from('dictionary')
          .select('letter, sign, description, category, difficulty')
          .order('sort_order', { ascending: true }),
      );
      if (error) throw error;
      return data;
    },
  });

  const vocabulary = createCachedResource({
    storage,
    cacheKey: CACHE_KEYS.vocabulary,
    local: localVocabulary,
    fetchRemote: async () => {
      const { data, error } = await withTimeout(
        supabase.from('signs').select('word, type, meaning, how_to, theme, page').order('word', { ascending: true }),
      );
      if (error) throw error;
      // how_to (columna SQL) → howTo (forma que usa la app).
      return (data || []).map(({ how_to: howTo, ...rest }) => ({ ...rest, howTo }));
    },
  });

  return {
    async getDictionary() {
      const { value, source } = await dictionary.read();
      return { entries: value, source };
    },

    async getCachedDictionary() {
      const cached = await dictionary.readCached();
      return cached ? { entries: cached, source: 'cache' } : null;
    },

    async getVocabulary() {
      const { value, source } = await vocabulary.read();
      return { signs: value, source };
    },

    async getCachedVocabulary() {
      const cached = await vocabulary.readCached();
      return cached ? { signs: cached, source: 'cache' } : null;
    },
  };
}
