import { supabase } from '../../../core/supabase/client';
import { LEVELS_CATALOG } from './local/levelsCatalog';

// Reconstruye un ejercicio con la misma forma que espera la app:
// { type, title, hint?, ...campos del payload }
function buildExercise(row) {
  const exercise = { type: row.type, title: row.title, ...(row.payload || {}) };
  if (row.hint) exercise.hint = row.hint;
  return exercise;
}

// Trae el catalogo completo desde Supabase. Si falla o esta vacio,
// devuelve el catalogo local como respaldo (la app nunca se queda sin niveles).
export async function fetchCatalog() {
  try {
    const { data, error } = await supabase
      .from('levels')
      .select('id, title, description, category, available, sort_order, exercises(position, type, title, hint, payload)')
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return { levels: LEVELS_CATALOG, source: 'local' };
    }

    const levels = data.map((lvl) => ({
      id: lvl.id,
      title: lvl.title,
      description: lvl.description,
      category: lvl.category,
      available: lvl.available,
      exercises: (lvl.exercises || [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map(buildExercise),
    }));

    return { levels, source: 'remote' };
  } catch {
    return { levels: LEVELS_CATALOG, source: 'local' };
  }
}
