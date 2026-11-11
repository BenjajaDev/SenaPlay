-- ============================================================
-- 010 · Señas en video (clips cortos con movimiento)
-- ------------------------------------------------------------
-- Requiere 001 (roles) y 003 (feature_flags). Diseño en
-- docs/10-senas-en-video.md.
--
-- Cada fila es un clip MP4 cuadrado de una seña, con su imagen fija WebP,
-- exportado desde el editor del panel. Los archivos viven en el bucket
-- público `sign-clips` con la ruta <sign_key>/<variante>-<uuid>.<ext>; la
-- tabla guarda rutas, no URLs, y la app arma la URL pública.
--
-- Flujo: el staff sube borradores y los envía a revisión; solo un admin
-- valida, rechaza o publica. Nada sin validar llega a la app. Si cambia el
-- video, la imagen o el encuadre de un clip, vuelve a borrador.
--
-- El video muestra la cara de quien seña, que es un dato personal: se exige
-- la referencia a su consentimiento firmado (`consent_ref`). El documento
-- firmado NO va al bucket público, y el video original no se guarda.
-- ============================================================

create table if not exists public.sign_clips (
  id uuid primary key default gen_random_uuid(),
  sign_key text not null
    check (sign_key ~ '^[a-z0-9ñ~]+(-[a-z0-9ñ~]+)*$'),
  gloss text not null check (length(trim(gloss)) > 0),
  variant smallint not null default 1 check (variant between 1 and 20),
  region text not null default 'general'
    check (region ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  video_path text not null unique,
  poster_path text not null unique,
  duration_ms integer not null check (duration_ms between 500 and 6000),
  width integer not null,
  height integer not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 1500000),
  signer_alias text not null check (length(trim(signer_alias)) > 0),
  consent_ref text not null check (length(trim(consent_ref)) > 0),
  license text not null default 'propia' check (license in ('propia', 'cedida')),
  edit_params jsonb not null default '{}'::jsonb check (jsonb_typeof(edit_params) = 'object'),
  validation_status text not null default 'draft'
    check (validation_status in ('draft', 'in_review', 'validated', 'rejected')),
  validated_by uuid references auth.users (id),
  validated_at timestamptz,
  validation_notes text,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),

  constraint sign_clips_key_variant unique (sign_key, variant),
  constraint sign_clips_square check (width = height and width between 240 and 1080),
  constraint sign_clips_video_path check (starts_with(video_path, sign_key || '/') and video_path ~ '\.mp4$'),
  constraint sign_clips_poster_path check (starts_with(poster_path, sign_key || '/') and poster_path ~ '\.webp$'),
  constraint sign_clips_published_validated check (not published or validation_status = 'validated'),
  constraint sign_clips_rejected_notes check (
    validation_status <> 'rejected' or length(trim(coalesce(validation_notes, ''))) > 0
  )
);

create index if not exists idx_sign_clips_feed on public.sign_clips (published, sign_key, variant);

drop trigger if exists sign_clips_touch on public.sign_clips;
create trigger sign_clips_touch before update on public.sign_clips
  for each row execute function public.touch_updated_at();

-- Reglas del flujo de validación. Como en guard_profile_role, solo se
-- aplican a peticiones de usuarios (auth.uid() presente): el SQL Editor y
-- el service role pueden corregir datos a mano.
create or replace function public.guard_sign_clip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  media_changed boolean;
begin
  if tg_op = 'UPDATE' then
    media_changed :=
      new.video_path is distinct from old.video_path
      or new.poster_path is distinct from old.poster_path
      or new.edit_params is distinct from old.edit_params
      or new.sign_key is distinct from old.sign_key;

    -- Un clip validado que cambia de contenido pierde la validación, salvo
    -- que la misma operación la vuelva a fijar.
    if media_changed and new.validation_status is not distinct from old.validation_status
       and old.validation_status in ('validated', 'rejected') then
      new.validation_status := 'draft';
      new.published := false;
    end if;
  end if;

  if auth.uid() is not null and not public.is_admin() then
    if new.validation_status in ('validated', 'rejected')
       and (tg_op = 'INSERT' or new.validation_status is distinct from old.validation_status) then
      raise exception 'Solo un administrador puede validar o rechazar un clip';
    end if;
    if new.published and (tg_op = 'INSERT' or not old.published) then
      raise exception 'Solo un administrador puede publicar un clip';
    end if;
  end if;

  if new.validation_status = 'validated'
     and (tg_op = 'INSERT' or old.validation_status is distinct from 'validated') then
    new.validated_by := auth.uid();
    new.validated_at := now();
  elsif new.validation_status <> 'validated' then
    new.validated_by := null;
    new.validated_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists sign_clips_guard on public.sign_clips;
create trigger sign_clips_guard before insert or update on public.sign_clips
  for each row execute function public.guard_sign_clip();

alter table public.sign_clips enable row level security;

drop policy if exists "sign_clips_read_published" on public.sign_clips;
create policy "sign_clips_read_published" on public.sign_clips
  for select using (published or public.is_staff());
drop policy if exists "sign_clips_staff_insert" on public.sign_clips;
create policy "sign_clips_staff_insert" on public.sign_clips
  for insert with check (public.is_staff());
drop policy if exists "sign_clips_staff_update" on public.sign_clips;
create policy "sign_clips_staff_update" on public.sign_clips
  for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "sign_clips_admin_delete" on public.sign_clips;
create policy "sign_clips_admin_delete" on public.sign_clips
  for delete using (public.is_admin());

-- ── Storage: bucket público `sign-clips` ─────────────────────
-- Separado de `media` para limitar peso y tipos a nivel de bucket. Se
-- actualiza en conflicto para que los límites queden aplicados aunque el
-- bucket ya exista.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sign-clips', 'sign-clips', true, 1500000, array['video/mp4', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sign_clips_objects_read" on storage.objects;
create policy "sign_clips_objects_read" on storage.objects
  for select using (bucket_id = 'sign-clips');
drop policy if exists "sign_clips_objects_staff_insert" on storage.objects;
create policy "sign_clips_objects_staff_insert" on storage.objects
  for insert with check (bucket_id = 'sign-clips' and public.is_staff());
drop policy if exists "sign_clips_objects_staff_update" on storage.objects;
create policy "sign_clips_objects_staff_update" on storage.objects
  for update using (bucket_id = 'sign-clips' and public.is_staff());
drop policy if exists "sign_clips_objects_staff_delete" on storage.objects;
create policy "sign_clips_objects_staff_delete" on storage.objects
  for delete using (bucket_id = 'sign-clips' and public.is_staff());

-- ── Flag remoto ──────────────────────────────────────────────
insert into public.feature_flags (key, enabled, description) values
  ('signs.clips', true, 'Señas en video (clips con movimiento)')
on conflict (key) do nothing;
