import { supabase } from '../../../core/supabase/client';
import { REAL_SIGNS } from './local/signsData';

// Trae las senas lexicas reales desde Supabase. Si falla o esta vacio,
// devuelve el set local como respaldo.
export async function fetchSigns() {
  try {
    const { data, error } = await supabase
      .from('signs')
      .select('word, type, meaning, how_to, theme, page')
      .order('word', { ascending: true });

    if (error || !data || data.length === 0) {
      return { signs: REAL_SIGNS, source: 'local' };
    }

    // Normaliza how_to (columna SQL) -> howTo (forma que usa la app).
    const signs = data.map((row) => ({
      word: row.word,
      type: row.type,
      meaning: row.meaning,
      howTo: row.how_to,
      theme: row.theme,
      page: row.page,
    }));

    return { signs, source: 'remote' };
  } catch {
    return { signs: REAL_SIGNS, source: 'local' };
  }
}
