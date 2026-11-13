import { render, screen } from '@testing-library/react-native';
import { ServicesProvider } from '../../../../core/di/ServicesProvider';
import { AppThemeProvider } from '../../../../shared/theme/ThemeProvider';
import { SignClipsProvider } from '../SignClipsProvider';
import SignImage from '../SignImage';

jest.mock('../../../../core/a11y/useReducedMotion', () => ({
  __esModule: true,
  default: jest.fn(() => false),
  primeReducedMotion: jest.fn(),
}));

const PERRO = {
  id: 'c-perro',
  signKey: 'perro',
  gloss: 'PERRO',
  variant: 1,
  region: 'general',
  videoUrl: 'https://storage.test/sign-clips/perro/1-a.mp4',
  posterUrl: 'https://storage.test/sign-clips/perro/1-a.webp',
  durationMs: 2500,
};

const renderWith = (ui, clips = [PERRO]) =>
  render(
    <AppThemeProvider>
      <ServicesProvider services={{ signClips: { getCachedClips: async () => null, listClips: async () => ({ clips, source: 'remote' }) } }}>
        <SignClipsProvider>{ui}</SignClipsProvider>
      </ServicesProvider>
    </AppThemeProvider>,
  );

describe('SignImage con accessibilityName (la glosa es la respuesta)', () => {
  test('el reproductor no nombra la seña', async () => {
    await renderWith(<SignImage signKey="perro" size={120} accessibilityName="Seña de la opción 2" />);
    expect(await screen.findByRole('button', { name: 'Ver la seña de la opción 2 en movimiento' })).toBeTruthy();
    expect(screen.queryByLabelText(/PERRO/i)).toBeNull();
  });

  test('en caja chica la imagen tampoco la nombra', async () => {
    await renderWith(<SignImage signKey="perro" size={72} accessibilityName="Seña a interpretar" />);
    expect(await screen.findByRole('image', { name: 'Seña a interpretar, con movimiento' })).toBeTruthy();
  });

  test('el placeholder no muestra la glosa ni en texto ni en el nombre accesible', async () => {
    await renderWith(<SignImage signKey="gato" size={120} accessibilityName="Seña de la opción 1" />, []);
    expect(screen.queryByText(/GATO/i)).toBeNull();
    expect(screen.queryByLabelText(/GATO/i)).toBeNull();
    expect(screen.getByLabelText('Seña de la opción 1, imagen pendiente')).toBeTruthy();
  });

  test('sin accessibilityName todo sigue igual', async () => {
    await renderWith(<SignImage signKey="perro" size={120} />);
    expect(await screen.findByRole('button', { name: 'Ver la seña PERRO en movimiento' })).toBeTruthy();
  });
});
