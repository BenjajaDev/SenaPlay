import migrateLegacyStorage from '../storage/migrateLegacyStorage';

function memoryBackend(initial) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getAllKeys: async () => [...data.keys()],
    multiGet: async (keys) => keys.map((key) => [key, data.has(key) ? data.get(key) : null]),
    multiSet: async (pairs) => pairs.forEach(([key, value]) => data.set(key, value)),
    multiRemove: async (keys) => keys.forEach((key) => data.delete(key)),
  };
}

describe('migración de claves oratiolingo.* → senaplay.*', () => {
  test('mueve el progreso existente sin pisar datos nuevos', async () => {
    const backend = memoryBackend({
      'oratiolingo.level.progress.v1.u1': '{"unlocked":[1,2]}',
      'oratiolingo.stats.v1.u1': '{"streak":4}',
      'oratiolingo.theme.mode.v1': 'dark',
      'senaplay.stats.v1.u1': '{"streak":9}',
      'sb-proyecto-auth-token': 'sesion',
    });
    const result = await migrateLegacyStorage(backend);

    expect(result.migrated).toBe(2);
    expect(backend.data.get('senaplay.level.progress.v1.u1')).toBe('{"unlocked":[1,2]}');
    expect(backend.data.get('senaplay.theme.mode.v1')).toBe('dark');
    expect(backend.data.get('senaplay.stats.v1.u1')).toBe('{"streak":9}');
    expect([...backend.data.keys()].some((key) => key.startsWith('oratiolingo.'))).toBe(false);
    expect(backend.data.get('sb-proyecto-auth-token')).toBe('sesion');
  });

  test('es idempotente y nunca lanza', async () => {
    const backend = memoryBackend({ 'senaplay.theme.mode.v1': 'light' });
    expect(await migrateLegacyStorage(backend)).toEqual({ migrated: 0 });
    const broken = { getAllKeys: async () => { throw new Error('sin almacenamiento'); } };
    expect(await migrateLegacyStorage(broken)).toEqual({ migrated: 0, failed: true });
  });
});
