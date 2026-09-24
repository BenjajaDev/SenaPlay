import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useReducedMotion from '../../../core/a11y/useReducedMotion';
import { useAppTheme } from '../../theme/ThemeProvider';
import { DIALOG_TONES } from './Dialog';

/**
 * Aviso no bloqueante (arriba de la pantalla). Para resultados que no
 * requieren decisión: "Cambios guardados", "Sin conexión, usando datos
 * locales". Se cierra solo o al tocarlo. El renderizado lo maneja
 * FeedbackProvider; las pantallas usan `useFeedback().notify(...)`.
 */
export default function Toast({ toast, onHide }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const appear = useRef(new Animated.Value(0)).current;
  const tone = DIALOG_TONES[toast?.tone] || DIALOG_TONES.info;
  const accent = theme.colors[tone.color];

  useEffect(() => {
    if (!toast) return undefined;
    appear.setValue(0);
    Animated.timing(appear, {
      toValue: 1,
      duration: reducedMotion ? 100 : theme.motion.duration.base,
      easing: theme.motion.easing.enter,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(appear, { toValue: 0, duration: theme.motion.duration.fast, useNativeDriver: true }).start(
        () => onHide?.(toast.id),
      );
    }, toast.duration || 2800);
    return () => clearTimeout(timer);
  }, [toast, appear, onHide, reducedMotion, theme]);

  if (!toast) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { top: insets.top + theme.spacing.sm },
        {
          opacity: appear,
          transform: [
            { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [reducedMotion ? 0 : -20, 0] }) },
          ],
        },
      ]}
    >
      <Pressable
        onPress={() => onHide?.(toast.id)}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={[toast.title, toast.message].filter(Boolean).join('. ')}
        style={[styles.toast, { borderLeftColor: accent }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: theme.colors[tone.soft] }]}>
          <Ionicons name={toast.icon || tone.icon} size={20} color={accent} />
        </View>
        <View style={styles.texts}>
          {toast.title ? <Text style={styles.title}>{toast.title}</Text> : null}
          {toast.message ? <Text style={styles.message}>{toast.message}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function createStyles(theme) {
  const { colors, spacing, radius, typography } = theme;
  return StyleSheet.create({
    wrapper: { position: 'absolute', left: spacing.lg, right: spacing.lg, zIndex: 1000, elevation: 20 },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      borderLeftWidth: 5,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      ...theme.elevation.md,
    },
    iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    texts: { flex: 1, gap: 2 },
    title: { ...typography.bodyStrong, fontSize: 14, color: colors.textPrimary },
    message: { ...typography.caption, color: colors.textSecondary },
  });
}
