import { memoryStorage } from '../../../jest/fakes';
import { createCachedResource } from '../data/cachedResource';

function setup({ remote, cached, ttlMs = 1000 } = {}) {
  let clock = 0;
  const storage = memoryStorage(cached === undefined ? {} : { key: cached });
  const fetchRemote = jest.fn(remote);
  const resource = createCachedResource({
    storage,
    cacheKey: 'key',
    fetchRemote,
    local: ['local'],
    ttlMs,
    now: () => clock,
  });
  return { resource, storage, fetchRemote, advance: (ms) => (clock += ms) };
}

describe('createCachedResource (remoto → caché → local)', () => {
  test('usa el remoto válido y lo guarda en caché', async () => {
    const { resource, storage } = setup({ remote: async () => ['remoto'] });
    expect(await resource.read()).toEqual({ value: ['remoto'], source: 'remote' });
    expect(storage.data.get('key')).toEqual(['remoto']);
    expect(await resource.readCached()).toEqual(['remoto']);
  });

  test('sin red usa la caché y, si no hay, lo local', async () => {
    const offline = async () => {
      throw new Error('offline');
    };
    expect(await setup({ remote: offline, cached: ['guardado'] }).resource.read()).toEqual({ value: ['guardado'], source: 'cache' });
    expect(await setup({ remote: offline }).resource.read()).toEqual({ value: ['local'], source: 'local' });
  });

  test('un remoto vacío o una caché corrupta no reemplazan a lo local', async () => {
    const { resource } = setup({ remote: async () => [], cached: { roto: true } });
    expect(await resource.read()).toEqual({ value: ['local'], source: 'local' });
    expect(await resource.readCached()).toBeNull();
  });

  test('dentro del TTL no repite la consulta; después revalida', async () => {
    const { resource, fetchRemote, advance } = setup({ remote: async () => ['remoto'], ttlMs: 1000 });
    await resource.read();
    await resource.read();
    expect(fetchRemote).toHaveBeenCalledTimes(1);
    advance(1001);
    await resource.read();
    expect(fetchRemote).toHaveBeenCalledTimes(2);
  });

  test('lecturas simultáneas comparten la misma consulta', async () => {
    const { resource, fetchRemote } = setup({ remote: async () => ['remoto'] });
    await Promise.all([resource.read(), resource.read(), resource.read()]);
    expect(fetchRemote).toHaveBeenCalledTimes(1);
  });

  test('tras un fallo de red no memoriza: la próxima lectura reintenta', async () => {
    const { resource, fetchRemote } = setup({
      remote: jest
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce(['remoto']),
    });
    expect((await resource.read()).source).toBe('local');
    expect((await resource.read()).source).toBe('remote');
    expect(fetchRemote).toHaveBeenCalledTimes(2);
  });
});
