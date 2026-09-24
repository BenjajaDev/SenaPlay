import { useEffect, useMemo, useRef } from 'react';
import { Animated, Modal, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../theme/ThemeProvider';
import Spinner from '../loading/Spinner';

/**
 * Modal de bloqueo para operaciones async de red o persistencia (iniciar
 * sesión, guardar perfil, completar nivel). Bloquea toques para evitar
 * dobles envíos y dice explícitamente qué está pasando: un spinner sin
 * contexto se siente como que la app se colgó.
 *
 * Normalmente se usa vía `useFeedback().runBlocking(label, tarea)`.
 */
export default function BlockingOverlay({ visible, label = 'Cargando…' }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.9);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: theme.motion.duration.base,
        easing: theme.motion.easing.pop,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, { toValue: 1, duration: theme.motion.duration.fast, useNativeDriver: true }),
    ]).start();
  }, [visible, scale, opacity, theme]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.backdrop} accessibilityViewIsModal>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <Spinner label={label} />
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.overlay,
    },
    card: {
      minWidth: 180,
      maxWidth: 280,
      alignItems: 'center',
      paddingVertical: theme.spacing.xxl + 2,
      paddingHorizontal: theme.spacing.xxl + 4,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.surfaceRaised,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.elevation.lg,
    },
  });
}
