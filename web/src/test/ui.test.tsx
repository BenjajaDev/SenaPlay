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
    expect(screen.getByRole('heading', { level: 1, name: /Entrena la Lengua de Señas Chilena/ })).toBeInTheDocument();
    expect(await screen.findByText('150')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Panel/ })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: 'Nosotros' })).toHaveAttribute('href', '#nosotros');
  });

  test('la landing muestra misión, visión y solo el equipo visible', async () => {
    renderAt('/');
    expect(await screen.findByText('Fomentar la práctica diaria de la LSCh.')).toBeInTheDocument();
    expect(screen.getByText('Una sociedad donde comunicarse en señas sea cotidiano.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Ana Pérez' })).toBeInTheDocument();
    expect(screen.queryByText('Luis Soto')).not.toBeInTheDocument();
  });

  test('el ícono del nav cambia con el tema', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const icon = () => document.querySelector('.brand-link img') as HTMLImageElement;
    const initial = icon().getAttribute('src');
    await user.click(screen.getByRole('button', { name: /Usar tema/ }));
    expect(icon().getAttribute('src')).not.toBe(initial);
    expect(icon().getAttribute('src')).toMatch(/^\/brand\/icono-(claro|oscuro)\.png$/);
  });

  test('editar la misión en el panel pide confirmación antes de publicar', async () => {
    const user = userEvent.setup();
    const repos = renderAt('/admin/site/about');
    const mission = await screen.findByLabelText('Misión *');
    await user.clear(mission);
    await user.type(mission, 'Fomentar el uso de la LSCh');
    await user.click(screen.getByRole('button', { name: 'Guardar y publicar' }));
    expect(repos.site.saveAbout).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(repos.site.saveAbout).toHaveBeenCalled());
    expect(vi.mocked(repos.site.saveAbout).mock.calls[0][0]).toMatchObject({ mission: 'Fomentar el uso de la LSCh' });
  });

  test('el panel lista el equipo, incluidos los ocultos, y exige confirmar al eliminar', async () => {
    const user = userEvent.setup();
    const repos = renderAt('/admin/site/about');
    expect(await screen.findByText('Luis Soto')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Eliminar a Ana Pérez' }));
    expect(await screen.findByRole('dialog', { name: '¿Eliminar a Ana Pérez?' })).toBeInTheDocument();
    expect(repos.site.deleteTeamMember).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(repos.site.deleteTeamMember).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' })));
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
