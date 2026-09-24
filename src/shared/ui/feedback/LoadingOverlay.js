import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { APP_FONTS } from '../../theme/fonts';
import { useAppTheme } from '../../theme/ThemeProvider';

/**
 * Overlay de carga reutilizable para operaciones async con feedback visible
 * (iniciar sesión, guardar un ajuste, completar un nivel). Un simple
 * ActivityIndicator sin contexto se siente como que la app se colgó; esto
 * dice explícitamente qué está pasando y hace un pop-in sutil al aparecer.
 *
 * Props:
 *   visible  controla el Modal
 *   label    texto bajo el spinner (ej: "Guardando cambios...")
 */
export default function LoadingOverlay({ visible, label = 'Cargando...' }) {
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
        duration: 220,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, scale, opacity]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          {label ? <Text style={styles.label}>{label}</Text> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(theme) {
  const isDark = theme.mode === 'dark';
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.overlay,
    },
    card: {
      minWidth: 160,
      alignItems: 'center',
      gap: 12,
      paddingVertical: 26,
      paddingHorizontal: 28,
      borderRadius: 20,
      backgroundColor: isDark ? '#221C35' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? '#4B3B73' : theme.colors.border,
    },
    label: {
      fontFamily: APP_FONTS.semiBold,
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });
}
