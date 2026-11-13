import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react-native';
import { __players } from 'expo-video';
import useReducedMotion from '../../../../../core/a11y/useReducedMotion';
import { ServicesProvider } from '../../../../../core/di/ServicesProvider';
import { AppThemeProvider } from '../../../../../shared/theme/ThemeProvider';
import { SignClipsProvider } from '../../../../signs/presentation/SignClipsProvider';
import { resetSlowMotionForTests } from '../../../../signs/presentation/useSlowMotion';
import SignImage from '../../../../signs/presentation/SignImage';
import SignChoiceExercise from '../SignChoiceExercise';

jest.mock('../../../../../core/a11y/useReducedMotion', () => ({
  __esModule: true,
  default: jest.fn(() => false),
  primeReducedMotion: jest.fn(),
}));

const clip = (key) => ({
  id: `c-${key}`,
  signKey: key,
  gloss: key.toUpperCase(),
  variant: 1,
  region: 'general',
  videoUrl: `https://storage.test/${key}.mp4`,
  posterUrl: `https://storage.test/${key}.webp`,
  durationMs: 2000,
});

const exercise = { type: 'sign-choice', word: 'perro', signs: ['perro', 'gato', 'casa'] };

const renderExercise = async (props = {}) => {
  const onAnswerChange = jest.fn();
  const services = {
    signClips: { getCachedClips: async () => null, listClips: async () => ({ clips: exercise.signs.map(clip), source: 'remote' }) },
  };
  await render(
    <AppThemeProvider>
      <ServicesProvider services={services}>
        <SignClipsProvider>
          <SignChoiceExercise exercise={exercise} answer={null} onAnswerChange={onAnswerChange} disabled={false} {...props} />
        </SignClipsProvider>
      </ServicesProvider>
    </AppThemeProvider>,
  );
  return onAnswerChange;
};

const playButtons = () => screen.findAllByRole('button', { name: /Ver la seña de la opción \d en movimiento/ });

beforeEach(() => {
  __players.length = 0;
  resetSlowMotionForTests();
  useReducedMotion.mockReturnValue(false);
});

describe('SignChoiceExercise', () => {
  test('muestra la palabra y no revela las glosas de las señas', async () => {
    await renderExercise();
    expect(screen.getByText('PERRO')).toBeTruthy();
    expect(await playButtons()).toHaveLength(3);
    expect(screen.queryByLabelText(/gato|casa/i)).toBeNull();
    expect(screen.queryByText(/gato|casa/i)).toBeNull();
  });

  test('la tarjeta completa es la opción: tocarla elige esa seña', async () => {
    const onAnswerChange = await renderExercise();
    await playButtons();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    fireEvent.press(screen.getByRole('radio', { name: 'Opción 2' }));
    expect(onAnswerChange).toHaveBeenCalledWith('gato');
  });

  test('la elegida se indica con ✓, texto accesible y estado, no solo con color', async () => {
    await renderExercise({ answer: 'casa' });
    await playButtons();
    const chosen = screen.getByRole('radio', { name: 'Opción 3' });
    expect(chosen.props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
    expect(screen.getByRole('radio', { name: 'Opción 1' }).props.accessibilityState).toEqual(expect.objectContaining({ checked: false }));
    // La franja de cada tarjeta dice qué hacer y cuál está elegida, con texto visible.
    expect(screen.getAllByText('Elegir')).toHaveLength(2);
    expect(screen.getAllByText('Elegida')).toHaveLength(1);
  });

  test('el ▶ es un control hermano de la tarjeta: se alcanza aparte y no elige', async () => {
    const onAnswerChange = await renderExercise();
    const [first] = await playButtons();
    // Ninguna tarjeta (radio) contiene al ▶: no hay botón anidado dentro de otro.
    screen.getAllByRole('radio').forEach((radio) => {
      expect(within(radio).queryByRole('button', { name: /Ver la seña de la opción/ })).toBeNull();
    });
    await act(async () => fireEvent.press(first));
    expect(__players[0].play).toHaveBeenCalledTimes(1);
    expect(onAnswerChange).not.toHaveBeenCalled();
  });

  test('mientras corre no hay botón sobre la seña: tocar el video lo detiene sin elegir', async () => {
    const onAnswerChange = await renderExercise();
    const [first] = await playButtons();
    await act(async () => fireEvent.press(first));
    // Sin ▶/■ en la esquina mientras corre: el video completo es el «Detener».
    expect(screen.queryByRole('button', { name: 'Ver la seña de la opción 1 en movimiento' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /Detener/ })).toHaveLength(1);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Detener la seña de la opción 1' })));
    expect(__players[0].pause).toHaveBeenCalled();
    expect(onAnswerChange).not.toHaveBeenCalled();

    // Detenido, vuelve el ▶ y la tarjeta sigue eligiendo.
    expect(screen.getByRole('button', { name: 'Ver la seña de la opción 1 en movimiento' })).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: 'Opción 1' }));
    expect(onAnswerChange).toHaveBeenCalledWith('perro');
  });

  test('un solo video a la vez: reproducir otro detiene el anterior', async () => {
    await renderExercise();
    const [first, second] = await playButtons();
    await act(async () => fireEvent.press(first));
    expect(screen.getByRole('button', { name: 'Detener la seña de la opción 1' })).toBeTruthy();
    await act(async () => fireEvent.press(second));
    expect(screen.queryByRole('button', { name: 'Detener la seña de la opción 1' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Detener la seña de la opción 2' })).toBeTruthy();
    expect(__players[0].pause).toHaveBeenCalled();
  });

  test('etiquetas accesibles: grupo de opciones y radio sin «elegida»', async () => {
    await renderExercise({ answer: 'gato' });
    await playButtons();
    expect(screen.getByLabelText('Señas posibles para perro')).toBeTruthy();
    expect(screen.queryByLabelText(/elegida/i)).toBeNull();
    expect(screen.getByRole('radio', { name: 'Opción 2' }).props.accessibilityState.checked).toBe(true);
  });

  test('«Lento» y «Repetir» son interruptores con estado checked', async () => {
    await renderExercise();
    await playButtons();
    const before = screen.getByRole('switch', { name: 'Lento' }).props.accessibilityState.checked;
    await act(async () => fireEvent.press(screen.getByRole('switch', { name: 'Lento' })));
    expect(screen.getByRole('switch', { name: 'Lento' }).props.accessibilityState.checked).toBe(!before);
    // «Lento» es preferencia persistida: se deja como estaba para no contaminar otras pruebas.
    await act(async () => fireEvent.press(screen.getByRole('switch', { name: 'Lento' })));
  });

  test('«Lento» y «Repetir» son una sola barra para todos los videos', async () => {
    await renderExercise();
    await playButtons();
    expect(screen.getAllByRole('switch', { name: 'Lento' })).toHaveLength(1);
    expect(screen.getAllByRole('switch', { name: 'Repetir' })).toHaveLength(1);

    await act(async () => fireEvent.press(screen.getByRole('switch', { name: 'Repetir' })));
    await act(async () => fireEvent.press(screen.getByRole('switch', { name: 'Lento' })));
    expect(__players.map((player) => player.loop)).toEqual([true, true, true]);
    expect(__players.map((player) => player.playbackRate)).toEqual([0.5, 0.5, 0.5]);
  });

  test('con «reducir movimiento» no se ofrece «Repetir» (y el bucle no se aplica)', async () => {
    useReducedMotion.mockReturnValue(true);
    await renderExercise();
    await playButtons();
    expect(screen.queryByRole('switch', { name: 'Repetir' })).toBeNull();
    expect(screen.getByRole('switch', { name: 'Lento' })).toBeTruthy();
    expect(__players.every((player) => player.loop === false)).toBe(true);
  });

  test('sin autoplay: no se carga ningún video al montar', async () => {
    await renderExercise();
    await playButtons();
    expect(screen.queryByRole('button', { name: /Detener/ })).toBeNull();
    expect(__players.every((player) => player.play.mock.calls.length === 0)).toBe(true);
  });

  test('deshabilitado: tocar la tarjeta no elige', async () => {
    const onAnswerChange = await renderExercise({ disabled: true });
    await playButtons();
    fireEvent.press(screen.getByRole('radio', { name: 'Opción 1' }));
    expect(onAnswerChange).not.toHaveBeenCalled();
  });

  test('«Repetir» arranca apagado al montar otro ejercicio (no se arrastra)', async () => {
    await renderExercise();
    await playButtons();
    await act(async () => fireEvent.press(screen.getByRole('switch', { name: 'Repetir' })));
    expect(__players.every((player) => player.loop === true)).toBe(true);
    await cleanup();
    __players.length = 0;
    await renderExercise();
    await playButtons();
    expect(__players.every((player) => player.loop === false)).toBe(true);
  });

  test('un video suelto (SignImage) lleva una sola fila Lento/Repetir y Repetir llega a su reproductor', async () => {
    const services = { signClips: { getCachedClips: async () => null, listClips: async () => ({ clips: [clip('perro')], source: 'remote' }) } };
    await render(
      <AppThemeProvider>
        <ServicesProvider services={services}>
          <SignClipsProvider>
            <SignImage signKey="perro" size={240} accessibilityName="Seña a interpretar" />
          </SignClipsProvider>
        </ServicesProvider>
      </AppThemeProvider>,
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));
    expect(screen.getAllByRole('switch', { name: 'Lento' })).toHaveLength(1);
    await act(async () => fireEvent.press(screen.getByRole('switch', { name: 'Repetir' })));
    expect(__players[0].loop).toBe(true);
    expect(screen.queryByLabelText(/perro/i)).toBeNull();
  });
});
