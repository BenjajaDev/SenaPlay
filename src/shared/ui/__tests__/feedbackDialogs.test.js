import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppThemeProvider } from '../../theme/ThemeProvider';
import { FeedbackProvider, useFeedback } from '../feedback/FeedbackProvider';

// En el dispositivo, un Modal que se cierra sigue mostrando su contenido
// mientras se desvanece. El mock de Jest lo desmonta al instante; aquí se
// reemplaza por uno que, una vez abierto, sigue renderizando al cerrarse.
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react');
  function FadingModal({ visible, children }) {
    const shown = React.useRef(false);
    if (visible) shown.current = true;
    return shown.current ? React.createElement(React.Fragment, null, children) : null;
  }
  return { __esModule: true, default: FadingModal };
});

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function Trigger({ onResult }) {
  const { confirm } = useFeedback();
  return (
    <Pressable
      onPress={() => {
        // Sin devolver la promesa: fireEvent esperaría a que se responda el diálogo.
        confirm({ title: '¿Eliminar video?', message: 'No se puede deshacer.', tone: 'danger', confirmLabel: 'Eliminar' }).then(
          onResult,
        );
      }}
    >
      <Text>abrir</Text>
    </Pressable>
  );
}

describe('confirm() al cerrarse', () => {
  test('conserva título, mensaje y tono mientras se desvanece', async () => {
    const onResult = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <AppThemeProvider>
          <FeedbackProvider>
            <Trigger onResult={onResult} />
          </FeedbackProvider>
        </AppThemeProvider>
      </SafeAreaProvider>,
    );

    await fireEvent.press(screen.getByText('abrir'));
    await fireEvent.press(await screen.findByText('Cancelar'));
    expect(onResult).toHaveBeenCalledWith(false);

    expect(screen.getByText('¿Eliminar video?')).toBeTruthy();
    expect(screen.getByText('No se puede deshacer.')).toBeTruthy();
    expect(screen.getByText('Eliminar')).toBeTruthy();

    // Un toque durante el desvanecimiento no vuelve a resolver.
    await act(async () => fireEvent.press(screen.getByText('Eliminar')));
    expect(onResult).toHaveBeenCalledTimes(1);
  });
});
