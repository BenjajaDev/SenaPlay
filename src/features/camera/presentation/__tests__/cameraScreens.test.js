import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppThemeProvider } from '../../../../shared/theme/ThemeProvider';
import CameraTranslationScreen from '../CameraTranslationScreen';
import DynamicSignMonitorScreen from '../DynamicSignMonitorScreen';
import SignPracticeScreen from '../SignPracticeScreen';
import SpellingGameScreen from '../SpellingGameScreen';

// Sin dispositivo: el permiso de cámara llega concedido y el visor es una vista.
jest.mock('expo-camera', () => ({
  useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
}));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 740 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } };

async function renderScreen(Screen) {
  const onBack = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppThemeProvider>
        <Screen onBack={onBack} />
      </AppThemeProvider>
    </SafeAreaProvider>,
  );
  return onBack;
}

describe.each([
  ['Práctica de señas', SignPracticeScreen],
  ['Traducción en vivo', CameraTranslationScreen],
  ['Señas dinámicas (beta)', DynamicSignMonitorScreen],
  ['Deletreo', SpellingGameScreen],
])('%s', (title, Screen) => {
  test('cabecera con título y botón de salir accesible', async () => {
    const onBack = await renderScreen(Screen);
    expect(screen.getByRole('header', { name: title })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Salir' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('controles de cámara', () => {
  test('traducción: botones con nombre y texto completo', async () => {
    await renderScreen(CameraTranslationScreen);
    ['Pausar traducción', 'Agregar espacio', 'Borrar la última letra', 'Limpiar el texto'].forEach((name) =>
      expect(screen.getByRole('button', { name })).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Pausar traducción' }));
    expect(screen.getByRole('button', { name: 'Reanudar traducción' })).toBeTruthy();
  });

  test('práctica: los modos son pestañas con estado y la navegación tiene nombre', async () => {
    await renderScreen(SignPracticeScreen);
    expect(screen.getByRole('tab', { name: 'Modo Libre', selected: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Modo Práctica guiada' }));
    expect(screen.getByRole('tab', { name: 'Modo Práctica guiada', selected: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Seña anterior' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Seña siguiente' })).toBeTruthy();
  });

  test('deletreo: la guía de la letra y el reinicio están en pantalla', async () => {
    await renderScreen(SpellingGameScreen);
    expect(screen.getByText('Haz esta seña')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reiniciar palabra' })).toBeTruthy();
  });
});
