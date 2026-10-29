import { act, render, screen } from '@testing-library/react-native';
import { AppThemeProvider } from '../../../../shared/theme/ThemeProvider';
import SignImage from '../SignImage';

const wrap = (ui) => <AppThemeProvider>{ui}</AppThemeProvider>;

// El lector de pantalla envía la acción directo a la vista (fireEvent la
// descarta porque la seña no toma toques de inicio: solo arrastres).
const accessibilityAction = (element, actionName) =>
  act(async () => element.props.onAccessibilityAction({ nativeEvent: { actionName } }));

describe('SignImage · variaciones', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('sin botones: la seña es un control ajustable con su variación actual', async () => {
    await render(wrap(<SignImage signKey="t" size={120} />));
    const sign = screen.getByRole('adjustable', { name: 'Seña de T' });
    expect(sign.props.accessibilityValue).toEqual({ text: 'Variación 1 de 2' });
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('las acciones accesibles avanzan y retroceden con vuelta circular', async () => {
    await render(wrap(<SignImage signKey="t" size={120} />));
    const sign = () => screen.getByRole('adjustable', { name: 'Seña de T' });

    await accessibilityAction(sign(), 'increment');
    await act(async () => jest.advanceTimersByTimeAsync(600));
    expect(sign().props.accessibilityValue).toEqual({ text: 'Variación 2 de 2' });

    await accessibilityAction(sign(), 'increment');
    await act(async () => jest.advanceTimersByTimeAsync(600));
    expect(sign().props.accessibilityValue).toEqual({ text: 'Variación 1 de 2' });

    await accessibilityAction(sign(), 'decrement');
    await act(async () => jest.advanceTimersByTimeAsync(600));
    expect(sign().props.accessibilityValue).toEqual({ text: 'Variación 2 de 2' });
  });

  test('una seña con una sola foto es una imagen simple, sin gesto', async () => {
    await render(wrap(<SignImage signKey="a" size={120} />));
    const sign = screen.getByRole('image', { name: 'Seña de A' });
    expect(sign.props.onMoveShouldSetResponder).toBeUndefined();
  });
});
