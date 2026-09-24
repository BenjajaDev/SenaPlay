import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { AppRoutes } from '@/App';
import { AuthProvider } from '@/auth/AuthProvider';
import { RepositoriesProvider } from '@/data/RepositoriesProvider';
import { FeedbackProvider } from '@/ui';
import { fakeRepositories } from './fakes';

// Sesión simulada de un administrador (la autorización real es RLS).
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

function renderAt(path: string, repositories = fakeRepositories()) {
  render(
    <RepositoriesProvider repositories={repositories}>
      <FeedbackProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </AuthProvider>
      </FeedbackProvider>
    </RepositoriesProvider>,
  );
  return repositories;
}

describe('portal web', () => {
  test('la landing muestra métricas reales y enlaces', async () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: /Aprende a comunicarte en señas/ })).toBeInTheDocument();
    expect(await screen.findByText('150')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Panel/ })).toHaveAttribute('href', '/admin');
  });

  test('eliminar un nivel exige confirmación', async () => {
    const user = userEvent.setup();
    const repos = renderAt('/admin/levels');
    await user.click(await screen.findByRole('button', { name: 'Eliminar Letras A-E' }));
    expect(await screen.findByRole('dialog', { name: '¿Eliminar «Letras A-E»?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(repos.content.deleteLevel).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Eliminar Letras A-E' }));
    await user.click(await screen.findByRole('button', { name: 'Eliminar nivel' }));
    await waitFor(() => expect(repos.content.deleteLevel).toHaveBeenCalledWith(1));
  });

  test('el editor de niveles publica tras confirmar', async () => {
    const user = userEvent.setup();
    const repos = renderAt('/admin/levels/1');
    const title = await screen.findByLabelText('Título *');
    await user.clear(title);
    await user.type(title, 'Letras renovadas');
    await user.click(screen.getByRole('button', { name: 'Guardar y publicar' }));
    await user.click(await screen.findByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(repos.content.saveLevel).toHaveBeenCalled());
    expect(vi.mocked(repos.content.saveLevel).mock.calls[0][0]).toMatchObject({ id: 1, title: 'Letras renovadas' });
  });

  test('activar mantenimiento muestra advertencia antes de publicar', async () => {
    const user = userEvent.setup();
    const repos = renderAt('/admin/config');
    await user.click(await screen.findByRole('switch', { name: /Activar mantenimiento/ }));
    const publishButtons = screen.getAllByRole('button', { name: 'Publicar' });
    await user.click(publishButtons[0]);
    expect(await screen.findByText('Esto BLOQUEARÁ la app para todos los usuarios.')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Publicar' }).pop()!);
    await waitFor(() => expect(repos.config.setConfig).toHaveBeenCalledWith('maintenance', expect.objectContaining({ enabled: true })));
  });
});
