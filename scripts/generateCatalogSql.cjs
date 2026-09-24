/*
 * Genera el SQL (esquema + seed) del catalogo de niveles a partir de
 * src/features/levels/data/local/levelsCatalog.js, para pegarlo en el SQL Editor de Supabase.
 *
 * Uso:  node scripts/generateCatalogSql.cjs
 * Salida:  supabase/catalog.sql
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const configPath = path.join(ROOT, 'src', 'features', 'levels', 'data', 'local', 'levelsCatalog.js');
const outDir = path.join(ROOT, 'supabase');
const outPath = path.join(outDir, 'catalog.sql');

// levelsConfig.js usa sintaxis ESM (export). Extraemos solo el literal del
// arreglo LEVELS_CATALOG y lo evaluamos como expresion JS.
const src = fs.readFileSync(configPath, 'utf8');
const start = src.indexOf('[');
const end = src.lastIndexOf('];');
if (start === -1 || end === -1) {
  throw new Error('No se encontro el arreglo LEVELS_CATALOG en levelsConfig.js');
}
// eslint-disable-next-line no-eval
const LEVELS_CATALOG = eval(src.slice(start, end + 1));

// Helpers de serializacion SQL.
const sqlText = (value) => {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
};
const sqlBool = (value) => (value ? 'true' : 'false');
const sqlJson = (obj) => `$j$${JSON.stringify(obj)}$j$::jsonb`;

const lines = [];
lines.push('-- ============================================================');
lines.push('-- Catalogo de niveles de SeñaPlay (generado automaticamente)');
lines.push('-- Generado el: ' + new Date().toISOString());
lines.push('-- Pegar completo en Supabase -> SQL Editor -> Run');
lines.push('-- ============================================================');
lines.push('');

// 1) Esquema
lines.push('-- 1) Tablas');
lines.push(`create table if not exists public.levels (
  id integer primary key,
  title text not null,
  description text,
  category text not null,
  available boolean not null default true,
  sort_order integer not null default 0
);`);
lines.push('');
lines.push(`create table if not exists public.exercises (
  id bigserial primary key,
  level_id integer not null references public.levels(id) on delete cascade,
  position integer not null,
  type text not null,
  title text,
  hint text,
  payload jsonb not null default '{}'::jsonb,
  unique (level_id, position)
);`);
lines.push('');

// 2) RLS: lectura publica, escritura solo desde el dashboard/service role
lines.push('-- 2) Seguridad: cualquiera puede LEER el catalogo, nadie puede escribirlo desde la app');
lines.push('alter table public.levels enable row level security;');
lines.push('alter table public.exercises enable row level security;');
lines.push(`drop policy if exists "levels_read" on public.levels;`);
lines.push(`create policy "levels_read" on public.levels for select using (true);`);
lines.push(`drop policy if exists "exercises_read" on public.exercises;`);
lines.push(`create policy "exercises_read" on public.exercises for select using (true);`);
lines.push('');

// 3) Limpieza previa (idempotente) y seed
lines.push('-- 3) Datos (se reemplazan en cada ejecucion)');
lines.push('truncate table public.exercises;');
lines.push('delete from public.levels;');
lines.push('');

LEVELS_CATALOG.forEach((level, levelIdx) => {
  lines.push(
    `insert into public.levels (id, title, description, category, available, sort_order) values ` +
      `(${level.id}, ${sqlText(level.title)}, ${sqlText(level.description)}, ${sqlText(level.category)}, ${sqlBool(
        level.available,
      )}, ${levelIdx});`,
  );

  (level.exercises || []).forEach((ex, position) => {
    const { type, title, hint, ...payload } = ex;
    lines.push(
      `insert into public.exercises (level_id, position, type, title, hint, payload) values ` +
        `(${level.id}, ${position}, ${sqlText(type)}, ${sqlText(title)}, ${sqlText(hint)}, ${sqlJson(payload)});`,
    );
  });
  lines.push('');
});

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

const exerciseCount = LEVELS_CATALOG.reduce((n, l) => n + (l.exercises?.length || 0), 0);
console.log(`OK -> ${path.relative(ROOT, outPath)}`);
console.log(`Niveles: ${LEVELS_CATALOG.length} | Ejercicios: ${exerciseCount}`);
