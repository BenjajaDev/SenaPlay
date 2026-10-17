-- ============================================================
-- 009 · Redes sociales del equipo + perfil propio en el panel
-- ------------------------------------------------------------
-- Requiere 001 (profiles) y 006 (team_members). Idempotente.
--
-- 1. team_members.socials: lista de redes de cada integrante que la
--    landing muestra al expandir su tarjeta. Formato (ver
--    web/src/data/types.ts → SocialLink):
--      [{ "network": "linkedin", "url": "https://…", "animation": "bounce" }]
--    Las políticas de team_members ya cubren la columna (lectura pública
--    de publicados, escritura solo staff).
-- 2. «Mi perfil» del panel: cada persona edita su nombre (la política
--    profiles_update_own_or_admin ya lo permite y guard_profile_role impide
--    tocar el rol). El correo vive en auth.users y Supabase lo cambia solo
--    después de que la persona confirma el enlace; este trigger copia el
--    correo confirmado a profiles para que el panel no muestre uno viejo.
-- ============================================================

-- ── 1. Redes sociales ────────────────────────────────────────
alter table public.team_members add column if not exists socials jsonb not null default '[]'::jsonb;

alter table public.team_members drop constraint if exists team_members_socials_is_array;
alter table public.team_members add constraint team_members_socials_is_array
  check (jsonb_typeof(socials) = 'array' and jsonb_array_length(socials) <= 6);

-- ── 2. Correo de profiles sincronizado con auth.users ────────
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email();
