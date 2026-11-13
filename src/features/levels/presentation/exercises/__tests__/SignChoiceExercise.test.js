import { fireEvent, render, screen } from '@testing-library/react-native';
import { ServicesProvider } from '../../../../../core/di/ServicesProvider';
import { AppThemeProvider } from '../../../../../shared/theme/ThemeProvider';
import { SignClipsProvider } from '../../../../signs/presentation/SignClipsProvider';
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

describe('SignChoiceExercise', () => {
  test('muestra la palabra y no revela las glosas de las señas', async () => {
    await renderExercise();
    expect(screen.getByText('PERRO')).toBeTruthy();
    expect(await screen.findAllByLabelText(/Ver la seña de la opción \d en movimiento/)).toHaveLength(3);
    expect(screen.queryByLabelText(/gato|casa/i)).toBeNull();
    expect(screen.queryByText(/gato|casa/i)).toBeNull();
  });

  test('tocar una tarjeta elige esa seña', async () => {
    const onAnswerChange = await renderExercise();
    await screen.findAllByLabelText(/Ver la seña de la opción/);
    fireEvent.press(screen.getByLabelText('Elegir la seña de la opción 2'));
    expect(onAnswerChange).toHaveBeenCalledWith('gato');
  });

  test('la seleccionada se indica con texto, no solo con color', async () => {
    await renderExercise({ answer: 'casa' });
    expect(await screen.findByText('Elegida: opción 3')).toBeTruthy();
  });

  test('sin autoplay: no se anuncia ni se carga ningún video al montar', async () => {
    await renderExercise();
    await screen.findAllByLabelText(/Ver la seña de la opción/);
    expect(screen.queryByLabelText(/Detener/)).toBeNull();
  });
});
