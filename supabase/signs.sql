-- ============================================================
-- Senas lexicas reales de OratioLingo (generado automaticamente)
-- Fuente: Diccionario Bilingue LSCh-Espanol, MINEDUC
-- Generado el: 2026-06-06T20:12:38.984Z
-- Pegar completo en Supabase -> SQL Editor -> Run
-- ============================================================

-- 1) Tabla
create table if not exists public.signs (
  id bigserial primary key,
  word text not null,
  type text,
  meaning text,
  how_to text,
  theme text,
  page integer
);

-- 2) Seguridad: lectura publica
alter table public.signs enable row level security;
drop policy if exists "signs_read" on public.signs;
create policy "signs_read" on public.signs for select using (true);

-- 3) Datos (se reemplazan en cada ejecucion)
truncate table public.signs;

insert into public.signs (word, type, meaning, how_to, theme, page) values ('ABEJA', 'Sustantivo', 'Insecto que vive en colmenas y produce miel.', 'Mano en forma de pinza (índice y pulgar) cerca de la mejilla, con un pequeño movimiento de picadura.', 'Animales', 21);
insert into public.signs (word, type, meaning, how_to, theme, page) values ('ABOGADO', 'Sustantivo', 'Persona que trabaja en los tribunales de justicia.', 'Mano apoyada sobre el lado del pecho con un movimiento corto hacia abajo.', 'Profesiones', 21);
insert into public.signs (word, type, meaning, how_to, theme, page) values ('ABRAZAR', 'Verbo', 'Estrechar entre los brazos en señal de cariño.', 'Cruza ambos brazos sobre el pecho, como dándote un abrazo a ti mismo.', 'Acciones', 22);
insert into public.signs (word, type, meaning, how_to, theme, page) values ('ABREVIAR', 'Verbo', 'Acortar o reducir a menos tiempo o espacio.', 'Las dos manos, juntas frente al pecho, se acercan entre sí (movimiento hacia el centro).', 'Acciones', 22);
insert into public.signs (word, type, meaning, how_to, theme, page) values ('ABRIGARSE', 'Verbo', 'Cubrirse con ropa gruesa para defenderse del frío.', 'Ambas manos cerradas a la altura del pecho bajan por el torso, como cerrándote un abrigo.', 'Acciones', 22);
insert into public.signs (word, type, meaning, how_to, theme, page) values ('ABRIGO', 'Sustantivo', 'Prenda de vestir gruesa que se pone sobre las demás.', 'Como “abrigarse”: manos cerradas que bajan por el pecho, indicando la prenda.', 'Ropa', 22);
insert into public.signs (word, type, meaning, how_to, theme, page) values ('ABRIR-LATA', 'Verbo', 'Separar la parte superior de una lata de conservas.', 'Una mano sostiene la lata y la otra simula abrir la tapa con un giro.', 'Acciones', 23);
