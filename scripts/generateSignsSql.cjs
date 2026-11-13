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
  page integer,
  source text
);`);
lines.push('alter table public.signs add column if not exists source text;');
lines.push('');

lines.push('-- 2) Seguridad: lectura publica');
lines.push('alter table public.signs enable row level security;');
lines.push(`drop policy if exists "signs_read" on public.signs;`);
lines.push(`create policy "signs_read" on public.signs for select using (true);`);
// Escritura del staff (misma regla que 20261113000300_signs_staff_policies.sql). Solo si
// is_staff() ya existe: en una base nueva la crea 20260924000200_content_admin.sql.
lines.push('do $$');
lines.push('begin');
lines.push("  if to_regprocedure('public.is_staff()') is not null then");
lines.push(`    drop policy if exists "signs_staff_insert" on public.signs;`);
lines.push(`    create policy "signs_staff_insert" on public.signs for insert with check (public.is_staff());`);
lines.push(`    drop policy if exists "signs_staff_update" on public.signs;`);
lines.push(`    create policy "signs_staff_update" on public.signs for update using (public.is_staff()) with check (public.is_staff());`);
lines.push(`    drop policy if exists "signs_staff_delete" on public.signs;`);
lines.push(`    create policy "signs_staff_delete" on public.signs for delete using (public.is_staff());`);
lines.push('  end if;');
lines.push('end;');
lines.push('$$;');
lines.push('');

lines.push('-- 3) Datos MINEDUC (se reemplazan en cada ejecucion; las filas con source, como las del');
lines.push('--    Club de Sordos de Talca, se conservan: se cargan con scripts/clubTalca)');
lines.push('delete from public.signs where source is null;');
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
