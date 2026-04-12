export const LEVELS_CATALOG = [
  {
    id: 1,
    title: 'Letras A-E',
    description: 'Nivel inicial para dominar las primeras letras.',
    available: true,
    exercises: [
      { type: 'matching', title: 'Empareja las SEÑAS con sus letras', letters: ['a', 'b', 'c', 'd', 'e'] },
      {
        type: 'multiple-choice',
        title: 'Que letra representa esta SEÑA?',
        sign: 'b',
        options: ['A', 'B', 'D'],
        correct: 'B',
        hint: 'La mano forma una B con los dedos juntos hacia arriba.',
      },
      {
        type: 'ordering',
        title: 'Ordena las letras en secuencia alfabetica',
        letters: ['A', 'B', 'C', 'D', 'E'],
      },
      {
        type: 'multiple-choice',
        title: 'Que letra representa esta SEÑA?',
        sign: 'd',
        options: ['C', 'D', 'E'],
        correct: 'D',
        hint: 'El indice apunta hacia arriba y los otros dedos quedan cerrados.',
      },
      {
        type: 'typing',
        title: 'Escribe la letra correcta para esta SEÑA',
        sign: 'e',
        answer: 'E',
        hint: 'Los dedos se doblan hacia la palma, como una garra.',
      },
    ],
  },
  {
    id: 2,
    title: 'Letras F-J',
    description: 'Refuerza reconocimiento visual y velocidad de respuesta.',
    available: true,
    exercises: [
      { type: 'matching', title: 'Empareja las SEÑAS con sus letras', letters: ['f', 'g', 'h', 'i', 'j'] },
      { type: 'multiple-choice', title: 'Que letra representa esta SEÑA?', sign: 'g', options: ['F', 'G', 'H'], correct: 'G', hint: 'El indice apunta hacia un lado formando una G.' },
      { type: 'ordering', title: 'Ordena las letras en secuencia alfabetica', letters: ['F', 'G', 'H', 'I', 'J'] },
      { type: 'multiple-choice', title: 'Que letra representa esta SEÑA?', sign: 'i', options: ['H', 'I', 'J'], correct: 'I', hint: 'El menique se levanta solo.' },
      { type: 'typing', title: 'Escribe la letra correcta para esta SEÑA', sign: 'h', answer: 'H', hint: 'Dos dedos juntos apuntan hacia un lado.' },
    ],
  },
  {
    id: 3,
    title: 'Letras K-N',
    description: 'Introduce combinaciones con mayor precision manual.',
    available: true,
    exercises: [
      { type: 'matching', title: 'Empareja las SEÑAS con sus letras', letters: ['k', 'l', 'm', 'n', 'n~'] },
      { type: 'multiple-choice', title: 'Que letra representa esta SEÑA?', sign: 'k', options: ['L', 'K', 'N'], correct: 'K', hint: 'Indice y medio forman una V lateral.' },
      { type: 'ordering', title: 'Ordena las letras en secuencia alfabetica', letters: ['K', 'L', 'M', 'N', 'N~'] },
      { type: 'multiple-choice', title: 'Que letra representa esta SEÑA?', sign: 'n', options: ['N~', 'M', 'N'], correct: 'N', hint: 'Indice y medio se doblan sobre el pulgar.' },
      { type: 'typing', title: 'Escribe la letra correcta para esta SEÑA', sign: 'n~', answer: 'N~', hint: 'Es similar a N, con movimiento adicional.' },
    ],
  },
  {
    id: 4,
    title: 'Letras O-S',
    description: 'Consolidacion de lectura rapida de SEÑAS intermedias.',
    available: true,
    exercises: [
      { type: 'matching', title: 'Empareja las SEÑAS con sus letras', letters: ['o', 'p', 'q', 'r', 's'] },
      { type: 'multiple-choice', title: 'Que letra representa esta SEÑA?', sign: 'p', options: ['Q', 'P', 'R'], correct: 'P', hint: 'Indice y medio apuntan hacia abajo.' },
      { type: 'ordering', title: 'Ordena las letras en secuencia alfabetica', letters: ['O', 'P', 'Q', 'R', 'S'] },
      { type: 'multiple-choice', title: 'Que letra representa esta SEÑA?', sign: 's', options: ['R', 'S', 'Q'], correct: 'S', hint: 'Puno cerrado con pulgar sobre los dedos.' },
      { type: 'typing', title: 'Escribe la letra correcta para esta SEÑA', sign: 'q', answer: 'Q', hint: 'Indice y pulgar apuntan hacia abajo.' },
    ],
  },
  {
    id: 5,
    title: 'Letras T-Z',
    description: 'Nivel avanzado con ejercicios combinados.',
    available: true,
    exercises: [
      { type: 'matching', title: 'Empareja las SEÑAS con sus letras', letters: ['t', 'u', 'v', 'w', 'x', 'y', 'z'] },
      { type: 'multiple-choice', title: 'Que letra representa esta SEÑA?', sign: 'w', options: ['V', 'W', 'X'], correct: 'W', hint: 'Tres dedos extendidos hacia arriba.' },
      {
        type: 'recognition',
        title: 'Selecciona las letras correctas para estas SEÑAS',
        signs: ['t', 'u', 'v'],
        options: ['T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
        correct: ['T', 'U', 'V'],
      },
      { type: 'ordering', title: 'Ordena las letras en secuencia alfabetica', letters: ['T', 'U', 'V', 'W', 'X', 'Y', 'Z'] },
      { type: 'typing', title: 'Escribe la letra correcta para esta SEÑA', sign: 'z', answer: 'Z', hint: 'El indice traza una Z en el aire.' },
      { type: 'build-word', title: 'Construye la palabra', word: 'COMER', letters: ['C', 'O', 'M', 'E', 'R', 'A', 'N', 'S', 'U'] },
      { type: 'interpret-signs', title: 'Interpreta las SEÑAS y forma la palabra', signs: ['m', 'u', 'n', 'd', 'o'], word: 'MUNDO', letters: ['M', 'U', 'N', 'D', 'O', 'R', 'S', 'T', 'L'] },
    ],
  },
  {
    id: 6,
    title: 'Numeros 0-9',
    description: 'Disponible en la siguiente iteracion.',
    available: false,
    exercises: [],
  },
];

export function getLevelById(levelId) {
  return LEVELS_CATALOG.find((item) => item.id === levelId) || null;
}
