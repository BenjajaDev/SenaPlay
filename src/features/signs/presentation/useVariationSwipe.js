import { useLayoutEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder } from 'react-native';
import useReducedMotion from '../../../core/a11y/useReducedMotion';
import haptics from '../../../core/feedback/haptics';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';

// Arrastre mínimo (fracción del ancho) o velocidad (px/ms) para cambiar de
// variación al soltar; por debajo, la imagen vuelve a su lugar.
const COMMIT_RATIO = 0.22;
const COMMIT_VELOCITY = 0.3;
// Movimiento horizontal mínimo antes de tomar el gesto: un toque o un scroll
// vertical siguen llegando al contenedor (tarjeta, lista, casilla de juego).
const CAPTURE_DISTANCE = 8;
// La variación nueva entra desde media caja del lado contrario.
const ENTRY_OFFSET = 0.5;

/**
 * Carrusel de variaciones de una seña manejado con el dedo (sin botones).
 * La imagen sigue al dedo en horizontal y, al soltar, pasa a la siguiente o
 * anterior (con vuelta circular) o vuelve con un resorte. Nada se mueve solo:
 * todo lo dispara la persona.
 *
 *   index, count, width        estado del carrusel y ancho de la caja
 *   onIndexChange(next)        cambia la variación mostrada
 *
 * Devuelve { translateX, panHandlers, step(+1 | -1) }. `step` sirve para las
 * acciones accesibles (deslizar arriba/abajo con el lector de pantalla).
 * Con «reducir movimiento» el dedo se sigue igual (manipulación directa),
 * pero el cambio es inmediato, sin deslizamiento de entrada ni salida.
 */
export default function useVariationSwipe({ index, count, width, onIndexChange }) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const translateX = useRef(new Animated.Value(0)).current;
  const animationRef = useRef(null);
  const enteringFrom = useRef(0);

  // El PanResponder se crea una vez: lee siempre los valores actuales.
  const latest = useRef({});
  latest.current = { index, count, width, onIndexChange, reducedMotion, motion: theme.motion };

  const run = (animation, onDone) => {
    animationRef.current?.stop();
    animationRef.current = animation;
    animation.start(({ finished }) => {
      if (finished) onDone?.();
    });
  };

  const commit = (direction) => {
    const { index: current, count: total, width: boxWidth, reducedMotion: reduced, motion } = latest.current;
    const next = (current + direction + total) % total;
    haptics.selection();
    if (reduced) {
      animationRef.current?.stop();
      translateX.setValue(0);
      latest.current.onIndexChange(next);
      return;
    }
    run(
      Animated.timing(translateX, {
        toValue: -direction * boxWidth,
        duration: motion.duration.fast,
        easing: motion.easing.enter,
        useNativeDriver: true,
      }),
      () => {
        enteringFrom.current = direction;
        latest.current.onIndexChange(next);
      },
    );
  };

  const settle = () => {
    const { reducedMotion: reduced, motion } = latest.current;
    if (reduced) {
      translateX.setValue(0);
      return;
    }
    run(Animated.spring(translateX, { toValue: 0, useNativeDriver: true, ...motion.spring.press }));
  };

  // La variación nueva entra recién cuando ya está renderizada (antes del
  // pintado), así nunca se ve la imagen anterior en la posición de entrada.
  useLayoutEffect(() => {
    const direction = enteringFrom.current;
    if (!direction) return;
    enteringFrom.current = 0;
    const { width: boxWidth, motion } = latest.current;
    translateX.setValue(direction * boxWidth * ENTRY_OFFSET);
    run(
      Animated.timing(translateX, {
        toValue: 0,
        duration: motion.duration.base,
        easing: motion.easing.enter,
        useNativeDriver: true,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          latest.current.count > 1 &&
          Math.abs(gesture.dx) > CAPTURE_DISTANCE &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderGrant: () => animationRef.current?.stop(),
        onPanResponderMove: (_, gesture) => translateX.setValue(gesture.dx),
        // Una vez tomado, el gesto no se cede al scroll de la lista.
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, gesture) => {
          const far = Math.abs(gesture.dx) > latest.current.width * COMMIT_RATIO;
          const fast = Math.abs(gesture.vx) > COMMIT_VELOCITY;
          if (far || fast) commit(gesture.dx < 0 ? 1 : -1);
          else settle();
        },
        onPanResponderTerminate: settle,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { translateX, panHandlers: responder.panHandlers, step: commit };
}
