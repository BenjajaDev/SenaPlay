// Valida los niveles de la semilla con ExerciseFactory (la misma regla que la app
// y el panel) y los guarda con la función `save_level`.
//
// Un nivel que ya existe se salta, salvo con --sobrescribir: ahí se reemplazan
// sus ejercicios (y título, descripción y categoría) con los de la semilla, pero
// se conservan `available` y `sort_order` de la base, porque un admin pudo
// activar el nivel o reordenarlo.

const isText = (value) => typeof value === 'string' && value.trim().length > 0;

// JSON con las claves ordenadas: jsonb no conserva el orden de las claves y la
// comparación no debe contarlo como un cambio.
const canonical = (value) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]))
      : item,
  );

const toExerciseRow = (ExerciseFactory, raw) => {
  const row = ExerciseFactory.toRow(ExerciseFactory.create(raw), 0);
  return { type: row.type, title: row.title, hint: row.hint, payload: row.payload };
};

function validateLevels(levelsDoc, ExerciseFactory, stats) {
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
  return valid;
}

async function readExisting(supabase, ids) {
  const levels = await supabase.from('levels').select('id, title, description, category, available, sort_order').in('id', ids);
  if (levels.error) throw new Error(`No se pudo leer levels: ${levels.error.message}`);
  const exercises = await supabase
    .from('exercises')
    .select('level_id, position, type, title, hint, payload')
    .in('level_id', ids)
    .order('position', { ascending: true });
  if (exercises.error) throw new Error(`No se pudo leer exercises: ${exercises.error.message}`);
  const byLevel = new Map();
  exercises.data.forEach((row) => {
    const list = byLevel.get(row.level_id) ?? [];
    list.push({ type: row.type, title: row.title, hint: row.hint ?? null, payload: row.payload });
    byLevel.set(row.level_id, list);
  });
  return { rows: new Map(levels.data.map((row) => [row.id, row])), exercises: byLevel };
}

/** Qué cambiaría en un nivel que ya existe (lista vacía = idéntico). */
function diffLevel(level, existing, existingExercises, seedExercises) {
  const changes = [];
  ['title', 'category'].forEach((field) => {
    if ((existing[field] ?? '') !== (level[field] ?? '')) changes.push(field);
  });
  if ((existing.description ?? '') !== (level.description ?? '')) changes.push('description');
  const before = existingExercises ?? [];
  if (before.length !== seedExercises.length) changes.push(`ejercicios ${before.length} → ${seedExercises.length}`);
  const different = seedExercises.filter((row, index) => canonical({ ...row, hint: row.hint ?? null }) !== canonical(before[index] ?? null)).length;
  if (different) changes.push(`${different} de ${seedExercises.length} ejercicios`);
  return changes;
}

const toPayload = (level, pick) => ({
  id: level.id,
  title: level.title,
  description: level.description ?? '',
  category: level.category,
  available: pick.available,
  sort_order: pick.sort_order,
});

export async function importLevels({ supabase, options, levelsDoc, domain, stats }) {
  const { ExerciseFactory } = domain;
  const valid = validateLevels(levelsDoc, ExerciseFactory, stats);

  if (options.dryRun && !supabase) {
    stats.levels.wouldSave = valid.length;
    return;
  }

  const { rows, exercises } = await readExisting(supabase, valid.map((level) => level.id));

  for (const level of valid) {
    const current = rows.get(level.id);
    const seedExercises = level.exercises.map((raw) => toExerciseRow(ExerciseFactory, raw));

    if (current && !options.overwrite) {
      stats.levels.skipped += 1;
      continue;
    }
    // Con otra categoría no es el nivel del club: pudo crearlo un admin con ese id. No se pisa.
    if (current && current.category !== level.category) {
      stats.levels.skipped += 1;
      console.log(`  ! nivel ${level.id}: en la base es «${current.category}», no «${level.category}»; se salta`);
      continue;
    }

    let pick = { available: level.available === true, sort_order: level.sort_order ?? level.id };
    if (current) {
      pick = { available: current.available, sort_order: current.sort_order };
      const changes = diffLevel(level, current, exercises.get(level.id), seedExercises);
      if (!changes.length) {
        stats.levels.unchanged += 1;
        continue;
      }
      if (options.dryRun) {
        stats.levels.wouldUpdate += 1;
        console.log(`  ~ nivel ${level.id} «${level.title}»: cambia ${changes.join(', ')}`);
        continue;
      }
    } else if (options.dryRun) {
      stats.levels.wouldSave += 1;
      console.log(`  + nivel ${level.id} «${level.title}»: se crearía`);
      continue;
    }

    // Mismo formato que el panel: { type, title, hint, payload } (sin position).
    const { error: rpcError } = await supabase.rpc('save_level', { p_level: toPayload(level, pick), p_exercises: seedExercises });
    if (rpcError) {
      stats.levels.failed += 1;
      stats.errors.push(`nivel ${level.id}: ${rpcError.message}`);
    } else if (current) {
      stats.levels.updated += 1;
    } else {
      stats.levels.saved += 1;
    }
  }
}
