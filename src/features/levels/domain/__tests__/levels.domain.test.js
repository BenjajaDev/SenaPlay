import { LEVELS_CATALOG } from '../../data/local/levelsCatalog';
import { evaluateAnswer, evaluateMatchingPair } from '../evaluateAnswer';
import ExerciseFactory, { InvalidExerciseError } from '../ExerciseFactory';
import { completeLevel, normalizeLevelProgress } from '../levelProgress';
import LevelBuilder from '../LevelBuilder';
import { computeScore, computeStars } from '../scoring';
import { createInitialSession, SESSION_EVENTS, SESSION_STATUS, sessionReducer } from '../sessionMachine';

describe('ExerciseFactory', () => {
  test('todos los ejercicios del catálogo local son válidos', () => {
    const errors = [];
    LEVELS_CATALOG.forEach((level) => {
      const result = ExerciseFactory.createMany(level.exercises);
      result.errors.forEach((e) => errors.push(`nivel ${level.id} #${e.index}: ${e.message}`));
    });
    expect(errors).toEqual([]);
  });

  test('rechaza tipos desconocidos y campos faltantes con mensaje legible', () => {
    expect(() => ExerciseFactory.create({ type: 'dance' })).toThrow(InvalidExerciseError);
    expect(() => ExerciseFactory.create({ type: 'multiple-choice', sign: 'a', options: ['A', 'B'], correct: 'Z' })).toThrow(
      /debe ser una de las opciones/,
    );
    expect(() => ExerciseFactory.create({ type: 'true-false', statement: 'x', answer: 'yes' })).toThrow(/verdadero\/falso/);
  });

  test('descarta campos ajenos al tipo y congela el resultado', () => {
    const exercise = ExerciseFactory.create({ type: 'typing', sign: 'a', answer: 'A', extra: 1, hint: '  pista ' });
    expect(exercise).toEqual({ type: 'typing', title: 'Escribir la letra', sign: 'a', answer: 'A', hint: 'pista' });
    expect(Object.isFrozen(exercise)).toBe(true);
  });

  test('toRow / fromRow son inversos', () => {
    const exercise = ExerciseFactory.create({ type: 'ordering', title: 'Ordena', letters: ['A', 'B'] });
    const row = ExerciseFactory.toRow(exercise, 3);
    expect(row).toEqual({ position: 3, type: 'ordering', title: 'Ordena', hint: null, payload: { letters: ['A', 'B'] } });
    expect(ExerciseFactory.fromRow(row)).toEqual(exercise);
  });
});

describe('LevelBuilder', () => {
  test('construye un nivel válido paso a paso', () => {
    const level = new LevelBuilder(99)
      .title('Prueba')
      .category('alfabeto')
      .addExercise({ type: 'matching', letters: ['a', 'b'] })
      .build();
    expect(level.id).toBe(99);
    expect(level.exercises).toHaveLength(1);
    expect(level.available).toBe(true);
  });

  test('modo estricto falla con ejercicios inválidos; tolerante los omite', () => {
    const builder = () => new LevelBuilder(5).title('X').addExercise({ type: 'matching', letters: ['a', 'b'] }).addExercise({ type: '??' });
    expect(() => builder().build()).toThrow();
    const level = builder().lenient().build();
    expect(level.exercises).toHaveLength(1);
    expect(level.warnings).toHaveLength(1);
  });

  test('un nivel sin ejercicios válidos queda no disponible', () => {
    expect(new LevelBuilder(7).title('Vacío').lenient().build().available).toBe(false);
  });

  test('exige id y título', () => {
    expect(() => new LevelBuilder(0).title('x').build()).toThrow(/id/);
    expect(() => new LevelBuilder(1).build()).toThrow(/título/);
  });
});

describe('evaluateAnswer', () => {
  const mc = { type: 'multiple-choice', sign: 'b', options: ['A', 'B'], correct: 'B' };

  test('sin respuesta es "incompleta" (no cuesta vida)', () => {
    expect(evaluateAnswer(mc, '').status).toBe('incomplete');
    expect(evaluateAnswer({ type: 'ordering', letters: ['A', 'B'] }, ['A', null]).status).toBe('incomplete');
    expect(evaluateAnswer({ type: 'build-word', word: 'SOL', letters: [] }, ['S', 'O']).status).toBe('incomplete');
  });

  test('evalúa cada tipo', () => {
    expect(evaluateAnswer(mc, 'b').status).toBe('correct');
    expect(evaluateAnswer(mc, 'A').status).toBe('incorrect');
    expect(evaluateAnswer({ type: 'typing', answer: 'ñ' }, ' Ñ ').status).toBe('correct');
    expect(evaluateAnswer({ type: 'true-false', answer: false }, 'false').status).toBe('correct');
    expect(evaluateAnswer({ type: 'true-false', answer: false }, true).status).toBe('incorrect');
    expect(evaluateAnswer({ type: 'recognition', correct: ['T', 'U'] }, ['u', 't']).status).toBe('correct');
    expect(evaluateAnswer({ type: 'ordering', letters: ['A', 'B'] }, ['B', 'A']).status).toBe('incorrect');
    expect(evaluateAnswer({ type: 'interpret-signs', word: 'SOL' }, ['S', 'O', 'L']).status).toBe('correct');
    expect(evaluateAnswer({ type: 'word-meaning', correct: 'Comer' }, 'Beber').status).toBe('incorrect');
  });

  test('matching evalúa parejas', () => {
    const letter = { id: 'l-0', type: 'letter', pair: 'a' };
    const sign = { id: 's-0', type: 'sign', pair: 'a' };
    const other = { id: 's-1', type: 'sign', pair: 'b' };
    expect(evaluateMatchingPair(letter, sign).status).toBe('correct');
    expect(evaluateMatchingPair(letter, other).status).toBe('incorrect');
    expect(evaluateMatchingPair(sign, other)).toBeNull();
  });
});

describe('sessionMachine', () => {
  const correct = { type: SESSION_EVENTS.SUBMIT, result: { status: 'correct' } };
  const wrong = { type: SESSION_EVENTS.SUBMIT, result: { status: 'incorrect', message: 'no' } };
  const incomplete = { type: SESSION_EVENTS.SUBMIT, result: { status: 'incomplete', message: 'falta' } };
  const next = { type: SESSION_EVENTS.CONTINUE };

  test('flujo feliz hasta completar', () => {
    let s = createInitialSession({ total: 2, maxLives: 3 });
    s = sessionReducer(s, correct);
    expect(s.status).toBe(SESSION_STATUS.FEEDBACK);
    s = sessionReducer(s, next);
    expect(s).toMatchObject({ status: SESSION_STATUS.ANSWERING, index: 1, hits: 1 });
    s = sessionReducer(sessionReducer(s, correct), next);
    expect(s.status).toBe(SESSION_STATUS.COMPLETED);
  });

  test('respuesta incompleta avisa sin quitar vida', () => {
    const s = sessionReducer(createInitialSession({ total: 1 }), incomplete);
    expect(s).toMatchObject({ status: SESSION_STATUS.ANSWERING, lives: 3, notice: 'falta' });
  });

  test('error resta vida, permite reintentar y termina en gameOver', () => {
    let s = createInitialSession({ total: 3, maxLives: 2 });
    s = sessionReducer(s, wrong);
    expect(s).toMatchObject({ status: SESSION_STATUS.FEEDBACK, lives: 1, fails: 1, lostLifeIndex: 1, mistakeTick: 1 });
    s = sessionReducer(s, next);
    expect(s).toMatchObject({ status: SESSION_STATUS.ANSWERING, index: 0 });
    s = sessionReducer(s, wrong);
    expect(s.status).toBe(SESSION_STATUS.GAME_OVER);
    expect(sessionReducer(s, correct)).toBe(s); // evento no permitido: se ignora
    expect(sessionReducer(s, { type: SESSION_EVENTS.RESTART })).toMatchObject({ status: 'answering', lives: 2, fails: 0 });
  });

  test('la pista se cobra una vez por ejercicio', () => {
    let s = createInitialSession({ total: 2 });
    s = sessionReducer(s, { type: SESSION_EVENTS.USE_HINT });
    s = sessionReducer(s, { type: SESSION_EVENTS.USE_HINT });
    expect(s.hintsUsed).toBe(1);
  });
});

describe('scoring y progreso', () => {
  test('replica la fórmula original', () => {
    expect(computeScore({ hits: 6, fails: 1, lives: 2, hintsUsed: 2 })).toBe(600 - 30 + 40 - 10);
    expect(computeScore({ hits: 0, fails: 10, lives: 0 })).toBe(0);
  });

  test('estrellas según umbrales', () => {
    expect(computeStars(760, { totalExercises: 7, maxLives: 3 })).toBe(3);
    expect(computeStars(100, { totalExercises: 7, maxLives: 3 })).toBe(0);
  });

  test('completar nivel desbloquea el siguiente y conserva el mejor puntaje', () => {
    let p = normalizeLevelProgress(null);
    p = completeLevel(p, { levelId: 1, score: 500, hits: 5, fails: 0, stars: 2 }, { id: 2, available: true });
    expect(p.unlocked).toEqual([1, 2]);
    p = completeLevel(p, { levelId: 1, score: 200, hits: 2, fails: 3, stars: 1 }, { id: 2, available: true });
    expect(p.completed[1]).toMatchObject({ score: 500, stars: 2 });
    p = completeLevel(p, { levelId: 2, score: 10, hits: 1, fails: 0 }, { id: 3, available: false });
    expect(p.unlocked).toEqual([1, 2]);
  });
});
