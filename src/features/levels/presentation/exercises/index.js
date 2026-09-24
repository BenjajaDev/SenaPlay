import ChoiceExercise from './ChoiceExercise';
import MatchingExercise from './MatchingExercise';
import OrderingExercise from './OrderingExercise';
import RecognitionExercise from './RecognitionExercise';
import TrueFalseExercise from './TrueFalseExercise';
import TypingExercise from './TypingExercise';
import WordBuilderExercise from './WordBuilderExercise';

/**
 * Registro tipo de ejercicio → componente (patrón Strategy). Agregar un tipo
 * nuevo = definirlo en domain/exerciseTypes.js, evaluarlo en evaluateAnswer.js
 * y registrar su componente aquí; LevelSessionScreen no cambia.
 *
 * `autoSubmit`: el ejercicio se envía solo al completarse (sin botón Verificar).
 */
export const EXERCISE_COMPONENTS = {
  matching: { Component: MatchingExercise, autoSubmit: true },
  'multiple-choice': { Component: ChoiceExercise },
  'word-meaning': { Component: ChoiceExercise },
  ordering: { Component: OrderingExercise },
  typing: { Component: TypingExercise },
  recognition: { Component: RecognitionExercise },
  'build-word': { Component: WordBuilderExercise },
  'interpret-signs': { Component: WordBuilderExercise },
  'true-false': { Component: TrueFalseExercise },
};
