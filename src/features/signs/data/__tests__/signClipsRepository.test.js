import { fakeSupabase, memoryStorage } from '../../../../../jest/fakes';
import { storageKey } from '../../../../core/storage/jsonStorage';
import { createSignClipsRepository } from '../SignClipsRepository';

const CACHE_KEY = storageKey('signClips', 'v1');

const row = (overrides = {}) => ({
  id: 'c1',
  sign_key: 'dolor',
  gloss: 'DOLOR',
  variant: 1,
  region: 'general',
  video_path: 'dolor/1-a.mp4',
  poster_path: 'dolor/1-a.webp',
  duration_ms: 2800,
  ...overrides,
});

const CACHED = [
  {
    id: 'old',
    signKey: 'fiebre',
    gloss: 'FIEBRE',
    variant: 1,
    region: 'general',
    videoUrl: 'https://storage.test/sign-clips/fiebre/1-a.mp4',
    posterUrl: 'https://storage.test/sign-clips/fiebre/1-a.webp',
    durationMs: 3000,
  },
];

describe('SignClipsRepository', () => {
  test('consulta la vista sign_clips_public (sin datos personales) y arma las URL públicas desde las rutas del bucket', async () => {
    const supabase = fakeSupabase(() => ({ data: [row()], error: null }));
    const repo = createSignClipsRepository({ supabase, storage: memoryStorage() });
    const { clips, source } = await repo.listClips();
    expect(source).toBe('remote');
    expect(supabase.calls[0].table).toBe('sign_clips_public');
    expect(clips).toEqual([
      {
        id: 'c1',
        signKey: 'dolor',
        gloss: 'DOLOR',
        variant: 1,
        region: 'general',
        videoUrl: 'https://storage.test/sign-clips/dolor/1-a.mp4',
        posterUrl: 'https://storage.test/sign-clips/dolor/1-a.webp',
        durationMs: 2800,
      },
    ]);
  });

  test('descarta filas que no se pueden reproducir', async () => {
    const supabase = fakeSupabase(() => ({ data: [row(), row({ id: 'x', duration_ms: 0 })], error: null }));
    const { clips } = await createSignClipsRepository({ supabase, storage: memoryStorage() }).listClips();
    expect(clips.map((c) => c.id)).toEqual(['c1']);
  });

  test('una lista vacía reemplaza a la caché: los clips despublicados dejan de verse', async () => {
    const storage = memoryStorage({ [CACHE_KEY]: CACHED });
    const repo = createSignClipsRepository({ supabase: fakeSupabase(() => ({ data: [], error: null })), storage });
    expect(await repo.listClips()).toEqual({ clips: [], source: 'remote' });
    expect(await repo.getCachedClips()).toEqual({ clips: [], source: 'cache' });
  });

  test('sin red usa la caché y, si no hay, una lista vacía', async () => {
    const offline = fakeSupabase(() => new Error('Network request failed'));
    const withCache = createSignClipsRepository({ supabase: offline, storage: memoryStorage({ [CACHE_KEY]: CACHED }) });
    const empty = createSignClipsRepository({ supabase: offline, storage: memoryStorage() });
    expect(await withCache.listClips()).toEqual({ clips: CACHED, source: 'cache' });
    expect(await empty.listClips()).toEqual({ clips: [], source: 'local' });
    expect(await empty.getCachedClips()).toBeNull();
  });

  test('un error de Supabase no llega a la UI', async () => {
    const failing = fakeSupabase(() => ({ data: null, error: { message: 'permission denied' } }));
    const repo = createSignClipsRepository({ supabase: failing, storage: memoryStorage() });
    await expect(repo.listClips()).resolves.toEqual({ clips: [], source: 'local' });
  });
});
