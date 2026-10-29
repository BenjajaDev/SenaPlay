import { fakeSupabase, memoryStorage } from '../../../../../jest/fakes';
import { storageKey } from '../../../../core/storage/jsonStorage';
import { createProfileRepository } from '../SupabaseProfileRepository';

const ROLE_KEY = storageKey('role', 'v1', 'u1');

describe('ProfileRepository · rol', () => {
  afterEach(() => jest.useRealTimers());

  test('getRole guarda el rol remoto y getCachedRole lo entrega sin red', async () => {
    const storage = memoryStorage();
    const repo = createProfileRepository(fakeSupabase(() => ({ data: { role: 'admin' }, error: null })), { storage });
    expect(await repo.getCachedRole('u1')).toBeNull();
    expect(await repo.getRole('u1')).toBe('admin');
    expect(await repo.getCachedRole('u1')).toBe('admin');
  });

  test('dos pedidos simultáneos del mismo rol hacen una sola consulta', async () => {
    const supabase = fakeSupabase(() => ({ data: { role: 'editor' }, error: null }));
    const repo = createProfileRepository(supabase, { storage: memoryStorage() });
    const [first, second] = await Promise.all([repo.getRole('u1'), repo.getRole('u1')]);
    expect([first, second]).toEqual(['editor', 'editor']);
    expect(supabase.calls).toHaveLength(1);
  });

  test('sin red usa el último rol guardado y, si no hay, user', async () => {
    const offline = fakeSupabase(() => new Error('Network request failed'));
    const withCache = createProfileRepository(offline, { storage: memoryStorage({ [ROLE_KEY]: 'admin' }) });
    const empty = createProfileRepository(offline, { storage: memoryStorage() });
    expect(await withCache.getRole('u1')).toBe('admin');
    expect(await empty.getRole('u1')).toBe('user');
  });

  test('con red lenta el rol cae al respaldo al vencer el timeout', async () => {
    jest.useFakeTimers();
    const supabase = fakeSupabase(() => 'hang');
    const repo = createProfileRepository(supabase, { storage: memoryStorage() });
    const pending = repo.getRole('u1', { timeoutMs: 4000 });
    await jest.advanceTimersByTimeAsync(4000);
    expect(await pending).toBe('user');
    expect(supabase.calls[0].aborted).toBe(true);
  });

  test('ignora valores de rol desconocidos en la caché', async () => {
    const repo = createProfileRepository(fakeSupabase(() => 'hang'), { storage: memoryStorage({ [ROLE_KEY]: 'root' }) });
    expect(await repo.getCachedRole('u1')).toBeNull();
  });
});
