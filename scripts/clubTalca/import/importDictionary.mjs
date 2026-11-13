// Inserta o actualiza en `public.signs` las señas del Club de Sordos de Talca
// (modo «Señas reales» del diccionario). Reglas:
//  - Se comparan por palabra normalizada (sin tildes ni mayúsculas): nunca se duplica.
//  - Solo se tocan filas del club (source = «Club de Sordos de Talca»). Si la
//    palabra ya existe como fila MINEDUC (o de otra fuente) se salta y se avisa.
//  - Con --dry-run solo se lee y se muestra qué cambiaría.

const PAGE_SIZE = 500;
const BATCH_SIZE = 100;
const PREVIEW_LIMIT = 40;
const FIELDS = ['type', 'meaning', 'how_to', 'theme', 'source', 'page'];

const same = (a, b) => (a ?? null) === (b ?? null);

async function readAllSigns(supabase) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('signs')
      .select('id, word, type, meaning, how_to, theme, page, source')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`No se pudo leer signs (¿se aplicó la migración 20261113000200?): ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

function validateRows(rows, normalizeWord, stats) {
  const seen = new Map();
  return rows.filter((row) => {
    const problems = [];
    if (!row.word || row.word.length > 120) problems.push('palabra vacía o demasiado larga');
    if (!row.theme) problems.push('sin tema');
    const key = normalizeWord(row.word);
    if (seen.has(key)) problems.push(`repite «${seen.get(key)}»`);
    seen.set(key, row.word);
    if (problems.length) {
      stats.dictionary.failed += 1;
      stats.errors.push(`diccionario «${row.word}»: ${problems.join('; ')}`);
    }
    return problems.length === 0;
  });
}

function preview(title, lines, detail) {
  if (!lines.length) return;
  console.log(`  ${title} (${lines.length}):`);
  (detail ? lines : lines.slice(0, PREVIEW_LIMIT)).forEach((line) => console.log(`    ${line}`));
  if (!detail && lines.length > PREVIEW_LIMIT) console.log(`    …y ${lines.length - PREVIEW_LIMIT} más (usa --detalle para verlas todas)`);
}

export async function importDictionary({ supabase, options, domain, clips, levelsDoc, hints, stats }) {
  const { buildClubSigns, normalizeWord, CLUB_SOURCE } = domain.clubDictionary;
  const seed = validateRows(
    buildClubSigns({ clips, levels: levelsDoc.levels, hints, toSignKey: domain.signMedia.toSignKey }),
    normalizeWord,
    stats,
  );
  if (!hints) console.log('  Aviso: no existe clubTalcaHints.json; how_to queda vacío en todas las señas.');

  const existing = await readAllSigns(supabase);
  const byWord = new Map();
  existing.forEach((row) => {
    const key = normalizeWord(row.word);
    if (!byWord.has(key)) byWord.set(key, row);
  });

  const toInsert = [];
  const toUpdate = [];
  const conflicts = [];
  seed.forEach((row) => {
    const current = byWord.get(normalizeWord(row.word));
    if (!current) {
      toInsert.push(row);
    } else if (current.source !== CLUB_SOURCE) {
      conflicts.push(`${row.word} (ya existe como «${current.word}», ${current.source ?? 'MINEDUC'})`);
    } else {
      const changed = FIELDS.concat('word').filter((field) => !same(current[field], row[field]));
      if (changed.length) toUpdate.push({ id: current.id, row, changed });
      else stats.dictionary.unchanged += 1;
    }
  });
  stats.dictionary.skipped = conflicts.length;

  if (options.dryRun) {
    stats.dictionary.wouldInsert = toInsert.length;
    stats.dictionary.wouldUpdate = toUpdate.length;
    preview('Se agregarían', toInsert.map((row) => `+ ${row.word} · ${row.theme}`), options.detail);
    preview('Se actualizarían', toUpdate.map((item) => `~ ${item.row.word}: ${item.changed.join(', ')}`), options.detail);
    preview('Se saltan (no se tocan filas que no son del club)', conflicts, true);
    return;
  }

  for (let from = 0; from < toInsert.length; from += BATCH_SIZE) {
    const batch = toInsert.slice(from, from + BATCH_SIZE);
    const { error } = await supabase.from('signs').insert(batch);
    if (error) {
      stats.dictionary.failed += batch.length;
      stats.errors.push(`diccionario (lote desde «${batch[0].word}»): ${error.message}`);
    } else {
      stats.dictionary.inserted += batch.length;
    }
  }
  for (const item of toUpdate) {
    // Doble guarda: solo filas del club, por id.
    const { error } = await supabase.from('signs').update(item.row).eq('id', item.id).eq('source', CLUB_SOURCE);
    if (error) {
      stats.dictionary.failed += 1;
      stats.errors.push(`diccionario «${item.row.word}»: ${error.message}`);
    } else {
      stats.dictionary.updated += 1;
    }
  }
  preview('Se saltan (no se tocan filas que no son del club)', conflicts, true);
}
