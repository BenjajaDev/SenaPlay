import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import announce from '../../../../core/a11y/announce';
import haptics from '../../../../core/feedback/haptics';
import { normalizeHint } from '../../../signs/domain/signDescription';
import { ANSWER_STATUS, evaluateAnswer } from '../../domain/evaluateAnswer';
import { computeScore, computeStars } from '../../domain/scoring';
import { createInitialSession, SESSION_EVENTS, SESSION_STATUS, sessionReducer } from '../../domain/sessionMachine';

const NOTICE_MS = 2600;

/**
 * Adaptador React de la máquina de estados de la sesión (domain/sessionMachine).
 *
 * Responsabilidades:
 *  - guardar la respuesta en curso del ejercicio actual
 *  - traducir acciones de UI a eventos (SUBMIT, CONTINUE, USE_HINT, RESTART)
 *  - disparar EFECTOS por transición: háptica, anuncios al lector de pantalla,
 *    callbacks hacia afuera (vida perdida, nivel completado)
 *
 * La pantalla solo pinta `state` y llama a las acciones.
 */
export default function useLevelSession({ level, startingLives, scoringRules, onLifeLost, onMistake, onComplete }) {
  const total = level.exercises.length;
  const [state, dispatch] = useReducer(sessionReducer, { total, maxLives: startingLives }, createInitialSession);
  const [answer, setAnswer] = useState(null);
  const [hint, setHint] = useState(null);
  const [result, setResult] = useState(null);
  // Cuenta los reinicios: junto al índice identifica al ejercicio en pantalla
  // (key) para que se remonte limpio al reintentar el nivel desde el inicio.
  const [attempt, setAttempt] = useState(0);
  const previous = useRef(state);
  const exercise = level.exercises[state.index];

  // Cambió el ejercicio (o se reinició el nivel): respuesta y pista a cero.
  useEffect(() => {
    setAnswer(null);
    setHint(null);
  }, [state.index, attempt]);

  // Efectos por transición de estado.
  useEffect(() => {
    const prev = previous.current;
    previous.current = state;
    if (prev === state) return;

    if (state.mistakeTick > prev.mistakeTick) {
      haptics.error();
      announce(`Incorrecto. ${state.feedback?.message || ''} Te quedan ${state.lives} vidas.`);
      onLifeLost?.();
      // Métrica de errores: qué ejercicio, qué respondió y si lo dejó sin vidas.
      onMistake?.({ exercise, answer, gameOver: state.status === SESSION_STATUS.GAME_OVER });
    } else if (state.hits > prev.hits) {
      haptics.success();
      announce('¡Correcto!');
    }

    if (state.notice && state.notice !== prev.notice) {
      haptics.warning();
      announce(state.notice);
    }

    if (state.status === SESSION_STATUS.COMPLETED && prev.status !== SESSION_STATUS.COMPLETED) {
      const score = computeScore(state, scoringRules);
      const stars = computeStars(score, { totalExercises: total, maxLives: state.maxLives }, scoringRules);
      const summary = {
        levelId: level.id,
        score,
        stars,
        hits: state.hits,
        fails: state.fails,
        lives: state.lives,
        hintsUsed: state.hintsUsed,
        total,
      };
      setResult(summary);
      onComplete?.(summary);
    }

    if (state.status === SESSION_STATUS.GAME_OVER && prev.status !== SESSION_STATUS.GAME_OVER) {
      haptics.warning();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // El aviso de "respuesta incompleta" se oculta solo.
  useEffect(() => {
    if (!state.notice) return undefined;
    const timer = setTimeout(() => dispatch({ type: SESSION_EVENTS.DISMISS_NOTICE }), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [state.notice]);

  const submit = useCallback(
    (value = answer) => {
      if (!exercise) return;
      dispatch({ type: SESSION_EVENTS.SUBMIT, result: evaluateAnswer(exercise, value) });
    },
    [answer, exercise],
  );

  const changeAnswer = useCallback(
    (value, options = {}) => {
      setAnswer(value);
      if (options.autoSubmit) submit(value);
    },
    [submit],
  );

  // Matching reporta errores pareja por pareja.
  const reportMistake = useCallback((mistake) => {
    dispatch({ type: SESSION_EVENTS.SUBMIT, result: { status: ANSWER_STATUS.INCORRECT, message: mistake.message } });
  }, []);

  const showHint = useCallback(
    (signKey) => {
      // Sin signKey = pista general del ejercicio (botón ampolleta).
      const normalized = signKey ? normalizeHint(null, signKey) : normalizeHint(exercise?.hint, exercise?.sign);
      if (!normalized) {
        setHint({ title: 'Pista', texto: 'Observa con calma la forma de la mano y la posición de los dedos.', parametros: [] });
      } else {
        setHint({ ...normalized, title: signKey ? `Pista: ${String(signKey).toLocaleUpperCase('es')}` : 'Pista' });
      }
      dispatch({ type: SESSION_EVENTS.USE_HINT });
      haptics.tap();
    },
    [exercise],
  );

  const actions = useMemo(
    () => ({
      changeAnswer,
      submit: () => submit(),
      reportMistake,
      continue: () => dispatch({ type: SESSION_EVENTS.CONTINUE }),
      restart: (lives) => {
        setResult(null);
        setAttempt((prev) => prev + 1);
        dispatch({ type: SESSION_EVENTS.RESTART, lives });
      },
      showHint,
      toggleHint: () => (hint ? setHint(null) : showHint()),
      closeHint: () => setHint(null),
    }),
    [changeAnswer, submit, reportMistake, showHint, hint],
  );

  const hasProgress = state.index > 0 || state.hits > 0 || state.fails > 0 || Boolean(answer);

  return { state, exercise, answer, hint, result, hasProgress, exerciseKey: `${attempt}-${state.index}`, actions };
}
