import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Text } from 'react-native';
import FadeInView from '../../shared/ui/motion/FadeInView';
import useReducedMotion, { primeReducedMotion } from '../a11y/useReducedMotion';

// El módulo guarda el valor global: cada archivo de Jest parte con uno nuevo.
let systemListener = null;
jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((event, listener) => {
  systemListener = listener;
  return { remove: jest.fn() };
});

function Probe() {
  return <Text>{useReducedMotion() ? 'reducido' : 'normal'}</Text>;
}

describe('useReducedMotion (valor global)', () => {
  beforeAll(async () => {
    await primeReducedMotion();
  });

  test('tras cebarlo, el primer render ya trae el valor del sistema', async () => {
    await render(<Probe />);
    expect(screen.getByText('reducido')).toBeTruthy();
  });

  test('un solo listener del sistema y los cambios llegan a todos', async () => {
    await render(
      <>
        <Probe />
        <Probe />
      </>,
    );
    expect(AccessibilityInfo.addEventListener).toHaveBeenCalledTimes(1);
    await act(async () => systemListener(false));
    expect(screen.getAllByText('normal')).toHaveLength(2);
    await act(async () => systemListener(true));
  });

  test('FadeInView respeta el ajuste desde el montaje: fade corto, sin delay', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(
      <FadeInView delay={300} duration={220}>
        <Text>contenido</Text>
      </FadeInView>,
    );
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 120, delay: 0 }));
    timing.mockRestore();
  });
});
