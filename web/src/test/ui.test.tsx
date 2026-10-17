import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { AppRoutes } from '@/App';
import { AuthProvider } from '@/auth/AuthProvider';
import { RepositoriesProvider } from '@/data/RepositoriesProvider';
import { DEFAULT_SECTIONS } from '@/data/repositories';
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
    expect(await screen.findByRole('heading', { level: 1, name: /Entrena la Lengua de Señas Chilena/ })).toBeInTheDocument();
    expect(await screen.findByText('150')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Panel/ })).toHaveAttribute('href', '/admin');
    expect(within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', { name: 'Nosotros' })).toHaveAttribute('href', '#nosotros');
  });

  test('la landing muestra misión, visión y solo el equipo visible', async () => {
    renderAt('/');
    expect(await screen.findByText('Fomentar la práctica diaria de la LSCh.')).toBeInTheDocument();
    expect(screen.getByText('Una sociedad donde comunicarse en señas sea cotidiano.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Ana Pérez' })).toBeInTheDocument();
    expect(screen.queryByText('Luis Soto')).not.toBeInTheDocument();
  });

  test('la landing muestra las seis cifras por separado', async () => {
    renderAt('/');
    const metrics = screen.getByRole('region', { name: 'SeñaPlay en números' });
    expect(await within(metrics).findByText('150')).toBeInTheDocument();
    ['Niveles disponibles', 'Ejercicios', 'Entradas de diccionario', 'Señas de vocabulario', 'Videos publicados', 'Usuarios registrados'].forEach((label) =>
      expect(within(metrics).getByText(label)).toBeInTheDocument(),
    );
    expect(within(metrics).getByText('47')).toBeInTheDocument();
    expect(within(metrics).getByText('7')).toBeInTheDocument();
  });

  test('la landing muestra solo publicaciones visibles y abre el detalle', async () => {
    const user = userEvent.setup();
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Congreso de Lengua de Señas' })).toBeInTheDocument();
    expect(screen.queryByText('Prueba con estudiantes')).not.toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', { name: 'Publicaciones' })).toHaveAttribute('href', '#publicaciones');
    await user.click(screen.getByRole('button', { name: 'Leer más sobre Congreso de Lengua de Señas' }));
    const dialog = await screen.findByRole('dialog', { name: 'Congreso de Lengua de Señas' });
    expect(within(dialog).getByText('Compartimos la app y recibimos comentarios.')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /Ver enlace/ })).toHaveAttribute('href', 'https://ejemplo.cl/congreso');
  });

  test('la landing respeta los textos y secciones ocultas definidos en el panel', async () => {
    const repos = fakeRepositories();
    vi.mocked(repos.site.getSections).mockResolvedValue({
      ...DEFAULT_SECTIONS,
      hero: { ...DEFAULT_SECTIONS.hero, title: 'Practica señas cada día' },
      features: { ...DEFAULT_SECTIONS.features, visible: false },
    });
    renderAt('/', repos);
    expect(await screen.findByRole('heading', { level: 1, name: 'Practica señas cada día' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: DEFAULT_SECTIONS.features.title })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Características' })).not.toBeInTheDocument();
  });

  test('editar una sección de la landing pide confirmación y guarda solo esa sección', async () => {
    const user = userEvent.setup();
    const repos = renderAt('/admin/site/sections');
    const title = await screen.findByLabelText('Título *');
    await user.clear(title);
    await user.type(title, 'Practica LSCh jugando');
    await user.click(screen.getByRole('button', { name: 'Guardar y publicar' }));
    expect(repos.site.saveSection).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(repos.site.saveSection).toHaveBeenCalledWith('hero', expect.objectContaining({ title: 'Practica LSCh jugando' })));
  });

  test('una tarjeta de características sin texto no se puede publicar', async () => {
    const user = userEvent.setup();
    const repos = renderAt('/admin/site/sections');
    await user.click(await screen.findByRole('tab', { name: 'Características' }));
    await user.click(screen.getByRole('button', { name: 'Agregar elemento' }));
    await user.click(screen.getByRole('button', { name: 'Guardar y publicar' }));
    expect((await screen.findAllByText('Campo obligatorio.')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(repos.site.saveSection).not.toHaveBeenCalled();
  });

  test('el panel lista publicaciones (incluidos borradores) y publicar exige confirmación', async () => {
    const user = userEvent.setup();
    const repos = renderAt('/admin/site/publications');
    expect(await screen.findByText('Prueba con estudiantes')).toBeInTheDocument();
    expect(screen.getByText('Borrador')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Publicar Prueba con estudiantes' }));
    expect(await screen.findByRole('dialog', { name: '¿Publicar «Prueba con estudiantes»?' })).toBeInTheDocument();
    expect(repos.publications.setPublished).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(repos.publications.setPublished).toHaveBeenCalledWith('p2', true));
  });

  test('crear una publicación valida los campos y guarda como borrador', async () => {
    const user = userEvent.setup();
    const repos = renderAt('/admin/site/publications');
    await user.click(await screen.findByRole('button', { name: 'Nueva publicación' }));
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(await screen.findAllByText('Campo obligatorio.')).toHaveLength(2);
    await user.type(screen.getByLabelText('Título *'), 'Taller en colegio');
    await user.type(screen.getByLabelText('Resumen *'), 'Jugamos con estudiantes Sordos.');
    await user.type(screen.getByLabelText('Enlace'), 'no es un enlace');
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(await screen.findByText(/dirección web válida/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Enlace'));
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(repos.publications.save).toHaveBeenCalled());
    expect(vi.mocked(repos.publications.save).mock.calls[0][0]).toMatchObject({ title: 'Taller en colegio', published: false });
  });

  test('el resumen del panel enlaza cada cifra a su sección', async () => {
    renderAt('/admin');
    expect(await screen.findByRole('link', { name: /Entradas de diccionario: 47/ })).toHaveAttribute('href', '/admin/dictionary');
    expect(screen.getByRole('link', { name: /Usuarios registrados: 150/ })).toHaveAttribute('href', '/admin/users');
  });

  test('el resumen muestra los ejercicios donde más se equivocan los usuarios', async () => {
    renderAt('/admin');
    const table = await screen.findByRole('table');
    expect(within(table).getByText('42')).toBeInTheDocument();
    expect(within(table).getByText('«D»')).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'Nivel 1' })).toHaveAttribute('href', '/admin/levels/1');
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

  test('la tarjeta del equipo en la landing incluye descripción y redes seguras', async () => {
    renderAt('/');
    const card = (await screen.findByRole('heading', { name: 'Ana Pérez' })).closest('article') as HTMLElement;
    expect(card).toHaveAttribute('tabindex', '0');
    expect(within(card).getByText('Diseña la experiencia de SeñaPlay.')).toBeInTheDocument();
    const link = within(card).getByRole('link', { name: /LinkedIn de Ana Pérez/ });
    expect(link).toHaveAttribute('href', 'https://www.linkedin.com/in/ana');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveClass('social-link--bounce');
  });

  test('el panel agrega una red al integrante y valida el enlace antes de guardar', async () => {
    const user = userEvent.setup();
    const repos = renderAt('/admin/site/about');
    await user.click(await screen.findByRole('button', { name: 'Editar a Ana Pérez' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar a Ana Pérez' });
    await user.click(within(dialog).getByRole('button', { name: 'Agregar red' }));
    await user.click(within(dialog).getAllByRole('radio', { name: 'GitHub' })[1]);
    await user.selectOptions(within(dialog).getAllByLabelText('Animación al pasar el mouse')[1], 'spin');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(await within(dialog).findByText(/Escribe el enlace/)).toBeInTheDocument();
    expect(repos.site.saveTeamMember).not.toHaveBeenCalled();

    await user.type(within(dialog).getAllByLabelText('Enlace *')[1], 'https://github.com/ana');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(repos.site.saveTeamMember).toHaveBeenCalled());
    expect(vi.mocked(repos.site.saveTeamMember).mock.calls[0][0].socials).toEqual([
      { network: 'linkedin', url: 'https://www.linkedin.com/in/ana', animation: 'bounce' },
      { network: 'github', url: 'https://github.com/ana', animation: 'spin' },
    ]);
  });

  test('mi perfil guarda el nombre tras confirmar y cambia la contraseña', async () => {
    const user = userEvent.setup();
    const repos = renderAt('/admin/profile');
    const name = await screen.findByLabelText('Nombre completo *');
    await user.clear(name);
    await user.type(name, 'Benja Admin');
    await user.click(screen.getByRole('button', { name: 'Guardar datos' }));
    await user.click(await screen.findByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(repos.account.updateProfile).toHaveBeenCalledWith('admin-1', { full_name: 'Benja Admin', email: 'admin@senaplay.cl' }, 'admin@senaplay.cl'));

    await user.type(screen.getByLabelText('Contraseña actual *'), 'vieja1234');
    await user.type(screen.getByLabelText('Nueva contraseña *'), 'nueva1234');
    await user.type(screen.getByLabelText('Repite la nueva contraseña *'), 'nueva1234');
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(repos.account.changePassword).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog', { name: '¿Cambiar tu contraseña?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cambiar contraseña' }));
    await waitFor(() => expect(repos.account.changePassword).toHaveBeenCalledWith('admin@senaplay.cl', 'vieja1234', 'nueva1234'));
  });

  test('el público no ve el acceso al panel', async () => {
    const repos = fakeRepositories();
    vi.mocked(repos.users.getRole).mockResolvedValue('user');
    renderAt('/', repos);
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    await waitFor(() => expect(repos.users.getRole).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: /Panel/ })).not.toBeInTheDocument();
  });

  test('la landing muestra el teléfono con capturas, las señas del hero y el pie editable', async () => {
    const user = userEvent.setup();
    const repos = fakeRepositories();
    vi.mocked(repos.site.getSections).mockResolvedValue({
      ...structuredClone(DEFAULT_SECTIONS),
      showcase: {
        ...DEFAULT_SECTIONS.showcase,
        screens: [
          { image_url: '/c1.png', image_path: null, caption: 'Elige un nivel' },
          { image_url: '/c2.png', image_path: null, caption: 'Practica con la cámara' },
        ],
      },
      footer: {
        ...DEFAULT_SECTIONS.footer,
        email: 'hola@senaplay.cl',
        links: [{ label: 'Universidad', url: 'https://u.cl' }, { label: 'Malo', url: 'javascript:alert(1)' }],
        socials: [{ network: 'instagram', url: 'https://instagram.com/senaplay', animation: 'wiggle' }],
      },
    });
    renderAt('/', repos);
    const carousel = await screen.findByRole('region', { name: /Capturas de SeñaPlay/ });
    expect(within(carousel).getByRole('img', { name: 'Elige un nivel' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver captura 2: Practica con la cámara' }));
    expect(screen.getByRole('button', { name: 'Ver captura 2: Practica con la cámara' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Pausar el carrusel' })).toBeInTheDocument();

    expect(document.querySelectorAll('.hero__visual .sign-card')).toHaveLength(3);
    expect(document.querySelector('.hero__visual .sign-card__slide')).toHaveAttribute('src', '/signs/A.webp');

    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: /hola@senaplay.cl/ })).toHaveAttribute('href', 'mailto:hola@senaplay.cl');
    expect(within(footer).getByRole('link', { name: /Universidad/ })).toHaveAttribute('href', 'https://u.cl/');
    expect(within(footer).queryByText('Malo')).not.toBeInTheDocument();
    expect(within(footer).getByRole('link', { name: /Instagram de SeñaPlay/ })).toHaveClass('social-link--wiggle');
  });

  test('el panel edita una tarjeta de señas del hero y agrega capturas del teléfono', async () => {
    const user = userEvent.setup();
    const repos = renderAt('/admin/site/sections');
    await user.selectOptions(await screen.findByLabelText('Imagen de la seña 1 de la tarjeta 1'), 'Ñ');
    expect(screen.getAllByLabelText('Texto bajo la seña *')[0]).toHaveValue('Ñ');
    await user.click(screen.getByRole('button', { name: 'Guardar y publicar' }));
    await user.click(await screen.findByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(repos.site.saveSection).toHaveBeenCalled());
    const [key, hero] = vi.mocked(repos.site.saveSection).mock.calls[0] as [string, typeof DEFAULT_SECTIONS.hero];
    expect(key).toBe('hero');
    expect(hero.signDecks[0][0]).toEqual({ label: 'Ñ', image_url: '/signs/NN.webp', image_path: null });

    await user.click(screen.getByRole('tab', { name: /La app/ }));
    const file = new File(['png'], 'inicio.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Agregar captura'), file);
    expect(await screen.findByRole('img', { name: 'Vista previa de la captura 1' })).toHaveAttribute('src', 'https://cdn.test/landing/inicio.png');
    expect(repos.site.uploadLandingImage).toHaveBeenCalledWith(file);

    // Descartar borra del bucket la imagen subida que no se publicó.
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(repos.site.removeLandingImages).toHaveBeenCalledWith(['landing/inicio.png']));
  });

  test('el pie de página valida sus enlaces antes de publicar', async () => {
    const user = userEvent.setup();
    const repos = renderAt('/admin/site/sections');
    await user.click(await screen.findByRole('tab', { name: /Pie de página/ }));
    await user.click(screen.getByRole('button', { name: 'Agregar enlace' }));
    await user.type(screen.getByLabelText('Texto *'), 'Universidad');
    await user.type(screen.getByLabelText('Dirección *'), 'javascript:alert(1)');
    await user.click(screen.getByRole('button', { name: 'Guardar y publicar' }));
    expect(await screen.findByText(/Usa https/)).toBeInTheDocument();
    expect(repos.site.saveSection).not.toHaveBeenCalled();
  });
});
