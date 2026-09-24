// Evaluación PURA de respuestas: recibe el ejercicio y la respuesta del
// usuario y devuelve uno de tres resultados:
//
//   { status: 'incomplete', message }  falta completar → NO cuesta vida
//   { status: 'correct' }
//   { status: 'incorrect', message }
//
// Separar "incompleto" de "incorrecto" es una decisión de UX: antes, tocar
// Verificar sin elegir una opción quitaba una vida, lo que se sentía injusto.

export const ANSWER_STATUS = { INCOMPLETE: 'incomplete', CORRECT: 'correct', INCORRECT: 'incorrect' };

const normalize = (value) => String(value ?? '').trim().toLocaleUpperCase('es');
const sameList = (a, b) => a.length === b.length && a.every((item, index) => item === b[index]);
const sameSet = (a, b) => sameList([...a].map(normalize).sort(), [...b].map(normalize).sort());

const incomplete = (message) => ({ status: ANSWER_STATUS.INCOMPLETE, message });
const verdict = (isCorrect, message) =>
  isCorrect ? { status: ANSWER_STATUS.CORRECT } : { status: ANSWER_STATUS.INCORRECT, message };

export function evaluateAnswer(exercise, answer) {
  switch (exercise?.type) {
    case 'multiple-choice':
      if (!answer) return incomplete('Elige una opción para responder.');
      return verdict(normalize(answer) === normalize(exercise.correct), 'Esa no es la letra de la seña.');

    case 'word-meaning':
      if (!answer) return incomplete('Elige un significado.');
      return verdict(answer === exercise.correct, 'Ese no es el significado correcto.');

    case 'true-false': {
      if (answer === undefined || answer === null || answer === '') return incomplete('Responde Verdadero o Falso.');
      const value = answer === true || answer === 'true';
      return verdict(value === exercise.answer, 'Revisa la afirmación con calma.');
    }

    case 'typing':
      if (!String(answer ?? '').trim()) return incomplete('Escribe una letra para responder.');
      return verdict(normalize(answer) === normalize(exercise.answer), 'La letra no coincide con la seña.');

    case 'ordering': {
      const slots = answer || [];
      if (slots.length < exercise.letters.length || slots.some((item) => !item)) {
        return incomplete('Completa el orden antes de verificar.');
      }
      return verdict(sameList(slots.map(normalize), exercise.letters.map(normalize)), 'El orden alfabético no es correcto.');
    }

    case 'recognition': {
      const selected = answer || [];
      if (!selected.length) return incomplete('Selecciona al menos una letra.');
      return verdict(sameSet(selected, exercise.correct), 'La selección no coincide con las señas.');
    }

    case 'build-word':
    case 'interpret-signs': {
      const slots = answer || [];
      if (slots.length < exercise.word.length || slots.some((item) => !item)) {
        return incomplete('Completa la palabra antes de verificar.');
      }
      return verdict(normalize(slots.join('')) === normalize(exercise.word), 'La palabra formada no es correcta.');
    }

    case 'matching': {
      // En matching la UI evalúa pareja por pareja (ver evaluateMatchingPair);
      // aquí `answer` es la lista de ids emparejados.
      const matched = answer || [];
      const needed = exercise.letters.length * 2;
      if (matched.length < needed) return incomplete('Empareja todas las señas con su letra.');
      return verdict(true);
    }

    default:
      return verdict(false, 'Ejercicio no soportado.');
  }
}

/** Matching: ¿estas dos cartas forman pareja válida? */
export function evaluateMatchingPair(first, second) {
  if (!first || !second || first.id === second.id || first.type === second.type) return null;
  return first.pair === second.pair
    ? { status: ANSWER_STATUS.CORRECT }
    : { status: ANSWER_STATUS.INCORRECT, message: 'Esa no es su pareja. Mira la forma de la mano.' };
}
