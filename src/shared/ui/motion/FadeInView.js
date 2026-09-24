import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Entrada sutil (fade + slide chico) para lo que envuelve. Se re-dispara
 * cada vez que el componente se vuelve a MONTAR — por eso quien lo use debe
 * pasar una `key` que cambie con lo que se está mostrando (ej: la pestaña
 * activa), no basta con re-renderizar con las mismas props.
 */
export default function FadeInView({ children, style, duration = 200, distance = 10 }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }).start();
  }, []);

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
                outputRange: [distance, 0],
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
