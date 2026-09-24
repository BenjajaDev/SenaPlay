/*
 * Genera el SQL (esquema + seed) de las senas lexicas reales a partir de
 * src/features/signs/data/local/signsData.js, para pegarlo en el SQL Editor de Supabase.
 *
 * Uso:  node scripts/generateSignsSql.cjs
 * Salida:  supabase/signs.sql
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const dataPath = path.join(ROOT, 'src', 'features', 'signs', 'data', 'local', 'signsData.js');
const outDir = path.join(ROOT, 'supabase');
const outPath = path.join(outDir, 'signs.sql');

const src = fs.readFileSync(dataPath, 'utf8');
const marker = 'REAL_SIGNS = ';
const from = src.indexOf(marker);
if (from === -1) throw new Error('No se encontro REAL_SIGNS en signsData.js');
const start = src.indexOf('[', from);
const end = src.indexOf('];', start);
// eslint-disable-next-line no-eval
const REAL_SIGNS = eval(src.slice(start, end + 1));

const sqlText = (value) => {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
};
const sqlNum = (value) => (value === null || value === undefined ? 'NULL' : Number(value));

const lines = [];
lines.push('-- ============================================================');
lines.push('-- Senas lexicas reales de SeñaPlay (generado automaticamente)');
lines.push('-- Fuente: Diccionario Bilingue LSCh-Espanol, MINEDUC');
lines.push('-- Generado el: ' + new Date().toISOString());
lines.push('-- Pegar completo en Supabase -> SQL Editor -> Run');
lines.push('-- ============================================================');
lines.push('');

lines.push('-- 1) Tabla');
lines.push(`create table if not exists public.signs (
  id bigserial primary key,
  word text not null,
  type text,
  meaning text,
  how_to text,
  theme text,
  page integer
);`);
lines.push('');

lines.push('-- 2) Seguridad: lectura publica');
lines.push('alter table public.signs enable row level security;');
lines.push(`drop policy if exists "signs_read" on public.signs;`);
lines.push(`create policy "signs_read" on public.signs for select using (true);`);
lines.push('');

lines.push('-- 3) Datos (se reemplazan en cada ejecucion)');
lines.push('truncate table public.signs;');
lines.push('');

REAL_SIGNS.forEach((s) => {
  lines.push(
    `insert into public.signs (word, type, meaning, how_to, theme, page) values ` +
      `(${sqlText(s.word)}, ${sqlText(s.type)}, ${sqlText(s.meaning)}, ${sqlText(s.howTo)}, ${sqlText(
        s.theme,
      )}, ${sqlNum(s.page)});`,
  );
});
lines.push('');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

console.log(`OK -> ${path.relative(ROOT, outPath)}`);
console.log(`Senas: ${REAL_SIGNS.length}`);
