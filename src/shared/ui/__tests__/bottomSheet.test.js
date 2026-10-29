import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppThemeProvider } from '../../theme/ThemeProvider';
import BottomSheet from '../feedback/BottomSheet';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function tree(visible, onClose = jest.fn()) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <AppThemeProvider>
        <BottomSheet visible={visible} title="Editar perfil" onClose={onClose}>
          <Text>formulario</Text>
        </BottomSheet>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

describe('BottomSheet', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('al cerrarse sigue en pantalla mientras baja y luego se desmonta', async () => {
    const { rerender } = await render(tree(true));
    expect(screen.getByText('formulario')).toBeTruthy();

    await rerender(tree(false));
    expect(screen.getByText('formulario')).toBeTruthy();

    await act(async () => jest.advanceTimersByTimeAsync(1000));
    expect(screen.queryByText('formulario')).toBeNull();
  });

  test('el fondo es un botón accesible que cierra la hoja', async () => {
    const onClose = jest.fn();
    await render(tree(true, onClose));
    await fireEvent.press(screen.getAllByRole('button', { name: 'Cerrar' })[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
