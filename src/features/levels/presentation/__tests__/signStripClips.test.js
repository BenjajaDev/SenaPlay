import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ServicesProvider } from '../../../../core/di/ServicesProvider';
import { SignClipsProvider } from '../../../signs/presentation/SignClipsProvider';
import { AppThemeProvider } from '../../../../shared/theme/ThemeProvider';
import SignStrip, { SignSpotlight } from '../exercises/SignStrip';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const clip = (signKey, gloss) => ({
  id: `c-${signKey}`,
  signKey,
  gloss,
  variant: 1,
  region: 'general',
  videoUrl: `https://storage.test/sign-clips/${signKey}/1-a.mp4`,
  posterUrl: `https://storage.test/sign-clips/${signKey}/1-a.webp`,
  durationMs: 2500,
});

const CLIPS = [clip('yo', 'YO'), clip('tener', 'TENER'), clip('fiebre', 'FIEBRE')];

const renderWithClips = (ui) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppThemeProvider>
        <ServicesProvider services={{ signClips: { getCachedClips: async () => null, listClips: async () => ({ clips: CLIPS, source: 'remote' }) } }}>
          <SignClipsProvider>{ui}</SignClipsProvider>
        </ServicesProvider>
      </AppThemeProvider>
    </SafeAreaProvider>,
  );

describe('SignStrip con clips', () => {
  test('una sola seña con clip se muestra grande, con reproductor, y mantener presionado sigue dando la pista', async () => {
    const onHint = jest.fn();
    await renderWithClips(<SignStrip signs={['fiebre']} onHint={onHint} />);
    expect(await screen.findByRole('button', { name: 'Ver la seña FIEBRE en movimiento' })).toBeTruthy();

    await act(async () => fireEvent(screen.getByRole('imagebutton', { name: 'Seña 1 de 1' }), 'longPress'));
    expect(onHint).toHaveBeenCalledWith('fiebre');
  });

  test('en una frase de tres señas, tocar una abre su clip en una hoja y la fila no tiene reproductores', async () => {
    const onHint = jest.fn();
    await renderWithClips(<SignStrip signs={['yo', 'tener', 'fiebre']} onHint={onHint} />);
    const second = await screen.findByRole('imagebutton', { name: 'Seña 2 de 3' });
    expect(second.props.accessibilityHint).toBe('Toca para verla en movimiento. Mantén presionado para ver una pista');
    expect(screen.queryByRole('button', { name: /en movimiento/ })).toBeNull();

    await act(async () => fireEvent.press(second));
    expect(await screen.findByRole('button', { name: 'Ver la seña TENER en movimiento' })).toBeTruthy();

    await act(async () => fireEvent(screen.getByRole('imagebutton', { name: 'Seña 3 de 3' }), 'longPress'));
    expect(onHint).toHaveBeenCalledWith('fiebre');
  });

  test('las letras sin clip mantienen su tamaño y solo dan la pista', async () => {
    await renderWithClips(<SignStrip signs={['h', 'o', 'l', 'a']} />);
    const tile = await screen.findByRole('imagebutton', { name: 'Seña 1 de 4' });
    expect(tile.props.accessibilityHint).toBe('Mantén presionado para ver una pista');
    expect(screen.getByRole('image', { name: 'Seña de H' })).toBeTruthy();
  });

  test('en el foco de un ejercicio, el reproductor no bloquea la pista', async () => {
    const onHint = jest.fn();
    await renderWithClips(<SignSpotlight sign="fiebre" onHint={onHint} />);
    expect(await screen.findByRole('button', { name: 'Ver la seña FIEBRE en movimiento' })).toBeTruthy();
    await act(async () => fireEvent(screen.getByRole('imagebutton'), 'longPress'));
    expect(onHint).toHaveBeenCalledWith('fiebre');
  });
});
