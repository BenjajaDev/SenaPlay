-- ============================================================
-- 003 · Configuración remota y feature flags
-- ------------------------------------------------------------
-- Requiere 001. La app lee estas tablas al iniciar (y al volver a primer
-- plano) para ajustar su comportamiento SIN publicar una versión nueva.
-- Lectura pública; escritura solo admin; cada cambio queda auditado.
--
-- Claves de app_config que la app entiende (ver
-- src/features/remoteConfig/domain/remoteConfig.js):
--   maintenance    { enabled, title, message }
--   announcements  [{ id, title, message, tone, startsAt, endsAt, dismissible }]
--   lives          { mode: 'session'|'pool', maxLives, refillMinutes }
--   scoring        { hitPoints, failPenalty, lifeBonus, hintPenalty, starThresholds }
--   difficulty     { quizSecondsPerQuestion, aiConfidenceThreshold,
--                    spellingConfidenceThreshold, hintsEnabled }
--   appVersion     { minimum, recommended, storeUrl }
-- ============================================================

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  rollout_percentage integer not null default 100 check (rollout_percentage between 0 and 100),
  starts_at timestamptz,
  ends_at timestamptz,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

-- Auditoría: quién cambió qué y cuándo (útil para revertir un error).
create table if not exists public.config_audit (
  id bigserial primary key,
  table_name text not null,
  record_key text not null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create or replace function public.audit_config_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'DELETE' then
    new.updated_at = now();
    new.updated_by = auth.uid();
  end if;
  insert into public.config_audit (table_name, record_key, action, old_value, new_value, changed_by)
  values (
    tg_table_name,
    coalesce(new.key, old.key),
    tg_op,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    auth.uid()
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists app_config_audit on public.app_config;
create trigger app_config_audit before insert or update or delete on public.app_config
  for each row execute function public.audit_config_change();
drop trigger if exists feature_flags_audit on public.feature_flags;
create trigger feature_flags_audit before insert or update or delete on public.feature_flags
  for each row execute function public.audit_config_change();

alter table public.app_config enable row level security;
alter table public.feature_flags enable row level security;
alter table public.config_audit enable row level security;

drop policy if exists "app_config_read" on public.app_config;
create policy "app_config_read" on public.app_config for select using (true);
drop policy if exists "app_config_admin_write" on public.app_config;
create policy "app_config_admin_write" on public.app_config for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "feature_flags_read" on public.feature_flags;
create policy "feature_flags_read" on public.feature_flags for select using (true);
drop policy if exists "feature_flags_admin_write" on public.feature_flags;
create policy "feature_flags_admin_write" on public.feature_flags for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "config_audit_admin_read" on public.config_audit;
create policy "config_audit_admin_read" on public.config_audit for select using (public.is_admin());

-- ── Valores iniciales (idénticos al comportamiento actual de la app) ──
insert into public.app_config (key, value, description) values
  ('maintenance', '{"enabled": false, "title": "Estamos en mantenimiento", "message": "Volvemos en unos minutos. ¡Gracias por tu paciencia!"}', 'Bloquea la app con un aviso (los admins pueden seguir entrando).'),
  ('announcements', '[]', 'Avisos globales con ventana de fechas.'),
  ('lives', '{"mode": "session", "maxLives": 3, "refillMinutes": 20}', 'Vidas por nivel o pool global con recarga.'),
  ('scoring', '{"hitPoints": 100, "failPenalty": 30, "lifeBonus": 20, "hintPenalty": 5, "starThresholds": [0.4, 0.7, 0.9]}', 'Puntaje y umbrales de estrellas.'),
  ('difficulty', '{"quizSecondsPerQuestion": 10, "aiConfidenceThreshold": 0.6, "spellingConfidenceThreshold": 0.55, "hintsEnabled": true}', 'Umbrales de dificultad.'),
  ('appVersion', '{"minimum": "1.0.0", "recommended": "1.0.0", "storeUrl": ""}', 'Versión mínima (bloquea) y recomendada (aviso).')
on conflict (key) do nothing;

insert into public.feature_flags (key, enabled, description) values
  ('games.memory', true, 'Juego de memoria'),
  ('games.quiz', true, 'Quiz rápido'),
  ('games.practice', true, 'Práctica con cámara e IA'),
  ('games.spelling', true, 'Deletreo con cámara'),
  ('games.cameraTranslation', true, 'Traducción en vivo'),
  ('games.dynamicMonitor', true, 'Señas dinámicas (beta)'),
  ('videos.enabled', true, 'Pestaña de videos'),
  ('feedback.haptics', true, 'Vibración global'),
  ('levels.celebration', true, 'Confeti al completar niveles')
on conflict (key) do nothing;
