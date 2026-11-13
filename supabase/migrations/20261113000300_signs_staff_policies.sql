-- ============================================================
-- 20261113000300 · Escritura del staff en el diccionario de señas
-- ------------------------------------------------------------
-- 20260924000200_content_admin.sql crea `signs_staff_*` solo si `signs` ya
-- existía. Donde signs.sql se aplicó después, el staff no podía escribir y el
-- importador del club fallaba con «violates row-level security policy».
-- Estas son las mismas políticas, sin ampliar nada: lectura pública
-- (`signs_read`, de signs.sql) y escritura solo de `public.is_staff()`.
-- Idempotente: se puede aplicar más de una vez.
-- ============================================================

alter table public.signs enable row level security;

drop policy if exists "signs_staff_insert" on public.signs;
create policy "signs_staff_insert" on public.signs for insert with check (public.is_staff());

drop policy if exists "signs_staff_update" on public.signs;
create policy "signs_staff_update" on public.signs for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "signs_staff_delete" on public.signs;
create policy "signs_staff_delete" on public.signs for delete using (public.is_staff());
