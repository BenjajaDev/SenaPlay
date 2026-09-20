-- ============================================================
-- Metadata de captura de videos para senas dinamicas (LSCh)
-- Complementa el bucket de Storage "senas-dinamicas-videos"
-- (estructura: <seña>/<signante_id>/<fecha>.mp4)
-- Ver ai_module/README.md, seccion "De local a Supabase", para el flujo
-- completo de sincronizacion.
-- Pegar completo en Supabase -> SQL Editor -> Run
-- ============================================================

-- 1) Tabla de metadata por video capturado
create table if not exists public.dynamic_sign_captures (
  id bigserial primary key,
  sign_id text not null,              -- nombre de carpeta de la seña (data/raw_videos/<sign_id>/)
  signer_id text not null,            -- id del signante (anonimizado, no PII)
  captured_at timestamptz not null default now(),
  consent boolean not null default false,   -- consentimiento informado del signante
  video_path text not null,           -- ruta dentro del bucket de Storage
  processing_status text not null default 'pendiente'
    check (processing_status in ('pendiente', 'procesado', 'error')),
  landmarks_path text,                -- ruta del .npy ya extraido, null hasta procesar
  notes text
);

create index if not exists idx_dynamic_sign_captures_sign
  on public.dynamic_sign_captures (sign_id);
create index if not exists idx_dynamic_sign_captures_status
  on public.dynamic_sign_captures (processing_status);

-- 2) Seguridad: sin lectura/escritura publica (esto es dato de entrenamiento
-- con consentimiento, no contenido publico del diccionario). Ajustar la
-- policy segun el rol de servicio que use el pipeline de sincronizacion.
alter table public.dynamic_sign_captures enable row level security;
drop policy if exists "dynamic_sign_captures_service_only" on public.dynamic_sign_captures;
create policy "dynamic_sign_captures_service_only" on public.dynamic_sign_captures
  for all using (auth.role() = 'service_role');
