import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import useReducedMotion from '../../core/a11y/useReducedMotion';
import { useAppTheme } from '../theme/ThemeProvider';

/**
 * Barra de progreso con degradé. El relleno ocupa todo el ancho y se
 * desplaza con `translateX` (native driver): 0 % = fuera por la izquierda,
 * 100 % = en su lugar. Antes se usaba `scaleX` + `transformOrigin`, que el
 * native driver de Android no respeta y la barra no mostraba el avance.
 *
 * `value` va de 0 a 1. `gradient` permite otra intención (ej. 'reward').
 */
export default function ProgressBar({ value = 0, height = 10, gradient = 'brandVivid', label, style }) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme, height), [theme, height]);
  const clamped = Math.max(0, Math.min(1, Number(value) || 0));
  const progress = useRef(new Animated.Value(clamped)).current;
  const [width, setWidth] = useState(0);
  const translateX = useMemo(
    () => progress.interpolate({ inputRange: [0, 1], outputRange: [-width, 0], extrapolate: 'clamp' }),
    [progress, width],
  );

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(clamped);
      return undefined;
    }
    const animation = Animated.timing(progress, {
      toValue: clamped,
      duration: theme.motion.duration.emphasis,
      easing: theme.motion.easing.enter,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [clamped, reducedMotion, progress, theme]);

  return (
    <View
      style={[styles.track, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {/* Hasta medir el ancho no se pinta el relleno (evita un parpadeo al 100 %). */}
      <Animated.View style={[styles.fillWrap, { opacity: width ? 1 : 0, transform: [{ translateX }] }]}>
        <LinearGradient {...(theme.gradients[gradient] || theme.gradients.brandVivid)} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

function createStyles(theme, height) {
  return StyleSheet.create({
    track: {
      height,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primarySoft,
      overflow: 'hidden',
    },
    fillWrap: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: theme.radius.pill,
      overflow: 'hidden',
    },
  });
}
