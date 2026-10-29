import { fakeSupabase, memoryStorage } from '../../../../../jest/fakes';
import { storageKey } from '../../../../core/storage/jsonStorage';
import { createCatalogRepository } from '../CatalogRepository';

const CACHE_KEY = storageKey('catalog', 'v2');
const LOCAL = [{ id: 1, title: 'Local', category: 'alfabeto', exercises: [{ type: 'matching', letters: ['a', 'b'] }] }];
const row = (id, title) => ({
  id,
  title,
  category: 'vocabulario',
  available: true,
  sort_order: id,
  exercises: [{ position: 0, type: 'typing', title: 'T', hint: null, payload: { sign: 'a', answer: 'A' } }],
});
const cachedRows = [{ ...row(5, 'Guardado'), exercises: [{ type: 'typing', title: 'T', hint: null, sign: 'a', answer: 'A' }] }];

describe('CatalogRepository · caché primero', () => {
  afterEach(() => jest.useRealTimers());

  test('getCachedLevels entrega lo guardado sin consultar la red', async () => {
    const supabase = fakeSupabase(() => ({ data: [row(10, 'Remoto')], error: null }));
    const repo = createCatalogRepository({ supabase, storage: memoryStorage({ [CACHE_KEY]: cachedRows }), localLevels: LOCAL });
    const cached = await repo.getCachedLevels();
    expect(cached.source).toBe('cache');
    expect(cached.levels.map((level) => level.title)).toEqual(['Guardado']);
    expect(supabase.calls).toHaveLength(0);
  });

  test('getCachedLevels devuelve null sin caché o con caché sin niveles válidos', async () => {
    const supabase = fakeSupabase(() => 'hang');
    const empty = createCatalogRepository({ supabase, storage: memoryStorage(), localLevels: LOCAL });
    const broken = createCatalogRepository({
      supabase,
      storage: memoryStorage({ [CACHE_KEY]: [{ id: -1, title: '' }] }),
      localLevels: LOCAL,
    });
    expect(await empty.getCachedLevels()).toBeNull();
    expect(await broken.getCachedLevels()).toBeNull();
  });

  test('con red lenta cae a la caché al vencer el timeout y cancela la consulta', async () => {
    jest.useFakeTimers();
    const supabase = fakeSupabase(() => 'hang');
    const repo = createCatalogRepository({ supabase, storage: memoryStorage({ [CACHE_KEY]: cachedRows }), localLevels: LOCAL });
    const pending = repo.getLevels();
    await jest.advanceTimersByTimeAsync(8000);
    const result = await pending;
    expect(result.source).toBe('cache');
    expect(supabase.calls[0].aborted).toBe(true);
  });

  test('volver a pedir el catálogo dentro del TTL no repite la consulta', async () => {
    const supabase = fakeSupabase(() => ({ data: [row(10, 'Remoto')], error: null }));
    const repo = createCatalogRepository({ supabase, storage: memoryStorage(), localLevels: LOCAL });
    expect((await repo.getLevels()).source).toBe('remote');
    expect((await repo.getLevels()).source).toBe('remote');
    expect(supabase.calls).toHaveLength(1);
  });
});
