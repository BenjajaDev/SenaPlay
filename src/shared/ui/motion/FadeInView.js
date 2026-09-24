import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import useReducedMotion from '../../../core/a11y/useReducedMotion';

/**
 * Entrada sutil (fade + slide chico) para lo que envuelve. Se re-dispara
 * cada vez que el componente se vuelve a MONTAR — por eso quien lo use debe
 * pasar una `key` que cambie con lo que se está mostrando (ej: la pestaña
 * activa), no basta con re-renderizar con las mismas props.
 *
 * `delay` permite escalonar varios bloques (ver StaggerItem). Con "reducir
 * movimiento" activo solo hace un fade corto, sin desplazamiento.
 */
export default function FadeInView({ children, style, duration = 220, distance = 10, delay = 0 }) {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: reducedMotion ? 120 : duration,
      delay: reducedMotion ? 0 : delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const offset = reducedMotion ? 0 : distance;

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [offset, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
