import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import useReducedMotion from '../../core/a11y/useReducedMotion';
import { useAppTheme } from '../theme/ThemeProvider';

/**
 * Barra de progreso con degradé. Anima con `scaleX` (native driver) en vez
 * de `width`, para no recalcular layout en cada frame.
 *
 * `value` va de 0 a 1. `gradient` permite otra intención (ej. 'reward').
 */
export default function ProgressBar({ value = 0, height = 10, gradient = 'brandVivid', label, style }) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme, height), [theme, height]);
  const clamped = Math.max(0, Math.min(1, Number(value) || 0));
  const progress = useRef(new Animated.Value(clamped)).current;

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
    >
      <Animated.View style={[styles.fillWrap, { transform: [{ scaleX: progress }] }]}>
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
      transformOrigin: 'left',
      borderRadius: theme.radius.pill,
      overflow: 'hidden',
    },
  });
}
