import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppThemeProvider } from '../../theme/ThemeProvider';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  FeedbackProvider,
  IconButton,
  ProgressBar,
  ScreenHeader,
  SectionHeader,
  SkeletonList,
  Spinner,
  StatCard,
  TextField,
  useFeedback,
} from '..';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function wrap(ui) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <AppThemeProvider>
        <FeedbackProvider>{ui}</FeedbackProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

describe('sistema de diseño', () => {
  test('renderiza los componentes base sin errores', async () => {
    await render(
      wrap(
        <>
          <SectionHeader title="Niveles" subtitle="Sub" />
          <ScreenHeader title="Quiz" onBack={() => {}} />
          <Button label="Primario" onPress={() => {}} />
          <Button label="Peligro" variant="danger" onPress={() => {}} />
          <IconButton icon="bulb" label="Pista" onPress={() => {}} variant="surface" />
          <Card>
            <Text>Contenido</Text>
          </Card>
          <Card variant="brand" onPress={() => {}} accessibilityLabel="Tarjeta">
            <Text>Brand</Text>
          </Card>
          <TextField label="Correo" value="" onChangeText={() => {}} error="Requerido" />
          <Chip label="A-M" selected />
          <StatCard label="Racha" value="3" tone="gold" />
          <ProgressBar value={0.4} label="Progreso" />
          <Spinner label="Cargando" />
          <SkeletonList count={2} />
          <EmptyState title="Sin resultados" />
        </>,
      ),
    );
    expect(screen.getByText('Niveles')).toBeTruthy();
    expect(screen.getByLabelText('Pista')).toBeTruthy();
    expect(screen.getByText('Requerido')).toBeTruthy();
  });

  test('Button no dispara onPress cuando está cargando', async () => {
    const onPress = jest.fn();
    await render(wrap(<Button label="Guardar" onPress={onPress} loading />));
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  test('confirm() resuelve true al confirmar y false al cancelar', async () => {
    const results = [];
    function Probe() {
      const { confirm } = useFeedback();
      return (
        <Button
          label="Abrir"
          onPress={async () => {
            results.push(await confirm({ title: '¿Cerrar sesión?', confirmLabel: 'Sí, salir' }));
          }}
        />
      );
    }
    await render(wrap(<Probe />));

    await fireEvent.press(screen.getByText('Abrir'));
    await fireEvent.press(await screen.findByText('Sí, salir'));
    await waitFor(() => expect(results).toEqual([true]));

    await fireEvent.press(screen.getByText('Abrir'));
    await fireEvent.press(await screen.findByText('Cancelar'));
    await waitFor(() => expect(results).toEqual([true, false]));
  });

  test('confirm() con onConfirm ejecuta la acción antes de resolver', async () => {
    const action = jest.fn(() => Promise.resolve());
    let resolved = null;
    function Probe() {
      const { confirm } = useFeedback();
      return (
        <Button
          label="Eliminar"
          onPress={async () => {
            resolved = await confirm({ title: '¿Eliminar?', tone: 'danger', confirmLabel: 'Eliminar ya', onConfirm: action });
          }}
        />
      );
    }
    await render(wrap(<Probe />));
    await fireEvent.press(screen.getByText('Eliminar'));
    await fireEvent.press(await screen.findByText('Eliminar ya'));
    await waitFor(() => expect(resolved).toBe(true));
    expect(action).toHaveBeenCalledTimes(1);
  });

  test('runBlocking devuelve el resultado de la tarea', async () => {
    jest.useFakeTimers();
    let result;
    function Probe() {
      const { runBlocking } = useFeedback();
      return (
        <Button
          label="Guardar"
          onPress={async () => {
            result = await runBlocking('Guardando…', async () => 42);
          }}
        />
      );
    }
    await render(wrap(<Probe />));
    await fireEvent.press(screen.getByText('Guardar'));
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    jest.useRealTimers();
    await waitFor(() => expect(result).toBe(42));
  });
});
