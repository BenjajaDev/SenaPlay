import {
  compareVersions,
  DEFAULT_REMOTE_CONFIG,
  evaluateFlags,
  evaluateRemoteState,
  mergeRemoteConfig,
  nextScheduleChange,
  rolloutBucket,
} from '../remoteConfig';

describe('remote config', () => {
  test('compara versiones semver', () => {
    expect(compareVersions('1.2.10', '1.2.9')).toBe(1);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.9.9', '1.0.0')).toBe(-1);
  });

  test('sin filas remotas devuelve los defaults (comportamiento actual)', () => {
    expect(mergeRemoteConfig([])).toEqual(DEFAULT_REMOTE_CONFIG);
  });

  test('fusiona objetos parciales e ignora claves desconocidas', () => {
    const config = mergeRemoteConfig([
      { key: 'lives', value: { mode: 'pool' } },
      { key: 'hackeo', value: true },
    ]);
    expect(config.lives).toEqual({ mode: 'pool', maxLives: 3, refillMinutes: 20 });
    expect(config).not.toHaveProperty('hackeo');
  });

  test('mantenimiento y versión mínima bloquean; admins saltan mantenimiento', () => {
    const config = mergeRemoteConfig([
      { key: 'maintenance', value: { enabled: true } },
      { key: 'appVersion', value: { minimum: '2.0.0' } },
    ]);
    expect(evaluateRemoteState(config, { appVersion: '1.0.0' }).gate).toBe('maintenance');
    expect(evaluateRemoteState(config, { appVersion: '1.0.0', isAdmin: true }).gate).toBe('updateRequired');
    expect(evaluateRemoteState(mergeRemoteConfig([]), { appVersion: '1.0.0' }).gate).toBeNull();
    // El administrador entra, pero se le avisa que el mantenimiento está activo.
    expect(evaluateRemoteState(config, { appVersion: '1.0.0', isAdmin: true }).maintenanceBypassed).toBe(true);
    expect(evaluateRemoteState(config, { appVersion: '1.0.0' }).maintenanceBypassed).toBe(false);
  });

  test('avisos solo dentro de su ventana de fechas', () => {
    const config = mergeRemoteConfig([
      {
        key: 'announcements',
        value: [
          { id: 'a', title: 'Vigente', startsAt: '2026-01-01', endsAt: '2026-12-31' },
          { id: 'b', title: 'Vencido', endsAt: '2025-01-01' },
        ],
      },
    ]);
    const state = evaluateRemoteState(config, { appVersion: '1.0.0', now: new Date('2026-06-01').getTime() });
    expect(state.announcements.map((a) => a.id)).toEqual(['a']);
  });

  test('flags: defaults, ventana temporal y rollout estable', () => {
    const now = new Date('2026-10-31').getTime();
    const flags = evaluateFlags(
      [
        { key: 'games.quiz', enabled: false },
        { key: 'events.halloween', enabled: true, starts_at: '2026-10-25', ends_at: '2026-11-01' },
        { key: 'events.navidad', enabled: true, starts_at: '2026-12-20' },
        { key: 'beta.zero', enabled: true, rollout_percentage: 0 },
      ],
      { userId: 'u1', now },
    );
    expect(flags['games.memory']).toBe(true);
    expect(flags['games.quiz']).toBe(false);
    expect(flags['events.halloween']).toBe(true);
    expect(flags['events.navidad']).toBe(false);
    expect(flags['beta.zero']).toBe(false);
    expect(rolloutBucket('x', 'u1')).toBe(rolloutBucket('x', 'u1'));
  });

  test('agenda el próximo inicio o fin de avisos y flags (para mostrarlos a la hora exacta)', () => {
    const now = new Date('2026-09-29T12:00:00Z').getTime();
    const config = mergeRemoteConfig([
      { key: 'announcements', value: [{ id: 'a', startsAt: '2026-09-29T15:00:00Z', endsAt: '2026-09-30T00:00:00Z' }, { id: 'b', endsAt: '2026-09-01T00:00:00Z' }] },
    ]);
    const flags = [{ key: 'events.x', starts_at: '2026-09-29T13:30:00Z', ends_at: null }];
    expect(nextScheduleChange(config, flags, now)).toBe(new Date('2026-09-29T13:30:00Z').getTime());
    expect(nextScheduleChange(config, [], now)).toBe(new Date('2026-09-29T15:00:00Z').getTime());
    expect(nextScheduleChange(mergeRemoteConfig([]), [], now)).toBeNull();
    // Al llegar la hora, el aviso pasa a estar vigente.
    const at = new Date('2026-09-29T15:00:01Z').getTime();
    expect(evaluateRemoteState(config, { appVersion: '1.0.0', now: at }).announcements.map((item) => item.id)).toEqual(['a']);
  });
});
