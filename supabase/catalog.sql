-- ============================================================
-- Catalogo de niveles de OratioLingo (generado automaticamente)
-- Generado el: 2026-06-06T19:28:16.147Z
-- Pegar completo en Supabase -> SQL Editor -> Run
-- ============================================================

-- 1) Tablas
create table if not exists public.levels (
  id integer primary key,
  title text not null,
  description text,
  category text not null,
  available boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.exercises (
  id bigserial primary key,
  level_id integer not null references public.levels(id) on delete cascade,
  position integer not null,
  type text not null,
  title text,
  hint text,
  payload jsonb not null default '{}'::jsonb,
  unique (level_id, position)
);

-- 2) Seguridad: cualquiera puede LEER el catalogo, nadie puede escribirlo desde la app
alter table public.levels enable row level security;
alter table public.exercises enable row level security;
drop policy if exists "levels_read" on public.levels;
create policy "levels_read" on public.levels for select using (true);
drop policy if exists "exercises_read" on public.exercises;
create policy "exercises_read" on public.exercises for select using (true);

-- 3) Datos (se reemplazan en cada ejecucion)
truncate table public.exercises;
delete from public.levels;

insert into public.levels (id, title, description, category, available, sort_order) values (1, 'Letras A-E', 'Nivel inicial para dominar las primeras letras.', 'alfabeto', true, 0);
insert into public.exercises (level_id, position, type, title, hint, payload) values (1, 0, 'matching', 'Empareja las SEÑAS con sus letras', NULL, $j${"letters":["a","b","c","d","e"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (1, 1, 'multiple-choice', '¿Qué letra representa esta SEÑA?', 'Mano estirada con los cuatro dedos juntos hacia arriba y el pulgar doblado hacia un costado.', $j${"sign":"b","options":["A","B","D"],"correct":"B"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (1, 2, 'ordering', 'Ordena las letras en secuencia alfabética', NULL, $j${"letters":["A","B","C","D","E"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (1, 3, 'multiple-choice', '¿Qué letra representa esta SEÑA?', 'Solo el índice queda levantado; el medio, anular y meñique se bajan y se juntan con el pulgar.', $j${"sign":"d","options":["C","D","E"],"correct":"D"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (1, 4, 'typing', 'Escribe la letra correcta para esta SEÑA', 'Los dedos se flectan en los nudillos dejando la parte de arriba plana, con el pulgar doblado hacia adentro.', $j${"sign":"e","answer":"E"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (1, 5, 'true-false', '¿Es correcta esta afirmación?', 'La mano se cierra por completo y el pulgar queda apoyado al costado, sin movimiento.', $j${"statement":"La SEÑA de la letra A se hace con el puño cerrado y el pulgar al costado.","answer":true}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (1, 6, 'multiple-choice', '¿Qué letra representa esta SEÑA?', 'La mano y los dedos se curvan formando un arco, como dibujar una C.', $j${"sign":"c","options":["A","C","E"],"correct":"C"}$j$::jsonb);

insert into public.levels (id, title, description, category, available, sort_order) values (2, 'Letras F-J', 'Refuerza reconocimiento visual y velocidad de respuesta.', 'alfabeto', true, 1);
insert into public.exercises (level_id, position, type, title, hint, payload) values (2, 0, 'matching', 'Empareja las SEÑAS con sus letras', NULL, $j${"letters":["f","g","h","i","j"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (2, 1, 'multiple-choice', '¿Qué letra representa esta SEÑA?', 'El pulgar y el índice forman una C mientras los demás dedos se esconden; se quiebra la muñeca hacia adelante una vez.', $j${"sign":"g","options":["F","G","H"],"correct":"G"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (2, 2, 'ordering', 'Ordena las letras en secuencia alfabética', NULL, $j${"letters":["F","G","H","I","J"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (2, 3, 'multiple-choice', '¿Qué letra representa esta SEÑA?', 'El meñique se levanta solo.', $j${"sign":"i","options":["H","I","J"],"correct":"I"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (2, 4, 'typing', 'Escribe la letra correcta para esta SEÑA', 'El índice y el medio van juntos en horizontal; el anular y el meñique se esconden con el pulgar.', $j${"sign":"h","answer":"H"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (2, 5, 'true-false', '¿Es correcta esta afirmación?', 'En la J se traza una jota con el meñique, no con el índice.', $j${"statement":"La SEÑA de la letra J se realiza solo con el dedo índice extendido.","answer":false}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (2, 6, 'typing', 'Escribe la letra correcta para esta SEÑA', 'El meñique traza una J en el aire.', $j${"sign":"j","answer":"J"}$j$::jsonb);

insert into public.levels (id, title, description, category, available, sort_order) values (3, 'Letras K-Ñ', 'Introduce combinaciones con mayor precisión manual.', 'alfabeto', true, 2);
insert into public.exercises (level_id, position, type, title, hint, payload) values (3, 0, 'matching', 'Empareja las SEÑAS con sus letras', NULL, $j${"letters":["k","l","m","n","N~"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (3, 1, 'multiple-choice', '¿Qué letra representa esta SEÑA?', 'El índice y el medio quedan levantados y separados, con el pulgar apoyado entre ambos.', $j${"sign":"k","options":["L","K","N"],"correct":"K"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (3, 2, 'ordering', 'Ordena las letras en secuencia alfabética', NULL, $j${"letters":["K","L","M","N","N~"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (3, 3, 'multiple-choice', '¿Qué letra representa esta SEÑA?', 'El índice y el medio van rectos apuntando hacia abajo; el anular y el meñique se esconden.', $j${"sign":"n","options":["Ñ","M","N"],"correct":"N"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (3, 4, 'typing', 'Escribe la letra correcta para esta SEÑA', 'Igual que la N (índice y medio hacia abajo), pero con un movimiento oscilatorio de la mano.', $j${"sign":"n~","answer":"Ñ"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (3, 5, 'true-false', '¿Es correcta esta afirmación?', 'El pulgar y el índice se extienden y separan formando una L; los demás dedos se esconden.', $j${"statement":"La SEÑA de la L se hace formando una L con el pulgar e índice.","answer":true}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (3, 6, 'multiple-choice', '¿Qué letra representa esta SEÑA?', 'Pulgar e índice extendidos formando una L.', $j${"sign":"l","options":["K","L","N"],"correct":"L"}$j$::jsonb);

insert into public.levels (id, title, description, category, available, sort_order) values (4, 'Letras O-S', 'Consolidación de lectura rápida de SEÑAS intermedias.', 'alfabeto', true, 3);
insert into public.exercises (level_id, position, type, title, hint, payload) values (4, 0, 'matching', 'Empareja las SEÑAS con sus letras', NULL, $j${"letters":["o","p","q","r","s"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (4, 1, 'multiple-choice', '¿Qué letra representa esta SEÑA?', 'El índice y el medio se extienden y el índice se cruza por encima del medio, como piernas cruzadas.', $j${"sign":"p","options":["Q","P","R"],"correct":"P"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (4, 2, 'ordering', 'Ordena las letras en secuencia alfabética', NULL, $j${"letters":["O","P","Q","R","S"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (4, 3, 'multiple-choice', '¿Qué letra representa esta SEÑA?', 'Se cierran todos los dedos dejando el índice estirado y se dibuja una S en el aire con la muñeca.', $j${"sign":"s","options":["R","S","Q"],"correct":"S"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (4, 4, 'typing', 'Escribe la letra correcta para esta SEÑA', 'Solo el índice se estira y se apoya vertical en el cuello, mientras el rostro simula el círculo.', $j${"sign":"q","answer":"Q"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (4, 5, 'true-false', '¿Es correcta esta afirmación?', 'Todos los dedos se curvan juntando las puntas hasta formar un círculo.', $j${"statement":"La SEÑA de la O se forma haciendo un círculo con todos los dedos.","answer":true}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (4, 6, 'multiple-choice', '¿Qué letra representa esta SEÑA?', 'El índice y el medio se levantan cruzados entre sí; el pulgar, anular y meñique se esconden.', $j${"sign":"r","options":["P","R","V"],"correct":"R"}$j$::jsonb);

insert into public.levels (id, title, description, category, available, sort_order) values (5, 'Letras T-Z', 'Nivel avanzado con ejercicios combinados.', 'alfabeto', true, 4);
insert into public.exercises (level_id, position, type, title, hint, payload) values (5, 0, 'matching', 'Empareja las SEÑAS con sus letras', NULL, $j${"letters":["t","u","v","w","x","y","z"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (5, 1, 'multiple-choice', '¿Qué letra representa esta SEÑA?', 'El índice, el medio y el anular se levantan separados; el meñique se esconde con el pulgar.', $j${"sign":"w","options":["V","W","X"],"correct":"W"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (5, 2, 'recognition', 'Selecciona las letras correctas para estas SEÑAS', NULL, $j${"signs":["t","u","v"],"options":["T","U","V","W","X","Y","Z"],"correct":["T","U","V"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (5, 3, 'ordering', 'Ordena las letras en secuencia alfabética', NULL, $j${"letters":["T","U","V","W","X","Y","Z"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (5, 4, 'typing', 'Escribe la letra correcta para esta SEÑA', 'Se deja solo el meñique levantado (como en la I) y se dibuja una Z en el aire con la muñeca.', $j${"sign":"z","answer":"Z"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (5, 5, 'build-word', 'Construye la palabra COMER', NULL, $j${"word":"COMER","letters":["C","O","M","E","R","A","N","S","U"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (5, 6, 'interpret-signs', 'Interpreta las SEÑAS y forma la palabra', NULL, $j${"signs":["m","u","n","d","o"],"word":"MUNDO","letters":["M","U","N","D","O","R","S","T","L"]}$j$::jsonb);

insert into public.levels (id, title, description, category, available, sort_order) values (6, 'Números 0-9', 'Aprende a deletrear los números del 1 al 10 en señas.', 'numeros', true, 5);
insert into public.exercises (level_id, position, type, title, hint, payload) values (6, 0, 'word-meaning', '¿Qué número deletrean estas SEÑAS?', 'U-N-O = 1, el primer número.', $j${"signs":["u","n","o"],"word":"UNO","options":["Uno (1)","Dos (2)","Tres (3)"],"correct":"Uno (1)"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (6, 1, 'word-meaning', '¿Qué número es?', 'D-O-S = 2.', $j${"signs":["d","o","s"],"word":"DOS","options":["Diez","Dos","Doce"],"correct":"Dos"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (6, 2, 'interpret-signs', 'Forma el número TRES', NULL, $j${"signs":["t","r","e","s"],"word":"TRES","letters":["T","R","E","S","A","O","I"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (6, 3, 'interpret-signs', 'Forma el número CUATRO', NULL, $j${"signs":["c","u","a","t","r","o"],"word":"CUATRO","letters":["C","U","A","T","R","O","I","N","L"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (6, 4, 'word-meaning', '¿Qué número es?', 'C-I-N-C-O = 5, los dedos de una mano.', $j${"signs":["c","i","n","c","o"],"word":"CINCO","options":["Cinco","Siete","Nueve"],"correct":"Cinco"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (6, 5, 'true-false', '¿Es correcta esta afirmación?', 'Como mostrar la palma con todos los dedos arriba.', $j${"statement":"En lengua de señas el número CINCO se representa con la palma abierta y los cinco dedos extendidos.","answer":true}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (6, 6, 'interpret-signs', 'Forma el número SEIS', NULL, $j${"signs":["s","e","i","s"],"word":"SEIS","letters":["S","E","I","S","O","T","R"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (6, 7, 'word-meaning', '¿Qué número es?', 'S-I-E-T-E = 7.', $j${"signs":["s","i","e","t","e"],"word":"SIETE","options":["Seis","Siete","Ocho"],"correct":"Siete"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (6, 8, 'interpret-signs', 'Forma el número OCHO', NULL, $j${"signs":["o","c","h","o"],"word":"OCHO","letters":["O","C","H","O","S","A","P"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (6, 9, 'word-meaning', '¿Qué número es?', 'D-I-E-Z = 10, el número final del bloque.', $j${"signs":["d","i","e","z"],"word":"DIEZ","options":["Cero","Diez","Doce"],"correct":"Diez"}$j$::jsonb);

insert into public.levels (id, title, description, category, available, sort_order) values (7, 'Saludos básicos', 'Hola, adiós, gracias y otras frases del día a día.', 'vocabulario', true, 6);
insert into public.exercises (level_id, position, type, title, hint, payload) values (7, 0, 'word-meaning', '¿Qué significa esta palabra en SEÑAS?', 'Es la forma más común de comenzar una conversación.', $j${"signs":["h","o","l","a"],"word":"HOLA","options":["Adiós","Saludo / Hola","Gracias"],"correct":"Saludo / Hola"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (7, 1, 'interpret-signs', 'Interpreta las SEÑAS y forma el saludo', NULL, $j${"signs":["h","o","l","a"],"word":"HOLA","letters":["H","O","L","A","R","S","E"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (7, 2, 'word-meaning', '¿Qué significa esta palabra en SEÑAS?', 'Se usa al terminar una conversación.', $j${"signs":["a","d","i","o","s"],"word":"ADIOS","options":["Adiós / Despedida","Bienvenido","Por favor"],"correct":"Adiós / Despedida"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (7, 3, 'interpret-signs', 'Forma la palabra de agradecimiento', NULL, $j${"signs":["g","r","a","c","i","a","s"],"word":"GRACIAS","letters":["G","R","A","C","I","A","S","M","D","L"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (7, 4, 'word-meaning', '¿Qué significa esta palabra?', 'Se usa para pedir disculpas a alguien.', $j${"signs":["p","e","r","d","o","n"],"word":"PERDON","options":["Disculpa","Permiso","Por favor"],"correct":"Disculpa"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (7, 5, 'true-false', '¿Es correcta esta afirmación?', 'Igual que en español escrito.', $j${"statement":"La palabra \"HOLA\" en señas se deletrea con H-O-L-A.","answer":true}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (7, 6, 'interpret-signs', 'Forma la palabra "SI"', NULL, $j${"signs":["s","i"],"word":"SI","letters":["S","I","A","O","N"]}$j$::jsonb);

insert into public.levels (id, title, description, category, available, sort_order) values (8, 'Mi familia', 'Mamá, papá, hermano y otros miembros de la familia.', 'vocabulario', true, 7);
insert into public.exercises (level_id, position, type, title, hint, payload) values (8, 0, 'word-meaning', '¿Qué palabra significan estas SEÑAS?', 'Es la figura materna en la familia.', $j${"signs":["m","a","m","a"],"word":"MAMA","options":["Mamá","Papá","Hermana"],"correct":"Mamá"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (8, 1, 'word-meaning', '¿Qué palabra significan estas SEÑAS?', 'La figura paterna en la familia.', $j${"signs":["p","a","p","a"],"word":"PAPA","options":["Abuelo","Tío","Papá"],"correct":"Papá"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (8, 2, 'interpret-signs', 'Forma la palabra del hijo', NULL, $j${"signs":["h","i","j","o"],"word":"HIJO","letters":["H","I","J","O","A","R","M"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (8, 3, 'interpret-signs', 'Forma la palabra "ABUELO"', NULL, $j${"signs":["a","b","u","e","l","o"],"word":"ABUELO","letters":["A","B","U","E","L","O","M","P","R"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (8, 4, 'word-meaning', '¿A quién describen estas SEÑAS?', 'Hermano de mamá o papá.', $j${"signs":["t","i","o"],"word":"TIO","options":["Tío","Abuelo","Primo"],"correct":"Tío"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (8, 5, 'true-false', '¿Es correcta esta afirmación?', 'P-A-P-A son 4 letras.', $j${"statement":"La palabra \"PAPA\" tiene 4 letras en señas.","answer":true}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (8, 6, 'interpret-signs', 'Forma la palabra HERMANA', NULL, $j${"signs":["h","e","r","m","a","n","a"],"word":"HERMANA","letters":["H","E","R","M","A","N","A","P","L","O"]}$j$::jsonb);

insert into public.levels (id, title, description, category, available, sort_order) values (9, 'Comida y bebida', 'Vocabulario esencial para hablar de alimentos.', 'vocabulario', true, 8);
insert into public.exercises (level_id, position, type, title, hint, payload) values (9, 0, 'word-meaning', '¿Qué significan estas SEÑAS?', 'Bebida más esencial.', $j${"signs":["a","g","u","a"],"word":"AGUA","options":["Pan","Agua","Café"],"correct":"Agua"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (9, 1, 'word-meaning', '¿Qué significan estas SEÑAS?', 'Alimento básico de panadería.', $j${"signs":["p","a","n"],"word":"PAN","options":["Carne","Pan","Queso"],"correct":"Pan"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (9, 2, 'interpret-signs', 'Forma la palabra de la acción', NULL, $j${"signs":["c","o","m","e","r"],"word":"COMER","letters":["C","O","M","E","R","B","L","P"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (9, 3, 'interpret-signs', 'Forma la palabra de la fruta', NULL, $j${"signs":["m","a","n","z","a","n","a"],"word":"MANZANA","letters":["M","A","N","Z","A","N","A","R","P","L"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (9, 4, 'word-meaning', '¿Qué significan estas SEÑAS?', 'Bebida blanca de origen animal.', $j${"signs":["l","e","c","h","e"],"word":"LECHE","options":["Jugo","Leche","Vino"],"correct":"Leche"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (9, 5, 'true-false', '¿Es correcta esta afirmación?', 'C-O-M-E-R son 5 letras.', $j${"statement":"La palabra \"COMER\" se deletrea con 5 letras en señas.","answer":true}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (9, 6, 'interpret-signs', 'Forma la palabra CAFE', NULL, $j${"signs":["c","a","f","e"],"word":"CAFE","letters":["C","A","F","E","P","L","M","O"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (9, 7, 'multiple-choice', '¿Qué letra inicia la palabra "AGUA"?', 'La primera letra del abecedario.', $j${"sign":"a","options":["A","E","O"],"correct":"A"}$j$::jsonb);

insert into public.levels (id, title, description, category, available, sort_order) values (10, 'Sentimientos', 'Expresa cómo te sientes con señas.', 'vocabulario', true, 9);
insert into public.exercises (level_id, position, type, title, hint, payload) values (10, 0, 'word-meaning', '¿Qué sentimiento expresan estas SEÑAS?', 'La emoción de la alegría.', $j${"signs":["f","e","l","i","z"],"word":"FELIZ","options":["Triste","Feliz","Enojado"],"correct":"Feliz"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (10, 1, 'word-meaning', '¿Qué sentimiento es?', 'Emoción opuesta a feliz.', $j${"signs":["t","r","i","s","t","e"],"word":"TRISTE","options":["Triste","Cansado","Sorprendido"],"correct":"Triste"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (10, 2, 'interpret-signs', 'Forma la palabra "AMOR"', NULL, $j${"signs":["a","m","o","r"],"word":"AMOR","letters":["A","M","O","R","P","L","B"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (10, 3, 'interpret-signs', 'Forma la palabra del sentimiento', NULL, $j${"signs":["m","i","e","d","o"],"word":"MIEDO","letters":["M","I","E","D","O","P","R","L"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (10, 4, 'word-meaning', '¿Qué significa esta palabra?', 'Emoción de molestia o ira.', $j${"signs":["e","n","o","j","o"],"word":"ENOJO","options":["Enojo / Ira","Tristeza","Sorpresa"],"correct":"Enojo / Ira"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (10, 5, 'true-false', '¿Es correcta esta afirmación?', 'A-M-O-R son 4 letras.', $j${"statement":"En señas, la palabra \"AMOR\" tiene 4 letras.","answer":true}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (10, 6, 'interpret-signs', 'Forma la palabra CALMA', NULL, $j${"signs":["c","a","l","m","a"],"word":"CALMA","letters":["C","A","L","M","A","P","R","T"]}$j$::jsonb);

insert into public.levels (id, title, description, category, available, sort_order) values (11, 'Acciones cotidianas', 'Verbos y acciones del día a día.', 'vocabulario', true, 10);
insert into public.exercises (level_id, position, type, title, hint, payload) values (11, 0, 'word-meaning', '¿Qué acción representan estas SEÑAS?', 'Movimiento rápido con los pies.', $j${"signs":["c","o","r","r","e","r"],"word":"CORRER","options":["Caminar","Correr","Saltar"],"correct":"Correr"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (11, 1, 'word-meaning', '¿Qué acción es?', 'Actividad que hacemos cada noche.', $j${"signs":["d","o","r","m","i","r"],"word":"DORMIR","options":["Despertar","Dormir","Soñar"],"correct":"Dormir"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (11, 2, 'interpret-signs', 'Forma el verbo de la acción', NULL, $j${"signs":["j","u","g","a","r"],"word":"JUGAR","letters":["J","U","G","A","R","L","M","P"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (11, 3, 'interpret-signs', 'Forma la palabra "LEER"', NULL, $j${"signs":["l","e","e","r"],"word":"LEER","letters":["L","E","E","R","P","M","A","B"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (11, 4, 'word-meaning', '¿Qué acción es?', 'Usar un lápiz sobre papel.', $j${"signs":["e","s","c","r","i","b","i","r"],"word":"ESCRIBIR","options":["Leer","Escribir","Dibujar"],"correct":"Escribir"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (11, 5, 'true-false', '¿Es correcta esta afirmación?', 'La palabra completa se deletrea con varias letras.', $j${"statement":"La SEÑA de \"CORRER\" usa solo una letra.","answer":false}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (11, 6, 'interpret-signs', 'Forma la palabra HABLAR', NULL, $j${"signs":["h","a","b","l","a","r"],"word":"HABLAR","letters":["H","A","B","L","A","R","M","P","C"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (11, 7, 'multiple-choice', '¿Con qué letra inicia "DORMIR"?', 'La D deja solo el índice levantado; los demás dedos se bajan junto al pulgar.', $j${"sign":"d","options":["B","D","P"],"correct":"D"}$j$::jsonb);

insert into public.levels (id, title, description, category, available, sort_order) values (12, 'Lugares', 'Sitios y lugares comunes en lengua de señas.', 'vocabulario', true, 11);
insert into public.exercises (level_id, position, type, title, hint, payload) values (12, 0, 'word-meaning', '¿Qué lugar representan estas SEÑAS?', 'Donde vivimos con la familia.', $j${"signs":["c","a","s","a"],"word":"CASA","options":["Casa","Escuela","Iglesia"],"correct":"Casa"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (12, 1, 'word-meaning', '¿Qué lugar es?', 'Espacio verde donde jugamos.', $j${"signs":["p","a","r","q","u","e"],"word":"PARQUE","options":["Plaza","Parque","Bosque"],"correct":"Parque"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (12, 2, 'interpret-signs', 'Forma el nombre del lugar', NULL, $j${"signs":["e","s","c","u","e","l","a"],"word":"ESCUELA","letters":["E","S","C","U","E","L","A","M","P","R"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (12, 3, 'interpret-signs', 'Forma la palabra "CIUDAD"', NULL, $j${"signs":["c","i","u","d","a","d"],"word":"CIUDAD","letters":["C","I","U","D","A","D","M","P","L"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (12, 4, 'word-meaning', '¿Qué lugar es?', 'Lugar donde atienden a los enfermos.', $j${"signs":["h","o","s","p","i","t","a","l"],"word":"HOSPITAL","options":["Hospital","Farmacia","Clínica"],"correct":"Hospital"}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (12, 5, 'true-false', '¿Es correcta esta afirmación?', 'C-A-S-A.', $j${"statement":"La SEÑA de \"CASA\" empieza con la letra C.","answer":true}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (12, 6, 'interpret-signs', 'Forma la palabra TRABAJO', NULL, $j${"signs":["t","r","a","b","a","j","o"],"word":"TRABAJO","letters":["T","R","A","B","A","J","O","P","M","L"]}$j$::jsonb);
insert into public.exercises (level_id, position, type, title, hint, payload) values (12, 7, 'multiple-choice', '¿Qué letra es esta?', 'Primera letra de "PARQUE".', $j${"sign":"p","options":["B","P","D"],"correct":"P"}$j$::jsonb);
