-- Pruebas de RLS: usuario común, editor, admin y anónimo. Cada caso imprime
-- "OK ..." o "FALLA ..."; cualquier FALLA indica una política rota.

grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all tables in schema storage to anon, authenticated;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'user@x.cl', '{"full_name":"Usuaria"}'),
  ('00000000-0000-0000-0000-000000000002', 'editor@x.cl', '{}'),
  ('00000000-0000-0000-0000-000000000003', 'admin@x.cl', '{}');
update public.profiles set role = 'editor' where email = 'editor@x.cl';
update public.profiles set role = 'admin' where email = 'admin@x.cl';
select 'roles: ' || string_agg(email || '=' || role, ', ' order by email) from public.profiles;
set role authenticated;
set test.uid = '00000000-0000-0000-0000-000000000001';
do $$ begin update public.profiles set role='admin' where id = auth.uid(); raise notice 'FALLA: user se hizo admin'; exception when raise_exception then raise notice 'OK user no cambia su rol'; end $$;
do $$ begin insert into public.levels(id,title,category) values (99,'x','alfabeto'); raise notice 'FALLA'; exception when insufficient_privilege then raise notice 'OK user no inserta niveles (RLS)'; end $$;
do $$ begin perform public.save_level('{"id":50,"title":"x"}','[]'); raise notice 'FALLA'; exception when raise_exception then raise notice 'OK user no usa save_level'; end $$;
do $$ begin update public.app_config set value='{"enabled":true}' where key='maintenance'; if found then raise notice 'FALLA: user editó config'; else raise notice 'OK user no edita config'; end if; end $$;
select 'user ve perfiles (solo el suyo): ' || count(*) from public.profiles;
select 'user lee flags: ' || count(*) from public.feature_flags;
set test.uid = '00000000-0000-0000-0000-000000000002';
select 'editor save_level -> ' || public.save_level('{"id":13,"title":"Saludos","category":"vocabulario","sort_order":13}', '[{"type":"true-false","title":"VF","payload":{"statement":"Hola","answer":true}},{"type":"matching","payload":{"letters":["a","b"]}}]');
select 'ejercicios nivel 13: ' || string_agg(position || ':' || type, ', ' order by position) from public.exercises where level_id = 13;
select 'reemplaza -> ' || public.save_level('{"id":13,"title":"Saludos 2","category":"vocabulario"}', '[{"type":"typing","payload":{"sign":"a","answer":"A"}}]');
select 'nivel 13 ahora: ' || (select title from public.levels where id=13) || ' / ' || (select count(*) from public.exercises where level_id=13) || ' ejercicio(s)';
do $$ begin update public.app_config set value='{"enabled":true}' where key='maintenance'; if found then raise notice 'FALLA: editor editó config'; else raise notice 'OK editor no edita config'; end if; end $$;
insert into public.media (kind,title,storage_path,public_url,published) values ('video','Borrador','video/1.mp4','https://x/1.mp4',false), ('video','Publicado','video/2.mp4','https://x/2.mp4',true);
select 'editor ve media: ' || count(*) from public.media;
insert into storage.objects (bucket_id, name) values ('media', 'video/2.mp4');
select 'editor subió objeto a media: ok';
do $$ begin insert into public.exercises(level_id,position,type) values (13, 9, 'bailar'); raise notice 'FALLA tipo'; exception when check_violation then raise notice 'OK tipo inválido rechazado'; end $$;
set test.uid = '00000000-0000-0000-0000-000000000003';
update public.app_config set value = '{"enabled": true, "title":"Mant.", "message":"m"}' where key = 'maintenance';
update public.feature_flags set enabled = false, rollout_percentage = 50 where key = 'games.quiz';
select 'auditoria: ' || string_agg(table_name || '/' || record_key || '/' || action, '; ' order by id) from public.config_audit where changed_by is not null;
select 'updated_by admin: ' || ((select updated_by from public.app_config where key='maintenance') = auth.uid());
update public.profiles set role = 'editor' where email = 'user@x.cl';
select 'admin promueve a user: ' || (select role from public.profiles where email = 'user@x.cl');
set test.uid = '00000000-0000-0000-0000-000000000001';
do $$ begin update public.profiles set role = 'user' where email = 'user@x.cl'; raise notice 'FALLA: editor cambió su rol'; exception when raise_exception then raise notice 'OK editor no cambia su propio rol'; end $$;
set test.uid = '00000000-0000-0000-0000-000000000003';
update public.profiles set role = 'user' where email = 'user@x.cl';
set test.uid = '00000000-0000-0000-0000-000000000001';
do $$ begin insert into storage.objects (bucket_id, name) values ('media', 'video/hack.mp4'); raise notice 'FALLA'; exception when insufficient_privilege then raise notice 'OK user no sube a media'; end $$;
insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-000000000001/avatar.jpg');
select 'user sube su avatar: ok';
do $$ begin insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-000000000002/avatar.jpg'); raise notice 'FALLA'; exception when insufficient_privilege then raise notice 'OK user no sube avatar ajeno'; end $$;
reset test.uid; set role anon;
select 'anon ve media publicada: ' || count(*) from public.media;
select 'anon lee config: ' || count(*) from public.app_config;
select 'anon lee auditoria: ' || count(*) from public.config_audit;
select 'anon stats: ' || public.public_stats()::text;
