import { consumeLives, livesForSession, refillLives, resolveLivesConfig } from '../livesPolicy';
import { currentStreak, previousDay, registerActivity } from '../streak';

describe('racha', () => {
  test('previousDay cruza meses y años', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
  });

  test('días consecutivos suman, un salto reinicia', () => {
    let s = registerActivity(null, '2026-09-20');
    s = registerActivity(s, '2026-09-21');
    expect(s).toMatchObject({ streak: 2, totalDays: 2, bestStreak: 2 });
    expect(registerActivity(s, '2026-09-21')).toEqual(s);
    s = registerActivity(s, '2026-09-24');
    expect(s).toMatchObject({ streak: 1, totalDays: 3, bestStreak: 2 });
  });

  test('racha vigente es 0 si pasó más de un día', () => {
    const s = { streak: 5, lastActiveDate: '2026-09-20' };
    expect(currentStreak(s, '2026-09-21')).toBe(5);
    expect(currentStreak(s, '2026-09-23')).toBe(0);
  });
});

describe('política de vidas', () => {
  const pool = { mode: 'pool', maxLives: 5, refillMinutes: 10 };
  const min = 60 * 1000;

  test('valida y acota la configuración', () => {
    expect(resolveLivesConfig({ mode: 'x', maxLives: 99, refillMinutes: 0 })).toEqual({ mode: 'session', maxLives: 10, refillMinutes: 20 });
  });

  test('modo sesión siempre empieza lleno', () => {
    expect(livesForSession({ lives: 0, updatedAt: 0 }, { mode: 'session', maxLives: 3 }, 0)).toBe(3);
  });

  test('modo pool consume y recarga con el tiempo', () => {
    let state = consumeLives(null, 2, pool, 0);
    expect(state).toMatchObject({ lives: 3, nextRefillAt: 10 * min });
    state = refillLives(state, pool, 25 * min);
    expect(state).toMatchObject({ lives: 5, nextRefillAt: null });
  });

  test('recarga parcial conserva el reloj', () => {
    const state = refillLives({ lives: 1, updatedAt: 0 }, pool, 15 * min);
    expect(state).toMatchObject({ lives: 2, updatedAt: 10 * min, nextRefillAt: 20 * min });
  });
});
