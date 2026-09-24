import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import useReducedMotion from '../../../../core/a11y/useReducedMotion';
import { useAppTheme } from '../../../../shared/theme/ThemeProvider';

const PIECES = 42;

/**
 * Confeti liviano sin librerías: UN solo Animated.Value (0→1) y cada pieza
 * interpola su caída, deriva y giro con un desfase propio. Todo con native
 * driver, así no compite con el hilo JS. Se reproduce una vez y no bloquea
 * toques (pointerEvents none). Con "reducir movimiento" no se muestra.
 */
export default function Confetti({ run = true, duration = 2400 }) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;

  const pieces = useMemo(() => {
    const palette = [
      ...theme.gradients.celebration.colors,
      theme.colors.success,
      theme.colors.info,
      theme.colors.gold,
    ];
    return Array.from({ length: PIECES }).map((_, index) => {
      const delay = Math.random() * 0.35;
      return {
        key: index,
        left: Math.random() * width,
        size: 6 + Math.random() * 6,
        color: palette[index % palette.length],
        delay,
        drift: (Math.random() - 0.5) * 120,
        turns: 1 + Math.random() * 3,
        round: index % 3 === 0,
      };
    });
  }, [theme, width]);

  useEffect(() => {
    if (!run || reducedMotion) return undefined;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [run, reducedMotion, progress, duration]);

  if (!run || reducedMotion) return null;

  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((piece) => {
        const range = [piece.delay, 1];
        return (
          <Animated.View
            key={piece.key}
            style={{
              position: 'absolute',
              top: -20,
              left: piece.left,
              width: piece.size,
              height: piece.round ? piece.size : piece.size * 1.8,
              borderRadius: piece.round ? piece.size / 2 : 2,
              backgroundColor: piece.color,
              opacity: progress.interpolate({ inputRange: [0, piece.delay, 0.85, 1], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
              transform: [
                { translateY: progress.interpolate({ inputRange: range, outputRange: [0, height + 40], extrapolate: 'clamp' }) },
                { translateX: progress.interpolate({ inputRange: range, outputRange: [0, piece.drift], extrapolate: 'clamp' }) },
                {
                  rotate: progress.interpolate({
                    inputRange: range,
                    outputRange: ['0deg', `${piece.turns * 360}deg`],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            }}
          />
        );
      })}
    </Animated.View>
  );
}
