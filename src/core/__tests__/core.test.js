import { createCatalogRepository } from '../../features/levels/data/CatalogRepository';
import { createEventBus } from '../events/EventBus';
import { toUserMessage } from '../result';

function memoryStorage() {
  const data = new Map();
  return {
    get: async (key, fallback) => (data.has(key) ? data.get(key) : fallback),
    set: async (key, value) => {
      data.set(key, value);
      return true;
    },
    remove: async (key) => data.delete(key),
  };
}

function fakeSupabase(response) {
  const query = {
    select: () => query,
    order: () => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)),
  };
  return { from: () => query };
}

const LOCAL = [{ id: 1, title: 'Local', category: 'alfabeto', exercises: [{ type: 'matching', letters: ['a', 'b'] }] }];

describe('EventBus (Observer)', () => {
  test('notifica, desuscribe y aísla errores de listeners', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const bus = createEventBus();
    const received = [];
    const off = bus.on('x', (p) => received.push(p));
    bus.on('x', () => {
      throw new Error('boom');
    });
    bus.emit('x', 1);
    off();
    bus.emit('x', 2);
    expect(received).toEqual([1]);
    expect(warn).toHaveBeenCalledTimes(2); // el listener que lanza sigue suscrito
    warn.mockRestore();
  });

  test('once se ejecuta una sola vez', () => {
    const bus = createEventBus();
    const fn = jest.fn();
    bus.once('y', fn);
    bus.emit('y');
    bus.emit('y');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('CatalogRepository (Repository)', () => {
  const remoteRow = {
    id: 10,
    title: 'Remoto',
    category: 'vocabulario',
    available: true,
    sort_order: 0,
    exercises: [
      { position: 1, type: 'typing', title: 'T', hint: null, payload: { sign: 'a', answer: 'A' } },
      { position: 0, type: 'no-existe', title: 'Roto', hint: null, payload: {} },
    ],
  };

  test('usa remoto, omite ejercicios inválidos y guarda caché', async () => {
    const storage = memoryStorage();
    const repo = createCatalogRepository({ supabase: fakeSupabase({ data: [remoteRow], error: null }), storage, localLevels: LOCAL });
    const result = await repo.getLevels();
    expect(result.source).toBe('remote');
    expect(result.levels[0].exercises).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);

    const offline = createCatalogRepository({ supabase: fakeSupabase(new Error('offline')), storage, localLevels: LOCAL });
    const cached = await offline.getLevels();
    expect(cached.source).toBe('cache');
    expect(cached.levels[0].title).toBe('Remoto');
  });

  test('sin red ni caché usa el catálogo local', async () => {
    const repo = createCatalogRepository({ supabase: fakeSupabase(new Error('offline')), storage: memoryStorage(), localLevels: LOCAL });
    const result = await repo.getLevels();
    expect(result.source).toBe('local');
    expect(result.levels[0].title).toBe('Local');
  });
});

describe('mensajes de error', () => {
  test('traduce errores comunes de Supabase', () => {
    expect(toUserMessage({ message: 'Invalid login credentials' })).toBe('Correo o contraseña incorrectos.');
    expect(toUserMessage('Password should be at least 6 characters')).toMatch(/6 caracteres/);
    expect(toUserMessage(null, 'x')).toBe('x');
  });
});
