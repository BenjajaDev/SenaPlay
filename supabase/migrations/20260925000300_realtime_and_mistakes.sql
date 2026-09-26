-- ============================================================
-- 008 · Config remota en tiempo real + registro de errores por ejercicio
-- ------------------------------------------------------------
-- Requiere 001 (roles) y 003 (config remota).
--
-- 1. app_config y feature_flags se publican por Supabase Realtime: la app
--    aplica un cambio del panel en segundos, sin reabrirse.
-- 2. exercise_mistakes: cada respuesta incorrecta en un nivel (con marca de
--    si esa respuesta dejó al usuario sin vidas). Sirve como métrica para el
--    equipo (qué ejercicios cuestan más) y para mostrarle a cada persona sus
--    errores frecuentes. Cada usuario solo inserta y lee lo suyo; staff lee
--    el agregado con mistake_stats().
-- ============================================================

-- ── 1. Realtime ──────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_config') then
      alter publication supabase_realtime add table public.app_config;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feature_flags') then
      alter publication supabase_realtime add table public.feature_flags;
    end if;
  end if;
end $$;

-- ── 2. Errores por ejercicio ────────────────────────────────
create table if not exists public.exercise_mistakes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  level_id integer not null,
  -- Clave estable del ejercicio (tipo + contenido): no depende de su posición,
  -- que cambia porque los ejercicios de cada sesión se sortean.
  exercise_key text not null check (length(exercise_key) between 1 and 200),
  exercise_type text not null,
  exercise_title text,
  sign text,
  given_answer text check (given_answer is null or length(given_answer) <= 120),
  game_over boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_exercise_mistakes_user on public.exercise_mistakes (user_id, created_at desc);
create index if not exists idx_exercise_mistakes_key on public.exercise_mistakes (level_id, exercise_key);

alter table public.exercise_mistakes enable row level security;

drop policy if exists "exercise_mistakes_insert_own" on public.exercise_mistakes;
create policy "exercise_mistakes_insert_own" on public.exercise_mistakes
  for insert with check (user_id = auth.uid());
drop policy if exists "exercise_mistakes_read_own" on public.exercise_mistakes;
create policy "exercise_mistakes_read_own" on public.exercise_mistakes
  for select using (user_id = auth.uid() or public.is_staff());

/**
 * Ejercicios con más errores (para el resumen del panel). Solo staff; el
 * resto recibe un error. Devuelve conteos agregados, sin datos personales.
 */
create or replace function public.mistake_stats(p_limit integer default 10, p_days integer default 30)
returns table (
  level_id integer,
  exercise_key text,
  exercise_type text,
  exercise_title text,
  sign text,
  mistakes bigint,
  people bigint,
  game_overs bigint,
  top_answer text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Solo el equipo puede ver estas métricas.';
  end if;
  return query
    with recent as (
      select * from public.exercise_mistakes m
      where m.created_at >= now() - make_interval(days => greatest(p_days, 1))
    )
    select
      r.level_id,
      r.exercise_key,
      max(r.exercise_type),
      max(r.exercise_title),
      max(r.sign),
      count(*),
      count(distinct r.user_id),
      count(*) filter (where r.game_over),
      (select r2.given_answer from recent r2
        where r2.level_id = r.level_id and r2.exercise_key = r.exercise_key and r2.given_answer is not null
        group by r2.given_answer order by count(*) desc limit 1)
    from recent r
    group by r.level_id, r.exercise_key
    order by count(*) desc, count(distinct r.user_id) desc
    limit least(greatest(p_limit, 1), 50);
end;
$$;

grant execute on function public.mistake_stats(integer, integer) to authenticated;
