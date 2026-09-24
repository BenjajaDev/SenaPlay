-- ============================================================
-- 004 · Gestor de medios (videos, imágenes y documentos)
-- ------------------------------------------------------------
-- Requiere 001. Metadatos en `public.media`, archivos en el bucket público
-- `media` de Storage (ruta sugerida: <kind>/<uuid>-<nombre>). La app solo
-- ve los recursos publicados; staff puede ver y editar todo.
-- ============================================================

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('video', 'image', 'document')),
  title text not null,
  description text,
  category text not null default 'General',
  tags text[] not null default '{}',
  storage_path text not null unique,
  public_url text not null,
  thumbnail_url text,
  captions_url text,
  mime_type text,
  size_bytes bigint,
  duration_seconds integer,
  sign_key text,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index if not exists idx_media_kind_published on public.media (kind, published, sort_order);
create index if not exists idx_media_category on public.media (category);

drop trigger if exists media_touch on public.media;
create trigger media_touch before update on public.media
  for each row execute function public.touch_updated_at();

alter table public.media enable row level security;

drop policy if exists "media_read_published" on public.media;
create policy "media_read_published" on public.media
  for select using (published or public.is_staff());
drop policy if exists "media_staff_write" on public.media;
create policy "media_staff_write" on public.media
  for all using (public.is_staff()) with check (public.is_staff());

-- ── Storage: bucket público `media` ──────────────────────────
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media_objects_read" on storage.objects;
create policy "media_objects_read" on storage.objects
  for select using (bucket_id = 'media');
drop policy if exists "media_objects_staff_insert" on storage.objects;
create policy "media_objects_staff_insert" on storage.objects
  for insert with check (bucket_id = 'media' and public.is_staff());
drop policy if exists "media_objects_staff_update" on storage.objects;
create policy "media_objects_staff_update" on storage.objects
  for update using (bucket_id = 'media' and public.is_staff());
drop policy if exists "media_objects_staff_delete" on storage.objects;
create policy "media_objects_staff_delete" on storage.objects
  for delete using (bucket_id = 'media' and public.is_staff());

-- ── Storage: bucket `avatars` (fotos de perfil de la app) ────
-- Cada usuario solo escribe en su carpeta <user_id>/.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_read" on storage.objects;
create policy "avatars_read" on storage.objects
  for select using (bucket_id = 'avatars');
drop policy if exists "avatars_owner_write" on storage.objects;
create policy "avatars_owner_write" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
