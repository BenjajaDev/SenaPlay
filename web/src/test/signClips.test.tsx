import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { AppRoutes } from '@/App';
import { AuthProvider } from '@/auth/AuthProvider';
import { RepositoriesProvider } from '@/data/RepositoriesProvider';
import { checkExportedClip, createSignClipsRepository, nextVariant, RepositoryError, type NewSignClip } from '@/data/repositories';
import { conversionOptions, toCropRectangle } from '@/features/admin/content/signClips/clipExport';
import { createClipEdit, type ClipEdit } from '@/lib/domain';
import { FeedbackProvider } from '@/ui';
import { fakeRepositories } from './fakes';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'admin-1', email: 'admin@senaplay.cl' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => ({}),
      signInWithPassword: async () => ({ error: null }),
    },
  },
}));

function renderClips(repositories = fakeRepositories()) {
  render(
    <RepositoriesProvider repositories={repositories}>
      <FeedbackProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/admin/sign-clips']}>
            <AppRoutes />
          </MemoryRouter>
        </AuthProvider>
      </FeedbackProvider>
    </RepositoriesProvider>,
  );
  return repositories;
}

const edit: ClipEdit = { ...createClipEdit({ width: 1920, height: 1080, durationMs: 8000 }), trim: { startMs: 300, endMs: 3300 }, keyFrameMs: 1500 };

const exported = (overrides: Partial<{ video: Blob; poster: Blob; durationMs: number }> = {}) => ({
  video: new Blob(['mp4'], { type: 'video/mp4' }),
  poster: new Blob(['webp'], { type: 'image/webp' }),
  durationMs: 3000,
  size: 480,
  ...overrides,
});

const newClip = (overrides: Partial<NewSignClip> = {}): NewSignClip => ({
  ...exported(),
  gloss: 'MÉDICO / DOCTOR',
  variant: 1,
  region: 'general',
  signerAlias: 'Señante A',
  consentRef: 'CONS-001',
  license: 'propia',
  edit,
  ...overrides,
});

function fakeClient({ insertError }: { insertError?: string } = {}) {
  const storageApi = {
    upload: vi.fn(async (_path: string, _file: Blob) => ({ error: null })),
    remove: vi.fn(async () => ({ error: null })),
    getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } })),
  };
  const insert = vi.fn(async (_row: Record<string, unknown>) => (insertError ? { data: null, error: { message: insertError } } : { data: null, error: null }));
  const client = { from: () => ({ insert }), storage: { from: () => storageApi } };
  return { client, storageApi, insert };
}

describe('Señas en video · página', () => {
  test('muestra el avance del catálogo con estado en texto e icono', async () => {
    renderClips();
    expect(await screen.findByRole('heading', { name: 'Señas en video' })).toBeInTheDocument();
    expect(await screen.findByText('1 de 31 glosas del catálogo publicadas')).toBeInTheDocument();
    expect(screen.getByText('En revisión')).toBeInTheDocument();
    expect(screen.getByText('Validada')).toBeInTheDocument();
    expect(screen.getByText('Publicada')).toBeInTheDocument();
    expect(screen.getAllByText('Sin clip')).toHaveLength(29);
  });

  test('un admin valida un clip en revisión tras confirmar', async () => {
    const repos = renderClips();
    await userEvent.click(await screen.findByRole('button', { name: 'Validar' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/revisada por la comunidad/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Validar' }));
    expect(repos.signClips.setStatus).toHaveBeenCalledWith('clip-dolor', 'validated');
  });

  test('rechazar exige una nota', async () => {
    const repos = renderClips();
    await userEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Rechazar' });
    expect(confirmButton).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Qué hay que corregir/), 'La mano sale del cuadro');
    await userEvent.click(confirmButton);
    expect(repos.signClips.setStatus).toHaveBeenCalledWith('clip-dolor', 'rejected', 'La mano sale del cuadro');
  });

  test('un editor no ve validar, publicar ni eliminar', async () => {
    const repos = fakeRepositories();
    vi.mocked(repos.users.getRole).mockResolvedValue('editor');
    renderClips(repos);
    expect(await screen.findByText('En revisión')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Validar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Eliminar/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Despublicar' })).toBeInTheDocument();
  });
});

describe('Señas en video · repositorio', () => {
  test('sube video e imagen en la carpeta de la seña y registra el borrador', async () => {
    const { client, storageApi, insert } = fakeClient();
    await createSignClipsRepository(client as never).create(newClip());

    const paths = storageApi.upload.mock.calls.map((call) => call[0]);
    expect(paths[0]).toMatch(/^medico\/1-[0-9a-f-]+\.mp4$/);
    expect(paths[1]).toMatch(/^medico\/1-[0-9a-f-]+\.webp$/);
    expect(insert.mock.calls[0][0]).toMatchObject({
      sign_key: 'medico',
      gloss: 'MÉDICO / DOCTOR',
      video_path: paths[0],
      poster_path: paths[1],
      duration_ms: 3000,
      width: 480,
      height: 480,
      consent_ref: 'CONS-001',
      edit_params: edit,
    });
  });

  test('si no se puede registrar el clip, borra los archivos subidos', async () => {
    const { client, storageApi } = fakeClient({ insertError: 'duplicate key value violates unique constraint' });
    await expect(createSignClipsRepository(client as never).create(newClip())).rejects.toThrow(RepositoryError);
    expect(storageApi.remove).toHaveBeenCalledWith([expect.stringMatching(/\.mp4$/), expect.stringMatching(/\.webp$/)]);
  });

  test('no sube nada sin consentimiento ni con archivos fuera de formato', async () => {
    const { client, storageApi } = fakeClient();
    const repo = createSignClipsRepository(client as never);
    await expect(repo.create(newClip({ consentRef: '  ' }))).rejects.toThrow('consentimiento');
    await expect(repo.create(newClip({ poster: new Blob(['png'], { type: 'image/png' }) }))).rejects.toThrow('WebP');
    expect(storageApi.upload).not.toHaveBeenCalled();
  });

  test('checkExportedClip rechaza videos de más de 1,5 MB', () => {
    const heavy = exported({ video: new Blob([new Uint8Array(1_600_000)], { type: 'video/mp4' }) });
    expect(() => checkExportedClip(heavy, edit)).toThrow('1,5 MB');
  });

  test('nextVariant propone la siguiente variante libre', () => {
    const clips = [
      { sign_key: 'dolor', variant: 1 },
      { sign_key: 'dolor', variant: 2 },
      { sign_key: 'tos', variant: 1 },
    ];
    expect(nextVariant(clips, 'dolor')).toBe(3);
    expect(nextVariant(clips, 'fiebre')).toBe(1);
  });
});

describe('Señas en video · exportación', () => {
  test('convierte el encuadre al formato de mediabunny y fija 480 × 480, 30 fps, H.264 sin audio', () => {
    expect(toCropRectangle({ left: 420, top: 0, size: 1080 })).toEqual({ left: 420, top: 0, width: 1080, height: 1080 });
    expect(conversionOptions(edit, 1_000_000)).toEqual({
      trim: { start: 0.3, end: 3.3 },
      video: { crop: { left: 420, top: 0, width: 1080, height: 1080 }, width: 480, height: 480, fit: 'fill', frameRate: 30, codec: 'avc', bitrate: 1_000_000, forceTranscode: true },
      audio: { discard: true },
    });
  });
});

describe('Señas en video · editor de niveles', () => {
  test('avisa, sin bloquear, las señas sin clip publicado ni foto', async () => {
    const repos = fakeRepositories();
    vi.mocked(repos.content.getLevel).mockResolvedValue({
      id: 1,
      title: 'Salud',
      description: '',
      category: 'vocabulario',
      available: true,
      sort_order: 1,
      exercise_count: 2,
      exercises: [
        { type: 'typing', title: '', hint: '', payload: { sign: 'a', answer: 'A' } },
        { type: 'word-meaning', title: '', hint: '', payload: { signs: ['fiebre', 'dolor', 'tos'], options: ['x', 'y'], correct: 'x' } },
      ],
    } as never);
    render(
      <RepositoriesProvider repositories={repos}>
        <FeedbackProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={['/admin/levels/1']}>
              <AppRoutes />
            </MemoryRouter>
          </AuthProvider>
        </FeedbackProvider>
      </RepositoriesProvider>,
    );
    const warnings = await screen.findAllByText(/Sin clip publicado ni foto/);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toHaveTextContent('Sin clip publicado ni foto: dolor, tos.');
    expect(within(screen.getByLabelText('Ejercicio 1')).queryByText(/Sin clip publicado/)).not.toBeInTheDocument();
  });
});

describe('Señas en video · formatos', () => {
  test('explica cómo resolver un video HEVC del iPhone que el navegador no lee', async () => {
    const { undecodableMessage } = await import('@/features/admin/content/signClips/clipExport');
    expect(undecodableMessage('hevc')).toMatch(/HEVC.*Más compatible/);
    expect(undecodableMessage('vp8')).toMatch(/H\.264/);
  });
});
