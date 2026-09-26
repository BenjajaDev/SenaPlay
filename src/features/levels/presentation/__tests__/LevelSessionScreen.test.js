import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppThemeProvider } from '../../../../shared/theme/ThemeProvider';
import { FeedbackProvider } from '../../../../shared/ui';
import LevelBuilder from '../../domain/LevelBuilder';
import LevelSessionScreen from '../LevelSessionScreen';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const level = new LevelBuilder(1)
  .title('Letras de prueba')
  .addExercise({ type: 'multiple-choice', title: '¿Qué letra es?', sign: 'b', options: ['A', 'B'], correct: 'B', hint: 'Dedos juntos hacia arriba' })
  .addExercise({ type: 'true-false', title: 'Afirmación', statement: 'La A es un puño', answer: true })
  .build();

async function setup(props = {}) {
  const handlers = { onComplete: jest.fn(), onLifeLost: jest.fn(), onMistake: jest.fn(), onBack: jest.fn() };
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppThemeProvider>
        <FeedbackProvider>
          <LevelSessionScreen level={level} startingLives={3} {...handlers} {...props} />
        </FeedbackProvider>
      </AppThemeProvider>
    </SafeAreaProvider>,
  );
  return handlers;
}

describe('LevelSessionScreen', () => {
  test('juega un nivel completo: incompleto, error, pista, acierto y celebración', async () => {
    const { onComplete, onLifeLost, onMistake } = await setup();

    // Verificar sin responder: aviso, sin perder vida.
    await fireEvent.press(screen.getByText('Verificar'));
    expect(await screen.findByText('Elige una opción para responder.')).toBeTruthy();
    expect(screen.getByLabelText('Vidas: 3 de 3')).toBeTruthy();

    // Pista desde la ampolleta flotante.
    await fireEvent.press(screen.getByLabelText('Ver pista'));
    expect(await screen.findByText('Dedos juntos hacia arriba')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Cerrar pista'));

    // Error: pierde vida y puede reintentar.
    await fireEvent.press(screen.getByText('A'));
    await fireEvent.press(screen.getByText('Verificar'));
    expect(await screen.findByText('Intentar de nuevo')).toBeTruthy();
    expect(onLifeLost).toHaveBeenCalledTimes(1);
    // El error se informa con el ejercicio y la respuesta dada (métrica de errores).
    expect(onMistake).toHaveBeenCalledWith(
      expect.objectContaining({ answer: 'A', gameOver: false, exercise: expect.objectContaining({ sign: 'b' }) }),
    );
    expect(screen.getByLabelText('Vidas: 2 de 3')).toBeTruthy();
    await fireEvent.press(screen.getByText('Intentar de nuevo'));

    // Acierto y avance.
    await fireEvent.press(screen.getByText('B'));
    await fireEvent.press(screen.getByText('Verificar'));
    await fireEvent.press(await screen.findByText('Continuar'));

    await fireEvent.press(await screen.findByText('Verdadero'));
    await fireEvent.press(screen.getByText('Verificar'));
    await fireEvent.press(await screen.findByText('Continuar'));

    expect(await screen.findByText('¡Nivel completado!')).toBeTruthy();
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ levelId: 1, hits: 2, fails: 1, lives: 2, hintsUsed: 1, total: 2 }),
    );
  });

  test('salir a mitad de nivel pide confirmación', async () => {
    const { onBack } = await setup();
    await fireEvent.press(screen.getByText('A'));
    await fireEvent.press(screen.getByLabelText('Salir del nivel'));
    expect(await screen.findByText('¿Salir del nivel?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Seguir practicando'));
    await waitFor(() => expect(onBack).not.toHaveBeenCalled());

    await fireEvent.press(screen.getByLabelText('Salir del nivel'));
    await fireEvent.press(await screen.findByText('Salir'));
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  });

  test('sin vidas muestra un mensaje no punitivo y permite reintentar', async () => {
    await setup({ startingLives: 1 });
    await fireEvent.press(screen.getByText('A'));
    await act(async () => {
      await fireEvent.press(screen.getByText('Verificar'));
    });
    expect(await screen.findByText('¡Casi lo logras!')).toBeTruthy();
    await fireEvent.press(screen.getByText('Intentar de nuevo'));
    await waitFor(() => expect(screen.getByLabelText('Vidas: 1 de 1')).toBeTruthy());
  });
});
