import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import useReducedMotion from '../../../../core/a11y/useReducedMotion';
import { AppText, Button } from '../../../../shared/ui';
import { useAppTheme } from '../../../../shared/theme/ThemeProvider';

/**
 * Panel de respuesta (acierto / error) — feedback MULTIMODAL:
 *  - visual: borde de color + icono grande (✓ / ↻) + título y mensaje; el
 *    halo luminoso lo pone la tarjeta del ejercicio (LevelSessionScreen)
 *  - háptico: lo dispara useLevelSession en la misma transición
 *  - lector de pantalla: región viva (accessibilityLiveRegion)
 *
 * Así nadie depende del audio (la app no usa sonido) ni solo del color.
 */
export default function FeedbackPanel({ feedback, onContinue }) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const appear = useRef(new Animated.Value(0)).current;
  const correct = feedback?.kind === 'correct';

  useEffect(() => {
    if (!feedback) return undefined;
    if (reducedMotion) {
      appear.setValue(1);
      return undefined;
    }
    appear.setValue(0);
    // Sin rebote: aparece decenas de veces por sesión y debe sentirse ágil.
    const animation = Animated.timing(appear, {
      toValue: 1,
      duration: theme.motion.duration.base,
      easing: theme.motion.easing.enter,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [feedback, reducedMotion, appear, theme]);

  if (!feedback) return null;
  const accent = correct ? theme.colors.success : theme.colors.danger;

  return (
    <Animated.View
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
      style={[
        styles.panel,
        { borderColor: accent, backgroundColor: correct ? theme.colors.successSoft : theme.colors.dangerSoft },
        {
          opacity: appear,
          transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: accent }]}>
          <Ionicons
            name={correct ? 'checkmark' : 'refresh'}
            size={24}
            color={correct ? theme.colors.onSuccess : theme.colors.onDanger}
          />
        </View>
        <View style={styles.texts}>
          <AppText variant="heading" tone={correct ? 'success' : 'danger'}>
            {correct ? '¡Correcto!' : 'Casi…'}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {feedback.message}
          </AppText>
        </View>
      </View>
      <Button
        label={correct ? 'Continuar' : 'Intentar de nuevo'}
        variant={correct ? 'success' : 'danger'}
        icon={correct ? 'arrow-forward' : 'refresh'}
        iconPosition="right"
        onPress={onContinue}
        haptic
      />
    </Animated.View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    panel: {
      gap: theme.spacing.md,
      padding: theme.spacing.md + 2,
      borderRadius: theme.radius.xl,
      borderWidth: 2,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    texts: { flex: 1, gap: 2 },
  });
}
