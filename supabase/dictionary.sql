-- ============================================================
-- Diccionario de senas de SeñaPlay (generado automaticamente)
-- Generado el: 2026-06-06T19:59:29.199Z
-- Pegar completo en Supabase -> SQL Editor -> Run
-- ============================================================

-- 1) Tabla
create table if not exists public.dictionary (
  id bigserial primary key,
  letter text not null,
  sign text not null,
  description text,
  category text not null,
  difficulty text,
  sort_order integer not null default 0
);

-- 2) Seguridad: lectura publica
alter table public.dictionary enable row level security;
drop policy if exists "dictionary_read" on public.dictionary;
create policy "dictionary_read" on public.dictionary for select using (true);

-- 3) Datos (se reemplazan en cada ejecucion)
truncate table public.dictionary;

insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('A', 'a', 'Mano cerrada, pulgar apoyado al costado', 'A-M', 'Fácil', 0);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('B', 'b', 'Dedos juntos hacia arriba, pulgar al costado', 'A-M', 'Fácil', 1);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('C', 'c', 'Mano curvada en forma de C', 'A-M', 'Fácil', 2);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('D', 'd', 'Solo el índice arriba; los demás bajan con el pulgar', 'A-M', 'Fácil', 3);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('E', 'e', 'Dedos flectados con la parte de arriba plana, pulgar adentro', 'A-M', 'Fácil', 4);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('F', 'f', 'Índice en horizontal con el pulgar apoyado encima', 'A-M', 'Medio', 5);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('G', 'g', 'Pulgar e índice en C; se quiebra la muñeca hacia adelante', 'A-M', 'Medio', 6);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('H', 'h', 'Índice y medio juntos en horizontal', 'A-M', 'Medio', 7);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('I', 'i', 'Meñique extendido hacia arriba', 'A-M', 'Medio', 8);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('J', 'j', 'Meñique dibuja una J en el aire', 'A-M', 'Medio', 9);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('K', 'k', 'Índice y medio separados, pulgar entre ambos', 'A-M', 'Medio', 10);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('L', 'l', 'Índice y pulgar en forma de L', 'A-M', 'Medio', 11);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('M', 'm', 'Índice, medio y anular rectos hacia abajo', 'A-M', 'Medio', 12);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('N', 'n', 'Índice y medio rectos hacia abajo', 'N-Z', 'Difícil', 13);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('Ñ', 'ñ', 'N con movimiento oscilatorio de la mano', 'N-Z', 'Difícil', 14);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('O', 'o', 'Todos los dedos forman un círculo', 'N-Z', 'Difícil', 15);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('P', 'p', 'Índice cruzado sobre el medio, como piernas cruzadas', 'N-Z', 'Difícil', 16);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('Q', 'q', 'Índice estirado apoyado vertical en el cuello', 'N-Z', 'Difícil', 17);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('R', 'r', 'Índice y medio cruzados', 'N-Z', 'Difícil', 18);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('S', 's', 'Índice estirado; dibuja una S en el aire', 'N-Z', 'Difícil', 19);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('T', 't', 'Pulgar vertical con el índice cruzado encima', 'N-Z', 'Difícil', 20);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('U', 'u', 'Índice y meñique levantados', 'N-Z', 'Difícil', 21);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('V', 'v', 'Índice y medio separados en V', 'N-Z', 'Difícil', 22);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('W', 'w', 'Índice, medio y anular separados', 'N-Z', 'Difícil', 23);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('X', 'x', 'Índice levantado; dibuja una X en el aire', 'N-Z', 'Difícil', 24);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('Y', 'y', 'Pulgar y meñique extendidos', 'N-Z', 'Difícil', 25);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('Z', 'z', 'Meñique levantado (como la I); dibuja una Z en el aire', 'N-Z', 'Difícil', 26);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('UNO (1)', 'uno', 'Se deletrea U-N-O', 'Números', 'Fácil', 27);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('DOS (2)', 'dos', 'Se deletrea D-O-S', 'Números', 'Fácil', 28);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('TRES (3)', 'tres', 'Se deletrea T-R-E-S', 'Números', 'Fácil', 29);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('CUATRO (4)', 'cuatro', 'Se deletrea C-U-A-T-R-O', 'Números', 'Medio', 30);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('CINCO (5)', 'cinco', 'Mano abierta, todos los dedos extendidos', 'Números', 'Fácil', 31);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('SEIS (6)', 'seis', 'Se deletrea S-E-I-S', 'Números', 'Medio', 32);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('SIETE (7)', 'siete', 'Se deletrea S-I-E-T-E', 'Números', 'Medio', 33);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('OCHO (8)', 'ocho', 'Se deletrea O-C-H-O', 'Números', 'Medio', 34);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('NUEVE (9)', 'nueve', 'Se deletrea N-U-E-V-E', 'Números', 'Medio', 35);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('DIEZ (10)', 'diez', 'Se deletrea D-I-E-Z', 'Números', 'Medio', 36);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('COMER', 'comer', 'Llevar la mano cerrada hacia la boca', 'Acciones', 'Fácil', 37);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('BEBER', 'beber', 'Simular tomar un vaso con la mano', 'Acciones', 'Fácil', 38);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('DORMIR', 'dormir', 'Mano apoyada en la mejilla, cabeza inclinada', 'Acciones', 'Medio', 39);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('CORRER', 'correr', 'Movimiento alternado de manos como brazos al correr', 'Acciones', 'Medio', 40);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('CAMINAR', 'caminar', 'Dedos índice y medio simulando pasos', 'Acciones', 'Medio', 41);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('JUGAR', 'jugar', 'Manos con pulgar y meñique extendidos, sacudidas', 'Acciones', 'Medio', 42);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('LEER', 'leer', 'Dos dedos en V apuntando a la palma como ojos leyendo', 'Acciones', 'Medio', 43);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('ESCRIBIR', 'escribir', 'Simular escribir con una mano sobre la palma', 'Acciones', 'Medio', 44);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('HABLAR', 'hablar', 'Dedos abriendo y cerrando frente a la boca', 'Acciones', 'Medio', 45);
insert into public.dictionary (letter, sign, description, category, difficulty, sort_order) values ('TRABAJAR', 'trabajar', 'Puños cerrados, uno golpea el otro', 'Acciones', 'Difícil', 46);
