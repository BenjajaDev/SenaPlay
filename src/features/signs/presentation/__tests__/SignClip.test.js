import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { __players } from 'expo-video';
import useReducedMotion from '../../../../core/a11y/useReducedMotion';
import { ServicesProvider } from '../../../../core/di/ServicesProvider';
import { AppThemeProvider } from '../../../../shared/theme/ThemeProvider';
import SignClip from '../SignClip';
import { SignClipsProvider } from '../SignClipsProvider';
import SignImage from '../SignImage';
import { resetSlowMotionForTests } from '../useSlowMotion';

jest.mock('../../../../core/a11y/useReducedMotion', () => ({
  __esModule: true,
  default: jest.fn(() => false),
  primeReducedMotion: jest.fn(),
}));

const DOLOR = {
  id: 'c1',
  signKey: 'dolor',
  gloss: 'DOLOR',
  variant: 1,
  region: 'general',
  videoUrl: 'https://storage.test/sign-clips/dolor/1-a.mp4',
  posterUrl: 'https://storage.test/sign-clips/dolor/1-a.webp',
  durationMs: 2800,
};

const wrap = (ui) => <AppThemeProvider>{ui}</AppThemeProvider>;
const lastPlayer = () => __players[__players.length - 1];
const playButton = () => screen.getByRole('button', { name: 'Ver la seña DOLOR en movimiento' });

beforeEach(() => {
  __players.length = 0;
  resetSlowMotionForTests();
  useReducedMotion.mockReturnValue(false);
});

describe('SignClip', () => {
  test('al entrar muestra la imagen fija y no descarga ni reproduce nada', async () => {
    await render(wrap(<SignClip clip={DOLOR} label="DOLOR" size={190} />));
    expect(playButton().props.accessibilityHint).toBe('Video de 2,8 segundos, sin sonido');
    expect(lastPlayer().replaceAsync).not.toHaveBeenCalled();
    expect(lastPlayer().play).not.toHaveBeenCalled();
    expect(lastPlayer().muted).toBe(true);
    expect(screen.queryByTestId('sign-clip-video')).toBeNull();
  });

  test('al tocar carga el video con caché, lo reproduce y vuelve a la imagen al terminar', async () => {
    await render(wrap(<SignClip clip={DOLOR} label="DOLOR" size={190} />));
    await act(async () => fireEvent.press(playButton()));

    const player = lastPlayer();
    expect(player.replaceAsync).toHaveBeenCalledWith({ uri: DOLOR.videoUrl, useCaching: true });
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sign-clip-video')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Detener la seña DOLOR' })).toBeTruthy();

    await act(async () => player.emit('playToEnd'));
    expect(playButton()).toBeTruthy();

    await act(async () => fireEvent.press(playButton()));
    expect(player.replaceAsync).toHaveBeenCalledTimes(1);
    expect(player.play).toHaveBeenCalledTimes(2);
  });

  test('tocar mientras corre lo detiene', async () => {
    await render(wrap(<SignClip clip={DOLOR} label="DOLOR" size={190} />));
    await act(async () => fireEvent.press(playButton()));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Detener la seña DOLOR' })));
    expect(lastPlayer().pause).toHaveBeenCalled();
    expect(playButton()).toBeTruthy();
  });

  test('«Lento» reproduce a 0,5× y la preferencia la comparten los demás clips', async () => {
    await render(
      wrap(
        <>
          <SignClip clip={DOLOR} label="DOLOR" size={190} />
          <SignClip clip={{ ...DOLOR, id: 'c2', videoUrl: 'https://storage.test/x.mp4' }} label="OTRA" size={190} />
        </>,
      ),
    );
    await act(async () => fireEvent.press(screen.getAllByRole('button', { name: 'Lento' })[0]));
    expect(__players.map((player) => player.playbackRate)).toEqual([0.5, 0.5]);
    expect(screen.getAllByRole('button', { name: 'Lento', selected: true })).toHaveLength(2);
  });

  test('«Repetir» activa el bucle y no se ofrece con «reducir movimiento»', async () => {
    const { unmount } = await render(wrap(<SignClip clip={DOLOR} label="DOLOR" size={190} />));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Repetir' })));
    expect(lastPlayer().loop).toBe(true);
    await unmount();

    useReducedMotion.mockReturnValue(true);
    await render(wrap(<SignClip clip={DOLOR} label="DOLOR" size={190} />));
    expect(screen.queryByRole('button', { name: 'Repetir' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Lento' })).toBeTruthy();
    expect(playButton()).toBeTruthy();
  });

  test('si el video falla vuelve a la imagen, avisa y permite reintentar', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    await render(wrap(<SignClip clip={DOLOR} label="DOLOR" size={190} />));
    await act(async () => fireEvent.press(playButton()));
    await act(async () => lastPlayer().emit('statusChange', { status: 'error', error: { message: 'x' } }));

    expect(screen.getByText('No se pudo cargar el video. Toca para reintentar.')).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('No se pudo cargar el video de la seña DOLOR');

    await act(async () => fireEvent.press(playButton()));
    expect(lastPlayer().replaceAsync).toHaveBeenCalledTimes(2);
    announce.mockRestore();
  });

  test('en una caja chica solo muestra la imagen fija con «con movimiento», sin reproductor', async () => {
    await render(wrap(<SignClip clip={DOLOR} label="DOLOR" size={72} />));
    expect(screen.getByRole('image', { name: 'Seña de DOLOR, con movimiento' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(__players).toHaveLength(0);
  });
});

describe('SignImage con clips', () => {
  const services = (clips) => ({
    signClips: {
      getCachedClips: async () => null,
      listClips: async () => ({ clips, source: 'remote' }),
    },
  });

  const renderWithClips = (ui, clips = [DOLOR]) =>
    render(
      <AppThemeProvider>
        <ServicesProvider services={services(clips)}>
          <SignClipsProvider>{ui}</SignClipsProvider>
        </ServicesProvider>
      </AppThemeProvider>,
    );

  test('usa el clip publicado de la seña, aunque la clave venga con mayúsculas', async () => {
    await renderWithClips(<SignImage signKey="Dolor" label="DOLOR" size={190} />);
    expect(await screen.findByRole('button', { name: 'Ver la seña DOLOR en movimiento' })).toBeTruthy();
  });

  test('una letra sin clip sigue mostrando su foto', async () => {
    await renderWithClips(<SignImage signKey="a" size={120} />);
    expect(await screen.findByRole('image', { name: 'Seña de A' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /en movimiento/ })).toBeNull();
  });
});
