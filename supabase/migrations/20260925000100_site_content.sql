-- ============================================================
-- 006 · Contenido del sitio web (sección «Nosotros» de la landing)
-- ------------------------------------------------------------
-- Requiere 001 (roles) y 003 (auditoría). Lectura pública; editan
-- editores y admins desde el panel web (Sitio web → Nosotros).
--
-- site_content: textos editables por clave. Claves que entiende la web
-- (ver web/src/data/types.ts):
--   about  { title, intro, mission, vision }
-- team_members: integrantes del equipo que se muestran en la landing. Las
-- fotos van al bucket público `media`, bajo la carpeta team/.
-- ============================================================

create table if not exists public.site_content (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

-- Mismo historial que la configuración remota (tabla config_audit).
drop trigger if exists site_content_audit on public.site_content;
create trigger site_content_audit before insert or update or delete on public.site_content
  for each row execute function public.audit_config_change();

alter table public.site_content enable row level security;

drop policy if exists "site_content_read" on public.site_content;
create policy "site_content_read" on public.site_content for select using (true);
drop policy if exists "site_content_staff_write" on public.site_content;
create policy "site_content_staff_write" on public.site_content
  for all using (public.is_staff()) with check (public.is_staff());

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) > 0),
  role text not null default '',
  bio text,
  photo_url text,
  photo_path text,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_team_members_order on public.team_members (published, sort_order);

drop trigger if exists team_members_touch on public.team_members;
create trigger team_members_touch before update on public.team_members
  for each row execute function public.touch_updated_at();

alter table public.team_members enable row level security;

drop policy if exists "team_members_read_published" on public.team_members;
create policy "team_members_read_published" on public.team_members
  for select using (published or public.is_staff());
drop policy if exists "team_members_staff_write" on public.team_members;
create policy "team_members_staff_write" on public.team_members
  for all using (public.is_staff()) with check (public.is_staff());

-- ── Texto inicial ────────────────────────────────────────────
-- SeñaPlay no se presenta como un curso que enseña LSCh: es un espacio de
-- práctica y entrenamiento que fomenta su uso.
insert into public.site_content (key, value) values
  ('about', jsonb_build_object(
    'title', 'Quiénes somos',
    'intro', 'Somos un equipo que cree que la Lengua de Señas Chilena merece estar presente en el día a día. SeñaPlay nace como un espacio de práctica: una forma entretenida de entrenar y mantener activa la LSCh, complementando el aprendizaje que ocurre junto a la comunidad Sorda.',
    'mission', 'Fomentar el uso cotidiano de la Lengua de Señas Chilena con una herramienta de entrenamiento accesible, lúdica y gratuita, que ayude a practicar con constancia y a acercar a personas oyentes y Sordas.',
    'vision', 'Ser la herramienta de referencia en Chile para practicar la LSCh, contribuyendo a una sociedad más inclusiva donde comunicarse en señas sea parte de la vida diaria.'
  ))
on conflict (key) do nothing;
