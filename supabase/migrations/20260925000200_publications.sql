-- ============================================================
-- 007 · Publicaciones de la landing (congresos, actividades, pruebas…)
-- ------------------------------------------------------------
-- Requiere 001 (roles) y 004 (bucket `media`). Lectura pública solo de lo
-- publicado; editores y admins gestionan todo desde el panel web
-- (Sitio web → Publicaciones). Las portadas van al bucket público `media`,
-- bajo la carpeta publications/ (las políticas de Storage de 004 ya
-- restringen la escritura a staff).
--
-- Los textos de cada sección de la landing (hero, características,
-- accesibilidad, publicaciones, descarga, pie) viven en site_content (006)
-- con una clave por sección; la web trae valores por defecto, así que no
-- hace falta sembrarlos aquí.
-- ============================================================

create table if not exists public.publications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  summary text not null default '',
  body text,
  category text not null default 'actividad'
    check (category in ('congreso', 'actividad', 'prueba', 'noticia', 'otro')),
  event_date date,
  location text,
  link_url text,
  cover_url text,
  cover_path text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);

create index if not exists idx_publications_feed on public.publications (published, event_date desc nulls last, created_at desc);

drop trigger if exists publications_touch on public.publications;
create trigger publications_touch before update on public.publications
  for each row execute function public.touch_updated_at();

alter table public.publications enable row level security;

drop policy if exists "publications_read_published" on public.publications;
create policy "publications_read_published" on public.publications
  for select using (published or public.is_staff());
drop policy if exists "publications_staff_write" on public.publications;
create policy "publications_staff_write" on public.publications
  for all using (public.is_staff()) with check (public.is_staff());
