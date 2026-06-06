import { supabase } from './supabase';
import { DICTIONARY_ENTRIES } from '../src/data/dictionaryData';

// Trae el diccionario desde Supabase. Si falla o esta vacio, devuelve el
// diccionario local como respaldo (la app nunca se queda sin contenido).
export async function fetchDictionary() {
  try {
    const { data, error } = await supabase
      .from('dictionary')
      .select('letter, sign, description, category, difficulty')
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return { entries: DICTIONARY_ENTRIES, source: 'local' };
    }

    return { entries: data, source: 'remote' };
  } catch {
    return { entries: DICTIONARY_ENTRIES, source: 'local' };
  }
}
