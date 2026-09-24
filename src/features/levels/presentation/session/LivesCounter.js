import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import useReducedMotion from '../../../../core/a11y/useReducedMotion';
import { animations } from '../../../../shared/ui';
import { useAppTheme } from '../../../../shared/theme/ThemeProvider';

/**
 * Vidas de la sesión. Al perder una:
 *  - el contenedor tiembla SUTILMENTE (amplitud 6px, decreciente)
 *  - el corazón perdido se desvanece y se encoge (no explota ni crece en rojo)
 *
 * La animación original era más agresiva (corazón que crecía al 180 % y
 * temblor de 12px); se suavizó para que un error no se sienta como castigo.
 * El lector de pantalla recibe "Vidas: 2 de 3".
 */
export default function LivesCounter({ lives, maxLives, lostIndex, mistakeTick }) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const shakeX = useRef(new Animated.Value(0)).current;
  const lostFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!mistakeTick) return;
    lostFade.setValue(1);
    const fade = Animated.timing(lostFade, {
      toValue: 0,
      duration: reducedMotion ? 150 : theme.motion.duration.emphasis,
      easing: theme.motion.easing.exit,
      useNativeDriver: true,
    });
    if (reducedMotion) {
      fade.start();
      return;
    }
    shakeX.setValue(0);
    Animated.parallel([animations.shake(shakeX, 6), fade]).start();
  }, [mistakeTick, reducedMotion, lostFade, shakeX, theme]);

  return (
    <Animated.View
      style={[styles.row, { transform: [{ translateX: shakeX }] }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Vidas: ${lives} de ${maxLives}`}
      accessibilityLiveRegion="polite"
    >
      {Array.from({ length: maxLives }).map((_, index) => {
        const filled = index < lives;
        const justLost = index === lostIndex;
        if (justLost) {
          return (
            <View key={index} style={styles.slot}>
              <Ionicons name="heart-outline" size={20} color={theme.colors.textMuted} style={StyleSheet.absoluteFill} />
              <Animated.View
                style={{
                  opacity: lostFade,
                  transform: [{ scale: lostFade.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
                }}
              >
                <Ionicons name="heart" size={20} color={theme.colors.danger} />
              </Animated.View>
            </View>
          );
        }
        return (
          <View key={index} style={styles.slot}>
            <Ionicons
              name={filled ? 'heart' : 'heart-outline'}
              size={20}
              color={filled ? theme.colors.danger : theme.colors.textMuted}
            />
          </View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  slot: { width: 20, height: 20 },
});
