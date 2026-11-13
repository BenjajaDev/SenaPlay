// Valida los niveles de la semilla con ExerciseFactory (la misma regla que la app
// y el panel) y los guarda con la función `save_level`.

const isText = (value) => typeof value === 'string' && value.trim().length > 0;

export async function importLevels({ supabase, options, levelsDoc, domain, stats }) {
  const { ExerciseFactory } = domain;
  const valid = [];
  for (const level of levelsDoc.levels) {
    const problems = [];
    if (!Number.isInteger(level.id) || level.id <= 0) problems.push('id inválido');
    if (!isText(level.title)) problems.push('falta el título');
    if (!level.exercises?.length) problems.push('sin ejercicios');
    (level.exercises || []).forEach((exercise, index) => {
      const { valid: ok, error } = ExerciseFactory.validate(exercise);
      if (!ok) problems.push(`ejercicio ${index + 1}: ${error}`);
    });
    if (problems.length) {
      stats.levels.failed += 1;
      stats.errors.push(`nivel ${level.id}: ${problems.join('; ')}`);
    } else {
      valid.push(level);
    }
  }
  if (options.dryRun) {
    stats.levels.wouldSave = valid.length;
    return;
  }

  // Un nivel que ya existe no se pisa: un admin pudo activarlo o editarlo.
  const { data, error } = await supabase.from('levels').select('id').in('id', valid.map((level) => level.id));
  if (error) throw new Error(`No se pudo leer levels: ${error.message}`);
  const existing = new Set(data.map((row) => row.id));

  for (const level of valid) {
    if (existing.has(level.id)) {
      stats.levels.skipped += 1;
      continue;
    }
    const pLevel = {
      id: level.id,
      title: level.title,
      description: level.description ?? '',
      category: level.category,
      available: level.available === true,
      sort_order: level.sort_order ?? level.id,
    };
    // Mismo formato que el panel: { type, title, hint, payload } (sin position).
    const pExercises = level.exercises.map((raw) => {
      const row = ExerciseFactory.toRow(ExerciseFactory.create(raw), 0);
      return { type: row.type, title: row.title, hint: row.hint, payload: row.payload };
    });
    const { error: rpcError } = await supabase.rpc('save_level', { p_level: pLevel, p_exercises: pExercises });
    if (rpcError) {
      stats.levels.failed += 1;
      stats.errors.push(`nivel ${level.id}: ${rpcError.message}`);
    } else {
      stats.levels.saved += 1;
    }
  }
}
