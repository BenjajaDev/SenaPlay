-- ============================================================
-- 005 · Métricas públicas para la landing y resumen del panel
-- ------------------------------------------------------------
-- Requiere 001–004. Expone SOLO conteos agregados (sin datos personales)
-- para que la landing muestre cifras reales sin abrir las tablas.
-- ============================================================

create or replace function public.public_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'levels', (select count(*) from public.levels where available),
    'exercises', (select count(*) from public.exercises),
    'dictionary', (select count(*) from public.dictionary),
    'vocabulary', (select count(*) from public.signs),
    'videos', (select count(*) from public.media where kind = 'video' and published),
    'learners', (select count(*) from public.profiles)
  );
$$;

grant execute on function public.public_stats() to anon, authenticated;
