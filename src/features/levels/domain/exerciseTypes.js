// Catálogo de tipos de ejercicio: fuente única de verdad para la app, el
// panel web (formularios del gestor de contenido) y la validación.
//
// `fields` describe el payload que cada tipo necesita. Tipos de campo:
//   sign      clave de seña (minúsculas: 'a', 'hola')
//   signs     lista de claves de seña
//   letters   lista de letras/claves
//   options   lista de opciones de texto
//   text      texto libre
//   boolean   verdadero/falso
//   choice    debe ser uno de `options`
//   subset    lista incluida en `options`
// Un campo de lista puede traer `min` y `max` (cantidad de elementos).

export const EXERCISE_TYPES = {
  matching: {
    label: 'Emparejar seña y letra',
    fields: {
      letters: { type: 'letters', required: true, min: 2 },
      // Opcional: texto a mostrar en vez de la clave («CAFÉ» en vez de «cafe-color»).
      // Mismo largo que `letters`; ver isWordMatching.
      labels: { type: 'options', required: false, min: 2 },
    },
  },
  'multiple-choice': {
    label: 'Elegir la letra de una seña',
    fields: {
      sign: { type: 'sign', required: true },
      options: { type: 'options', required: true, min: 2 },
      correct: { type: 'choice', required: true, of: 'options' },
    },
  },
  ordering: {
    label: 'Ordenar alfabéticamente',
    fields: { letters: { type: 'letters', required: true, min: 2 } },
  },
  typing: {
    label: 'Escribir la letra',
    fields: {
      sign: { type: 'sign', required: true },
      answer: { type: 'text', required: true },
    },
  },
  recognition: {
    label: 'Reconocer varias señas',
    fields: {
      signs: { type: 'signs', required: true, min: 1 },
      options: { type: 'options', required: true, min: 2 },
      correct: { type: 'subset', required: true, of: 'options' },
    },
  },
  'build-word': {
    label: 'Construir una palabra',
    fields: {
      word: { type: 'text', required: true },
      letters: { type: 'letters', required: true, min: 1 },
    },
  },
  'interpret-signs': {
    label: 'Interpretar señas y formar la palabra',
    fields: {
      word: { type: 'text', required: true },
      letters: { type: 'letters', required: true, min: 1 },
      signs: { type: 'signs', required: true, min: 1 },
    },
  },
  'word-meaning': {
    label: 'Elegir el significado',
    fields: {
      signs: { type: 'signs', required: true, min: 1 },
      options: { type: 'options', required: true, min: 2 },
      correct: { type: 'choice', required: true, of: 'options' },
      word: { type: 'text', required: false },
    },
  },
  'sign-choice': {
    label: 'Elegir la seña de una palabra',
    fields: {
      // Texto que se pregunta («PERRO»). Las señas candidatas se muestran en video.
      word: { type: 'text', required: true },
      signs: { type: 'signs', required: true, min: 2, max: 4 },
      correct: { type: 'choice', required: true, of: 'signs' },
    },
  },
  'true-false': {
    label: 'Verdadero o falso',
    fields: {
      statement: { type: 'text', required: true },
      answer: { type: 'boolean', required: true },
      // Opcional: muestra una seña sobre la afirmación («Esta SEÑA es la letra M»)
      // o varias deletreadas («Estas SEÑAS forman la palabra Hola»).
      sign: { type: 'sign', required: false },
      signs: { type: 'signs', required: false, min: 1 },
    },
  },
};

/** Máximo de parejas cuando «emparejar» usa palabras y videos en vez de letras. */
export const WORD_MATCHING_MAX_PAIRS = 4;

/**
 * «Emparejar» de palabras (señas en video a la izquierda, texto a la derecha):
 * cuando hay `labels` o alguna clave tiene más de un carácter. 'n~' es la
 * clave de la letra Ñ, no una palabra.
 */
export function isWordMatching(exercise) {
  const letters = exercise?.letters || [];
  return Boolean(exercise?.labels?.length) || letters.some((key) => String(key).length > 1 && key !== 'n~');
}

export const EXERCISE_TYPE_KEYS = Object.keys(EXERCISE_TYPES);
