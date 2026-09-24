import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import useReducedMotion from '../../../core/a11y/useReducedMotion';
import { useAppTheme } from '../../theme/ThemeProvider';

export const DIALOG_TONES = {
  info: { icon: 'information-circle', color: 'info', soft: 'infoSoft' },
  success: { icon: 'checkmark-circle', color: 'success', soft: 'successSoft' },
  warning: { icon: 'alert-circle', color: 'warning', soft: 'warningSoft' },
  danger: { icon: 'warning', color: 'danger', soft: 'dangerSoft' },
  celebration: { icon: 'trophy', color: 'gold', soft: 'primarySoft' },
  brand: { icon: 'hand-left', color: 'primary', soft: 'primarySoft' },
};

/**
 * Base visual de TODOS los diálogos (confirmación, mensaje, pistas). Un solo
 * lugar define fondo, radio, animación de entrada, icono de estado y
 * accesibilidad, así cada modal nuevo se ve igual sin copiar estilos.
 *
 * - `tone` define icono + color de acento (nunca solo color: siempre icono).
 * - `dismissible` permite cerrar tocando el fondo / botón atrás de Android.
 * - `actions` es el pie con botones (normalmente <Button> del sistema).
 */
export default function Dialog({
  visible,
  tone = 'info',
  icon,
  title,
  message,
  children,
  actions,
  dismissible = true,
  onRequestClose,
  testID,
}) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const appear = useRef(new Animated.Value(0)).current;
  const toneConfig = DIALOG_TONES[tone] || DIALOG_TONES.info;
  const accent = theme.colors[toneConfig.color];

  useEffect(() => {
    if (!visible) return;
    appear.setValue(reducedMotion ? 1 : 0);
    if (reducedMotion) return;
    Animated.timing(appear, {
      toValue: 1,
      duration: theme.motion.duration.base,
      easing: theme.motion.easing.pop,
      useNativeDriver: true,
    }).start();
  }, [visible, reducedMotion, appear, theme]);

  const close = () => {
    if (dismissible) onRequestClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Cerrar diálogo"
          disabled={!dismissible}
        />
        <Animated.View
          testID={testID}
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[
            styles.card,
            {
              opacity: appear,
              transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
            },
          ]}
        >
          {tone === 'celebration' ? (
            <LinearGradient {...theme.gradients.celebration} style={styles.topAccent} />
          ) : (
            <View style={[styles.topAccent, { backgroundColor: accent }]} />
          )}
          <View style={[styles.badge, { backgroundColor: theme.colors[toneConfig.soft] }]}>
            <Ionicons name={icon || toneConfig.icon} size={28} color={accent} />
          </View>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {children}
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(theme) {
  const { colors, spacing, radius, typography } = theme;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    card: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 440,
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.xxl,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.lg,
      overflow: 'hidden',
      ...theme.elevation.lg,
    },
    topAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 5 },
    badge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    title: { ...typography.title, fontSize: 20, textAlign: 'center', color: colors.textPrimary, marginBottom: spacing.sm },
    message: {
      ...typography.body,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      color: colors.textSecondary,
      marginBottom: spacing.lg,
    },
    actions: { flexDirection: 'row', gap: spacing.sm + 2, marginTop: spacing.xs },
  });
}
