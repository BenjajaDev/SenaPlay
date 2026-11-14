import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ServicesProvider } from '../../../../core/di/ServicesProvider';
import { SignClipsProvider } from '../../../signs/presentation/SignClipsProvider';
import { SignNameHintProvider } from '../../../signs/presentation/SignNameHint';
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

const CLIPS = [clip('yo', 'YO'), clip('tener', 'TENER'), clip('fiebre', 'FIEBRE'), clip('buenos-dias', 'BUENOS DIAS')];

const renderWithClips = (ui) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppThemeProvider>
        <ServicesProvider services={{ signClips: { getCachedClips: async () => null, listClips: async () => ({ clips: CLIPS, source: 'remote' }) } }}>
          <SignClipsProvider>
            <SignNameHintProvider>{ui}</SignNameHintProvider>
          </SignClipsProvider>
        </ServicesProvider>
      </AppThemeProvider>
    </SafeAreaProvider>,
  );

const nameBanner = (name) => screen.findByRole('button', { name: `Esta seña es ${name}` });

describe('SignStrip con clips', () => {
  test('una sola seña con clip se muestra grande, con reproductor, y mantener presionado muestra su nombre', async () => {
    await renderWithClips(<SignStrip signs={['fiebre']} />);
    expect(await screen.findByRole('button', { name: 'Ver la seña FIEBRE en movimiento' })).toBeTruthy();

    await act(async () => fireEvent(screen.getByRole('imagebutton', { name: 'Seña 1 de 1' }), 'longPress'));
    expect(await nameBanner('Fiebre')).toBeTruthy();
  });

  test('mantener presionado el video mismo también muestra el nombre', async () => {
    await renderWithClips(<SignStrip signs={['fiebre']} />);
    const player = await screen.findByRole('button', { name: 'Ver la seña FIEBRE en movimiento' });
    expect(player.props.accessibilityHint).toBe('Video de 2,5 segundos, sin sonido. Mantén presionado para ver su nombre');
    await act(async () => fireEvent(player, 'longPress'));
    expect(await nameBanner('Fiebre')).toBeTruthy();
  });

  test('con la glosa oculta, el nombre no aparece hasta que la persona lo pide (con tildes del club)', async () => {
    await renderWithClips(<SignStrip signs={['buenos-dias']} concealGloss />);
    const sign = await screen.findByRole('imagebutton', { name: 'Seña 1 de 1' });
    expect(screen.queryByText('Buenos días')).toBeNull();

    await act(async () => fireEvent(sign, 'longPress'));
    expect(await nameBanner('Buenos días')).toBeTruthy();
  });

  test('tocar el aviso lo cierra', async () => {
    await renderWithClips(<SignStrip signs={['fiebre']} />);
    await act(async () => fireEvent(await screen.findByRole('imagebutton', { name: 'Seña 1 de 1' }), 'longPress'));
    await act(async () => fireEvent.press(await nameBanner('Fiebre')));
    expect(screen.queryByText('Fiebre')).toBeNull();
  });

  test('en una frase de tres señas, tocar una abre su clip en una hoja y la fila no tiene reproductores', async () => {
    await renderWithClips(<SignStrip signs={['yo', 'tener', 'fiebre']} />);
    const second = await screen.findByRole('imagebutton', { name: 'Seña 2 de 3' });
    expect(second.props.accessibilityHint).toBe('Toca para verla en movimiento. Mantén presionado para ver su nombre');
    expect(screen.queryByRole('button', { name: /en movimiento/ })).toBeNull();

    await act(async () => fireEvent.press(second));
    expect(await screen.findByRole('button', { name: 'Ver la seña TENER en movimiento' })).toBeTruthy();

    await act(async () => fireEvent(screen.getByRole('imagebutton', { name: 'Seña 3 de 3' }), 'longPress'));
    expect(await nameBanner('Fiebre')).toBeTruthy();
  });

  test('las letras sin clip mantienen su tamaño y dicen qué letra son', async () => {
    await renderWithClips(<SignStrip signs={['h', 'o', 'l', 'a']} />);
    const tile = await screen.findByRole('imagebutton', { name: 'Seña 1 de 4' });
    expect(tile.props.accessibilityHint).toBe('Mantén presionado para ver su nombre');
    expect(screen.getByRole('image', { name: 'Seña de H' })).toBeTruthy();
    await act(async () => fireEvent(tile, 'longPress'));
    expect(await nameBanner('Letra H')).toBeTruthy();
  });

  test('en el foco de un ejercicio, el reproductor no bloquea el nombre', async () => {
    await renderWithClips(<SignSpotlight sign="fiebre" />);
    expect(await screen.findByRole('button', { name: 'Ver la seña FIEBRE en movimiento' })).toBeTruthy();
    await act(async () => fireEvent(screen.getByRole('imagebutton'), 'longPress'));
    expect(await nameBanner('Fiebre')).toBeTruthy();
  });
});

describe('aviso del nombre', () => {
  test('una seña nueva reemplaza el nombre del aviso visible', async () => {
    await renderWithClips(<SignStrip signs={['yo', 'tener', 'fiebre']} />);
    await act(async () => fireEvent(await screen.findByRole('imagebutton', { name: 'Seña 1 de 3' }), 'longPress'));
    expect(await nameBanner('Yo')).toBeTruthy();
    await act(async () => fireEvent(screen.getByRole('imagebutton', { name: 'Seña 2 de 3' }), 'longPress'));
    expect(await nameBanner('Tener')).toBeTruthy();
    expect(screen.queryByText('Yo')).toBeNull();
  });
});
