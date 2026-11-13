-- ============================================================
-- 20261113000100 · Contenido del Club de Sordos de Talca
-- ------------------------------------------------------------
-- Requiere 010 (sign_clips). Diseño en docs/11-contenido-club-talca.md.
--
-- 1. Duración máxima de un clip: de 6 a 10 s (hay frases que lo necesitan).
-- 2. Carpeta de Storage segura: el bucket solo acepta claves con
--    [A-Za-z0-9_/!.*'() &$=@;:+,?-], así que «mañana/1-uuid.mp4» fallaba.
--    La carpeta cambia ñ por «n_» y ~ por «_» (misma regla que
--    toStorageFolder en src/features/signs/domain/signMedia.js; los casos de
--    prueba de ambos lados están en signMedia.test.js y 10_rls_policies.sql).
-- 3. Tipo de ejercicio `sign-choice` («¿Cuál es la seña de PERRO?»).
-- Idempotente: se puede aplicar más de una vez.
-- ============================================================

create or replace function public.sign_clip_folder(p_key text)
returns text
language sql
immutable
parallel safe
as $$
  select replace(replace(p_key, 'ñ', 'n_'), '~', '_')
$$;

alter table public.sign_clips drop constraint if exists sign_clips_duration_ms_check;
alter table public.sign_clips drop constraint if exists sign_clips_duration;
alter table public.sign_clips add constraint sign_clips_duration
  check (duration_ms between 500 and 10000);

-- Ojo: `sign_key` se interpola en la expresión regular de estos checks. Es seguro
-- solo porque el check de `sign_key` limita sus caracteres a [a-z0-9ñ~-], que
-- sign_clip_folder convierte en [a-z0-9_-] (ninguno es especial en una regex).
-- Si algún día se amplía el alfabeto de `sign_key`, hay que escapar aquí.
-- Ruta exacta: <carpeta>/<variante>-<uuid>.<ext>. Cierra rutas arbitrarias dentro
-- de la carpeta de la seña (el panel y el importador arman justo este formato).
alter table public.sign_clips drop constraint if exists sign_clips_video_path;
alter table public.sign_clips add constraint sign_clips_video_path
  check (video_path ~ ('^' || public.sign_clip_folder(sign_key) || '/[0-9]+-[0-9a-f-]{36}\.mp4$'));

alter table public.sign_clips drop constraint if exists sign_clips_poster_path;
alter table public.sign_clips add constraint sign_clips_poster_path
  check (poster_path ~ ('^' || public.sign_clip_folder(sign_key) || '/[0-9]+-[0-9a-f-]{36}\.webp$'));

alter table public.exercises drop constraint if exists exercises_type_check;
alter table public.exercises add constraint exercises_type_check check (
  type in ('matching', 'multiple-choice', 'ordering', 'typing', 'recognition',
           'build-word', 'interpret-signs', 'word-meaning', 'true-false', 'sign-choice')
);

-- ── Privacidad: la app lee una vista, no la tabla ─────────────
-- RLS filtra filas, no columnas: con la política «published or is_staff()»
-- cualquiera podía leer consent_ref, signer_alias, edit_params y created_by de
-- los clips publicados. La vista expone solo lo que usa la app, únicamente de
-- los clips publicados (corre con los permisos de su dueño), y la tabla pasa a
-- ser solo para el staff.
create or replace view public.sign_clips_public as
  select id, sign_key, gloss, variant, region, video_path, poster_path, duration_ms
  from public.sign_clips
  where published;

revoke all on public.sign_clips_public from public;
grant select on public.sign_clips_public to anon, authenticated;

drop policy if exists "sign_clips_read_published" on public.sign_clips;
drop policy if exists "sign_clips_staff_read" on public.sign_clips;
create policy "sign_clips_staff_read" on public.sign_clips
  for select using (public.is_staff());

-- ── Storage: nadie lista el bucket ────────────────────────────
-- Las URL públicas siguen sirviendo porque el bucket es público; la app y el
-- panel no listan, así que leer `storage.objects` queda solo para el staff.
drop policy if exists "sign_clips_objects_read" on storage.objects;
create policy "sign_clips_objects_read" on storage.objects
  for select using (bucket_id = 'sign-clips' and public.is_staff());
