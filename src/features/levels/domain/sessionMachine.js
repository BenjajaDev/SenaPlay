import { ANSWER_STATUS } from './evaluateAnswer';

/**
 * Máquina de estados de una sesión de nivel (patrón State Machine).
 *
 *   answering ──SUBMIT(correcta)────▶ feedback(correct) ──CONTINUE──▶ answering (siguiente)
 *       │                                                   └────────▶ completed (si era el último)
 *       ├──SUBMIT(incorrecta)──▶ feedback(incorrect) ──CONTINUE──▶ answering (reintenta)
 *       │                 └── (sin vidas) ──▶ gameOver ──RESTART──▶ answering
 *       └──SUBMIT(incompleta)──▶ answering + aviso (no cuesta vida)
 *
 * Es una función pura (reducer): no conoce React, animaciones ni Supabase.
 * La pantalla despacha eventos y reacciona al estado; los efectos (vibrar,
 * animar el corazón perdido, guardar progreso) se derivan de las transiciones.
 * Esto permitió dividir la pantalla original de 1.350 líneas y testear las
 * reglas del juego sin renderizar nada.
 */

export const SESSION_STATUS = Object.freeze({
  ANSWERING: 'answering',
  FEEDBACK: 'feedback',
  COMPLETED: 'completed',
  GAME_OVER: 'gameOver',
});

export const SESSION_EVENTS = Object.freeze({
  SUBMIT: 'SUBMIT',
  CONTINUE: 'CONTINUE',
  USE_HINT: 'USE_HINT',
  RESTART: 'RESTART',
  DISMISS_NOTICE: 'DISMISS_NOTICE',
});

// Tabla de transiciones permitidas: cualquier evento fuera de esta tabla se
// ignora (ej. doble toque en "Continuar" durante la animación).
export const TRANSITIONS = Object.freeze({
  [SESSION_STATUS.ANSWERING]: [SESSION_EVENTS.SUBMIT, SESSION_EVENTS.USE_HINT, SESSION_EVENTS.DISMISS_NOTICE, SESSION_EVENTS.RESTART],
  [SESSION_STATUS.FEEDBACK]: [SESSION_EVENTS.CONTINUE, SESSION_EVENTS.USE_HINT, SESSION_EVENTS.RESTART],
  [SESSION_STATUS.COMPLETED]: [SESSION_EVENTS.RESTART],
  [SESSION_STATUS.GAME_OVER]: [SESSION_EVENTS.RESTART],
});

export function createInitialSession({ total, maxLives = 3 }) {
  return {
    status: SESSION_STATUS.ANSWERING,
    index: 0,
    total,
    lives: maxLives,
    maxLives,
    hits: 0,
    fails: 0,
    hintsUsed: 0,
    hintedIndexes: [],
    feedback: null,
    notice: null,
    // Índice del corazón recién perdido (para animarlo), -1 si ninguno.
    lostLifeIndex: -1,
    // Contador que cambia en cada error: la UI lo usa como disparador de la
    // animación sin depender de comparar estados completos.
    mistakeTick: 0,
  };
}

export function canHandle(state, eventType) {
  return (TRANSITIONS[state.status] || []).includes(eventType);
}

export function sessionReducer(state, event) {
  if (!event || !canHandle(state, event.type)) return state;

  switch (event.type) {
    case SESSION_EVENTS.SUBMIT: {
      const { result } = event;
      if (!result) return state;

      if (result.status === ANSWER_STATUS.INCOMPLETE) {
        return { ...state, notice: result.message };
      }

      if (result.status === ANSWER_STATUS.CORRECT) {
        return {
          ...state,
          status: SESSION_STATUS.FEEDBACK,
          hits: state.hits + 1,
          notice: null,
          feedback: { kind: 'correct', message: event.message || '¡Excelente! Respuesta correcta.' },
        };
      }

      const lives = Math.max(0, state.lives - 1);
      return {
        ...state,
        status: lives === 0 ? SESSION_STATUS.GAME_OVER : SESSION_STATUS.FEEDBACK,
        lives,
        fails: state.fails + 1,
        notice: null,
        lostLifeIndex: lives,
        mistakeTick: state.mistakeTick + 1,
        feedback: { kind: 'incorrect', message: result.message || 'Respuesta incorrecta.' },
      };
    }

    case SESSION_EVENTS.CONTINUE: {
      if (state.feedback?.kind !== 'correct') {
        // Tras un error se reintenta el mismo ejercicio.
        return { ...state, status: SESSION_STATUS.ANSWERING, feedback: null, lostLifeIndex: -1 };
      }
      const isLast = state.index >= state.total - 1;
      return {
        ...state,
        status: isLast ? SESSION_STATUS.COMPLETED : SESSION_STATUS.ANSWERING,
        index: isLast ? state.index : state.index + 1,
        feedback: null,
        lostLifeIndex: -1,
      };
    }

    case SESSION_EVENTS.USE_HINT: {
      // La penalización por pista se cobra una vez por ejercicio: abrir la
      // misma pista varias veces no debería restar más puntos.
      if (state.hintedIndexes.includes(state.index)) return state;
      return { ...state, hintsUsed: state.hintsUsed + 1, hintedIndexes: [...state.hintedIndexes, state.index] };
    }

    case SESSION_EVENTS.DISMISS_NOTICE:
      return state.notice ? { ...state, notice: null } : state;

    case SESSION_EVENTS.RESTART:
      return createInitialSession({ total: state.total, maxLives: state.maxLives });

    default:
      return state;
  }
}
