// Diccionario de deletreo (letras y acciones). Sirve como respaldo local y como
// fuente para generar el SQL de la tabla public.dictionary en Supabase. Los
// números no van aquí: son señas reales del club (modo «Señas reales»).
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
