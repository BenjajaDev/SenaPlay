import { fakeSupabase, memoryStorage } from '../../../../../jest/fakes';
import { storageKey } from '../../../../core/storage/jsonStorage';
import { createMediaRepository } from '../MediaRepository';

const CACHE_KEY = storageKey('media', 'v1');
const OLD = [{ id: 'v1', title: 'Video antiguo' }];

describe('MediaRepository', () => {
  test('una lista vacía del panel reemplaza a la caché: los videos borrados ya no se muestran', async () => {
    const storage = memoryStorage({ [CACHE_KEY]: OLD });
    const repo = createMediaRepository({ supabase: fakeSupabase(() => ({ data: [], error: null })), storage });
    expect(await repo.listVideos()).toEqual({ videos: [], source: 'remote' });
    expect(await repo.getCachedVideos()).toEqual({ videos: [], source: 'cache' });
  });

  test('sin red usa la caché y, si no hay, una lista vacía (sin videos de relleno)', async () => {
    const offline = fakeSupabase(() => new Error('Network request failed'));
    const withCache = createMediaRepository({ supabase: offline, storage: memoryStorage({ [CACHE_KEY]: OLD }) });
    const empty = createMediaRepository({ supabase: offline, storage: memoryStorage() });
    expect(await withCache.listVideos()).toEqual({ videos: OLD, source: 'cache' });
    expect(await empty.listVideos()).toEqual({ videos: [], source: 'local' });
  });

  test('mapea la miniatura del panel', async () => {
    const row = { id: 'v2', title: 'Saludos', public_url: 'https://x/v.mp4', thumbnail_url: 'https://x/t.jpg' };
    const repo = createMediaRepository({ supabase: fakeSupabase(() => ({ data: [row], error: null })), storage: memoryStorage() });
    const { videos } = await repo.listVideos();
    expect(videos[0]).toEqual(expect.objectContaining({ url: 'https://x/v.mp4', thumbnailUrl: 'https://x/t.jpg' }));
  });
});
