-- ============================================================
-- 002 · Gestor de contenido (niveles, ejercicios, diccionario, vocabulario)
-- ------------------------------------------------------------
-- Requiere 001. Mantiene la lectura pública que ya usaba la app y agrega
-- escritura SOLO para staff (editor/admin), más una función transaccional
-- para guardar un nivel completo con sus ejercicios desde el panel web.
--
-- IMPORTANTE: los scripts `scripts/generate*Sql.cjs` generan SQL que
-- TRUNCA estas tablas. Una vez que el contenido se edite desde el panel, no
-- vuelvas a ejecutar esos archivos o perderás los cambios.
-- ============================================================

-- Asegura que las tablas existan (normalmente ya creadas por catalog.sql,
-- dictionary.sql y signs.sql).
create table if not exists public.levels (
  id integer primary key,
  title text not null,
  description text,
  category text not null,
  available boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.exercises (
  id bigserial primary key,
  level_id integer not null references public.levels (id) on delete cascade,
  position integer not null,
  type text not null,
  title text,
  hint text,
  payload jsonb not null default '{}'::jsonb,
  unique (level_id, position)
);

alter table public.levels add column if not exists updated_at timestamptz not null default now();
alter table public.exercises add column if not exists updated_at timestamptz not null default now();

-- Solo tipos de ejercicio que la app sabe dibujar (ver domain/exerciseTypes.js).
alter table public.exercises drop constraint if exists exercises_type_check;
alter table public.exercises add constraint exercises_type_check check (
  type in ('matching', 'multiple-choice', 'ordering', 'typing', 'recognition',
           'build-word', 'interpret-signs', 'word-meaning', 'true-false')
);

drop trigger if exists levels_touch on public.levels;
create trigger levels_touch before update on public.levels
  for each row execute function public.touch_updated_at();
drop trigger if exists exercises_touch on public.exercises;
create trigger exercises_touch before update on public.exercises
  for each row execute function public.touch_updated_at();

-- ── Políticas de escritura para staff ─────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['levels', 'exercises', 'dictionary', 'signs'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "%s_staff_insert" on public.%I', t, t);
      execute format('create policy "%s_staff_insert" on public.%I for insert with check (public.is_staff())', t, t);
      execute format('drop policy if exists "%s_staff_update" on public.%I', t, t);
      execute format('create policy "%s_staff_update" on public.%I for update using (public.is_staff())', t, t);
      execute format('drop policy if exists "%s_staff_delete" on public.%I', t, t);
      execute format('create policy "%s_staff_delete" on public.%I for delete using (public.is_staff())', t, t);
    end if;
  end loop;
end;
$$;

-- ── Guardado atómico de un nivel (nivel + todos sus ejercicios) ──
-- El panel envía el nivel y la lista ordenada de ejercicios; se reemplazan
-- en una sola transacción, así la app nunca lee un nivel a medio guardar.
create or replace function public.save_level(p_level jsonb, p_exercises jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id integer := (p_level ->> 'id')::integer;
begin
  if not public.is_staff() then
    raise exception 'No autorizado';
  end if;
  if v_id is null or coalesce(p_level ->> 'title', '') = '' then
    raise exception 'El nivel necesita id y título';
  end if;

  insert into public.levels (id, title, description, category, available, sort_order)
  values (
    v_id,
    p_level ->> 'title',
    p_level ->> 'description',
    coalesce(p_level ->> 'category', 'alfabeto'),
    coalesce((p_level ->> 'available')::boolean, true),
    coalesce((p_level ->> 'sort_order')::integer, 0)
  )
  on conflict (id) do update set
    title = excluded.title,
    description = excluded.description,
    category = excluded.category,
    available = excluded.available,
    sort_order = excluded.sort_order;

  delete from public.exercises where level_id = v_id;

  insert into public.exercises (level_id, position, type, title, hint, payload)
  select
    v_id,
    (item.ordinality - 1)::integer,
    item.value ->> 'type',
    item.value ->> 'title',
    nullif(item.value ->> 'hint', ''),
    coalesce(item.value -> 'payload', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) with ordinality as item(value, ordinality);

  return v_id;
end;
$$;

revoke all on function public.save_level(jsonb, jsonb) from public;
grant execute on function public.save_level(jsonb, jsonb) to authenticated;
