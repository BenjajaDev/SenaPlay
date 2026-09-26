import { describe, expect, test, vi } from 'vitest';
import {
  createContentRepository,
  createMediaRepository,
  DEFAULT_SECTIONS,
  kindFromMime,
  mergeSections,
  normalizeUrl,
  RepositoryError,
  safeFileName,
} from '@/data/repositories';

function fakeClient({ rpc, insertError }: { rpc?: ReturnType<typeof vi.fn>; insertError?: string } = {}) {
  const remove = vi.fn(async () => ({ error: null }));
  const storageApi = {
    upload: vi.fn(async () => ({ error: null })),
    getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://cdn/x.mp4' } })),
    remove,
  };
  const query = {
    insert: () => query,
    select: () => query,
    single: async () => (insertError ? { data: null, error: { message: insertError } } : { data: { id: '1' }, error: null }),
  };
  return {
    client: { rpc: rpc || vi.fn(async () => ({ data: 7, error: null })), from: () => query, storage: { from: () => storageApi } },
    storageApi,
  };
}

describe('repositorios del portal', () => {
  test('saveLevel valida con ExerciseFactory y envía filas normalizadas', async () => {
    const rpc = vi.fn(async () => ({ data: 7, error: null }));
    const repo = createContentRepository(fakeClient({ rpc }).client as never);
    const level = { id: 7, title: 'Saludos', description: '', category: 'vocabulario', available: true, sort_order: 7 };

    await expect(repo.saveLevel(level, [{ type: 'typing', title: '', hint: '', payload: { sign: 'a' } }])).rejects.toThrow(RepositoryError);
    expect(rpc).not.toHaveBeenCalled();

    await repo.saveLevel(level, [{ type: 'typing', title: '', hint: ' pista ', payload: { sign: 'a', answer: 'A', basura: 1 } }]);
    expect(rpc).toHaveBeenCalledWith('save_level', {
      p_level: level,
      p_exercises: [{ type: 'typing', title: 'Escribir la letra', hint: 'pista', payload: { sign: 'a', answer: 'A' } }],
    });
  });

  test('errores de Supabase llegan traducidos', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'new row violates row-level security policy' } }));
    const repo = createContentRepository(fakeClient({ rpc }).client as never);
    await expect(
      repo.saveLevel({ id: 1, title: 'x', description: '', category: 'alfabeto', available: true, sort_order: 0 }, []),
    ).rejects.toThrow('No tienes permisos para realizar esta acción.');
  });

  test('secciones: completa con los textos por defecto y descarta valores de tipo incorrecto', () => {
    const merged = mergeSections([
      { key: 'hero', value: { title: 'Nuevo título', text: 42 } },
      { key: 'features', value: { visible: 'no', items: [{ icon: 'inexistente', title: 'Juegos' }, 'basura'] } },
      { key: 'otra', value: { title: 'ignorada' } },
    ]);
    expect(merged.hero.title).toBe('Nuevo título');
    expect(merged.hero.text).toBe(DEFAULT_SECTIONS.hero.text);
    expect(merged.features.visible).toBe(true);
    expect(merged.features.items).toEqual([{ icon: 'sparkles', title: 'Juegos', text: '' }]);
    expect(merged.download).toEqual(DEFAULT_SECTIONS.download);
    expect(mergeSections([])).toEqual(DEFAULT_SECTIONS);
  });

  test('publicaciones: solo enlaces web válidos', () => {
    expect(normalizeUrl('ejemplo.cl/congreso')).toBe('https://ejemplo.cl/congreso');
    expect(normalizeUrl('http://ejemplo.cl')).toBe('http://ejemplo.cl/');
    expect(normalizeUrl('  ')).toBeNull();
    expect(normalizeUrl('no es un enlace')).toBeNull();
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
  });

  test('medios: tipo por MIME, nombres seguros y limpieza si falla el registro', async () => {
    expect(kindFromMime('video/mp4')).toBe('video');
    expect(kindFromMime('image/png')).toBe('image');
    expect(kindFromMime('application/pdf')).toBe('document');
    expect(safeFileName('Señas Básicas (1).mp4')).toBe('senas-basicas-1-.mp4');

    const { client, storageApi } = fakeClient({ insertError: 'boom' });
    const repo = createMediaRepository(client as never);
    const file = new File(['x'], 'hola.mp4', { type: 'video/mp4' });
    await expect(repo.upload(file, { title: 'Hola', category: 'Básico' })).rejects.toThrow();
    expect(storageApi.remove).toHaveBeenCalledTimes(1);
  });
});
