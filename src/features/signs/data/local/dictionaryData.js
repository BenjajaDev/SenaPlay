// Diccionario de senas (letras, numeros y acciones). Sirve como respaldo local
// y como fuente para generar el SQL de la tabla public.dictionary en Supabase.
export const DICTIONARY_ENTRIES = [
  // Letras A-M
  { letter: 'A', sign: 'a', description: 'Mano cerrada, pulgar apoyado al costado', category: 'A-M', difficulty: 'Fácil' },
  { letter: 'B', sign: 'b', description: 'Dedos juntos hacia arriba, pulgar al costado', category: 'A-M', difficulty: 'Fácil' },
  { letter: 'C', sign: 'c', description: 'Mano curvada en forma de C', category: 'A-M', difficulty: 'Fácil' },
  { letter: 'D', sign: 'd', description: 'Solo el índice arriba; los demás bajan con el pulgar', category: 'A-M', difficulty: 'Fácil' },
  { letter: 'E', sign: 'e', description: 'Dedos flectados con la parte de arriba plana, pulgar adentro', category: 'A-M', difficulty: 'Fácil' },
  { letter: 'F', sign: 'f', description: 'Índice en horizontal con el pulgar apoyado encima', category: 'A-M', difficulty: 'Medio' },
  { letter: 'G', sign: 'g', description: 'Pulgar e índice en C; se quiebra la muñeca hacia adelante', category: 'A-M', difficulty: 'Medio' },
  { letter: 'H', sign: 'h', description: 'Índice y medio juntos en horizontal', category: 'A-M', difficulty: 'Medio' },
  { letter: 'I', sign: 'i', description: 'Meñique extendido hacia arriba', category: 'A-M', difficulty: 'Medio' },
  { letter: 'J', sign: 'j', description: 'Meñique dibuja una J en el aire', category: 'A-M', difficulty: 'Medio' },
  { letter: 'K', sign: 'k', description: 'Índice y medio separados, pulgar entre ambos', category: 'A-M', difficulty: 'Medio' },
  { letter: 'L', sign: 'l', description: 'Índice y pulgar en forma de L', category: 'A-M', difficulty: 'Medio' },
  { letter: 'M', sign: 'm', description: 'Índice, medio y anular rectos hacia abajo', category: 'A-M', difficulty: 'Medio' },

  // Letras N-Z
  { letter: 'N', sign: 'n', description: 'Índice y medio rectos hacia abajo', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'Ñ', sign: 'ñ', description: 'N con movimiento oscilatorio de la mano', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'O', sign: 'o', description: 'Todos los dedos forman un círculo', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'P', sign: 'p', description: 'Índice cruzado sobre el medio, como piernas cruzadas', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'Q', sign: 'q', description: 'Índice estirado apoyado vertical en el cuello', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'R', sign: 'r', description: 'Índice y medio cruzados', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'S', sign: 's', description: 'Índice estirado; dibuja una S en el aire', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'T', sign: 't', description: 'Pulgar vertical con el índice cruzado encima', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'U', sign: 'u', description: 'Índice y meñique levantados', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'V', sign: 'v', description: 'Índice y medio separados en V', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'W', sign: 'w', description: 'Índice, medio y anular separados', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'X', sign: 'x', description: 'Índice levantado; dibuja una X en el aire', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'Y', sign: 'y', description: 'Pulgar y meñique extendidos', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'Z', sign: 'z', description: 'Meñique levantado (como la I); dibuja una Z en el aire', category: 'N-Z', difficulty: 'Difícil' },

  // Números (deletreados)
  { letter: 'UNO (1)', sign: 'uno', description: 'Se deletrea U-N-O', category: 'Números', difficulty: 'Fácil' },
  { letter: 'DOS (2)', sign: 'dos', description: 'Se deletrea D-O-S', category: 'Números', difficulty: 'Fácil' },
  { letter: 'TRES (3)', sign: 'tres', description: 'Se deletrea T-R-E-S', category: 'Números', difficulty: 'Fácil' },
  { letter: 'CUATRO (4)', sign: 'cuatro', description: 'Se deletrea C-U-A-T-R-O', category: 'Números', difficulty: 'Medio' },
  { letter: 'CINCO (5)', sign: 'cinco', description: 'Mano abierta, todos los dedos extendidos', category: 'Números', difficulty: 'Fácil' },
  { letter: 'SEIS (6)', sign: 'seis', description: 'Se deletrea S-E-I-S', category: 'Números', difficulty: 'Medio' },
  { letter: 'SIETE (7)', sign: 'siete', description: 'Se deletrea S-I-E-T-E', category: 'Números', difficulty: 'Medio' },
  { letter: 'OCHO (8)', sign: 'ocho', description: 'Se deletrea O-C-H-O', category: 'Números', difficulty: 'Medio' },
  { letter: 'NUEVE (9)', sign: 'nueve', description: 'Se deletrea N-U-E-V-E', category: 'Números', difficulty: 'Medio' },
  { letter: 'DIEZ (10)', sign: 'diez', description: 'Se deletrea D-I-E-Z', category: 'Números', difficulty: 'Medio' },

  // Acciones / verbos
  { letter: 'COMER', sign: 'comer', description: 'Llevar la mano cerrada hacia la boca', category: 'Acciones', difficulty: 'Fácil' },
  { letter: 'BEBER', sign: 'beber', description: 'Simular tomar un vaso con la mano', category: 'Acciones', difficulty: 'Fácil' },
  { letter: 'DORMIR', sign: 'dormir', description: 'Mano apoyada en la mejilla, cabeza inclinada', category: 'Acciones', difficulty: 'Medio' },
  { letter: 'CORRER', sign: 'correr', description: 'Movimiento alternado de manos como brazos al correr', category: 'Acciones', difficulty: 'Medio' },
  { letter: 'CAMINAR', sign: 'caminar', description: 'Dedos índice y medio simulando pasos', category: 'Acciones', difficulty: 'Medio' },
  { letter: 'JUGAR', sign: 'jugar', description: 'Manos con pulgar y meñique extendidos, sacudidas', category: 'Acciones', difficulty: 'Medio' },
  { letter: 'LEER', sign: 'leer', description: 'Dos dedos en V apuntando a la palma como ojos leyendo', category: 'Acciones', difficulty: 'Medio' },
  { letter: 'ESCRIBIR', sign: 'escribir', description: 'Simular escribir con una mano sobre la palma', category: 'Acciones', difficulty: 'Medio' },
  { letter: 'HABLAR', sign: 'hablar', description: 'Dedos abriendo y cerrando frente a la boca', category: 'Acciones', difficulty: 'Medio' },
  { letter: 'TRABAJAR', sign: 'trabajar', description: 'Puños cerrados, uno golpea el otro', category: 'Acciones', difficulty: 'Difícil' },
];

export const DICTIONARY_FILTERS = ['Todos', 'A-M', 'N-Z', 'Números', 'Acciones'];
