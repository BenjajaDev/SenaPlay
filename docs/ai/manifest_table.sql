-- ============================================================
-- PROPUESTA (no aplicada): reflejar data/manifest.csv en Supabase.
--
-- supabase/dynamic_signs_capture.sql ya define dynamic_sign_captures con
-- sign_id, signer_id, video_path y processing_status. En lugar de crear una
-- tabla nueva, se propone extenderla con las columnas del manifiesto, para
-- que un video subido desde la app y uno grabado localmente terminen con la
-- misma metadata y el mismo criterio de descarte.
--
-- Correspondencia manifiesto → tabla:
--   video_path    → video_path (ya existe)
--   sign_class    → sign_id (ya existe)
--   signer_id     → signer_id (ya existe)
--   sign_type, session_id, batch_id, n_frames, fps, duration_s, device,
--   status, discard_reason → columnas nuevas (abajo)
--
-- processing_status (pendiente/procesado/error) describe la extracción;
-- status (ok/discarded) describe si el video entra al entrenamiento. Son
-- independientes: un video puede estar procesado y descartado.
-- ============================================================

alter table public.dynamic_sign_captures
  add column if not exists sign_type text
    check (sign_type in ('static', 'dynamic')),
  add column if not exists session_id text,
  add column if not exists batch_id text,
  add column if not exists n_frames integer check (n_frames >= 0),
  add column if not exists fps real check (fps >= 0),
  add column if not exists duration_s real check (duration_s >= 0),
  add column if not exists device text,
  add column if not exists status text not null default 'ok'
    check (status in ('ok', 'discarded')),
  add column if not exists discard_reason text;

create index if not exists idx_dynamic_sign_captures_batch
  on public.dynamic_sign_captures (batch_id);
create index if not exists idx_dynamic_sign_captures_signer
  on public.dynamic_sign_captures (signer_id);

-- Vista para el resumen que imprime data/manifest.py (muestras útiles por clase y señante).
create or replace view public.dynamic_sign_captures_resumen as
select sign_id, signer_id, count(*) as videos_utiles
from public.dynamic_sign_captures
where status = 'ok' and sign_type = 'dynamic'
group by sign_id, signer_id;

-- La RLS existente (solo service_role) cubre las columnas nuevas. La vista hereda
-- los permisos de la tabla base al consultarse con security_invoker:
alter view public.dynamic_sign_captures_resumen set (security_invoker = on);
