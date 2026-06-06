/*
 * Genera el SQL (esquema + seed) del diccionario de senas a partir de
 * src/data/dictionaryData.js, para pegarlo en el SQL Editor de Supabase.
 *
 * Uso:  node scripts/generateDictionarySql.cjs
 * Salida:  supabase/dictionary.sql
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const dataPath = path.join(ROOT, 'src', 'data', 'dictionaryData.js');
const outDir = path.join(ROOT, 'supabase');
const outPath = path.join(outDir, 'dictionary.sql');

// dictionaryData.js usa ESM. Extraemos solo el literal del arreglo
// DICTIONARY_ENTRIES y lo evaluamos como expresion JS.
const src = fs.readFileSync(dataPath, 'utf8');
const marker = 'DICTIONARY_ENTRIES = ';
const from = src.indexOf(marker);
if (from === -1) throw new Error('No se encontro DICTIONARY_ENTRIES en dictionaryData.js');
const start = src.indexOf('[', from);
const end = src.indexOf('];', start);
// eslint-disable-next-line no-eval
const DICTIONARY_ENTRIES = eval(src.slice(start, end + 1));

const sqlText = (value) => {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
};

const lines = [];
lines.push('-- ============================================================');
lines.push('-- Diccionario de senas de OratioLingo (generado automaticamente)');
lines.push('-- Generado el: ' + new Date().toISOString());
lines.push('-- Pegar completo en Supabase -> SQL Editor -> Run');
lines.push('-- ============================================================');
lines.push('');

lines.push('-- 1) Tabla');
lines.push(`create table if not exists public.dictionary (
  id bigserial primary key,
  letter text not null,
  sign text not null,
  description text,
  category text not null,
  difficulty text,
  sort_order integer not null default 0
);`);
lines.push('');

lines.push('-- 2) Seguridad: lectura publica');
lines.push('alter table public.dictionary enable row level security;');
lines.push(`drop policy if exists "dictionary_read" on public.dictionary;`);
lines.push(`create policy "dictionary_read" on public.dictionary for select using (true);`);
lines.push('');

lines.push('-- 3) Datos (se reemplazan en cada ejecucion)');
lines.push('truncate table public.dictionary;');
lines.push('');

DICTIONARY_ENTRIES.forEach((entry, index) => {
  lines.push(
    `insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ` +
      `(${sqlText(entry.letter)}, ${sqlText(entry.sign)}, ${sqlText(entry.description)}, ${sqlText(
        entry.category,
      )}, ${sqlText(entry.difficulty)}, ${index});`,
  );
});
lines.push('');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

console.log(`OK -> ${path.relative(ROOT, outPath)}`);
console.log(`Entradas: ${DICTIONARY_ENTRIES.length}`);
