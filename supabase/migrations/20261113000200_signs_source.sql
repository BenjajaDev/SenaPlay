-- ============================================================
-- 20261113000200 · Fuente de las señas del diccionario
-- ------------------------------------------------------------
-- Requiere signs.sql. Diseño en docs/11-contenido-club-talca.md.
--
-- `signs` solo sabía de la página del diccionario MINEDUC (`page`). Las señas
-- del Club de Sordos de Talca no tienen página: llevan su fuente en `source`
-- («Club de Sordos de Talca»). Las filas MINEDUC la dejan en null.
--
-- RLS no cambia: la lectura sigue siendo pública (`signs_read`) y la escritura
-- solo del staff (`signs_staff_*`, de 20260924000200_content_admin.sql).
-- Idempotente: se puede aplicar más de una vez.
-- ============================================================

alter table public.signs add column if not exists source text;

-- Una fuente, si existe, no puede ser un texto vacío.
alter table public.signs drop constraint if exists signs_source_not_blank;
alter table public.signs add constraint signs_source_not_blank check (source is null or length(btrim(source)) > 0);
