import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import useReducedMotion from '../../../../core/a11y/useReducedMotion';
import haptics from '../../../../core/feedback/haptics';
import { AppText, IconButton } from '../../../../shared/ui';
import { useAppTheme } from '../../../../shared/theme/ThemeProvider';

/**
 * Sistema de pistas rediseñado: un botón flotante minimalista (ampolleta)
 * que abre un globo contextual ANCLADO al botón, sin modal ni fondo oscuro.
 *
 * Antes la pista era un panel que se insertaba en medio del ejercicio y
 * empujaba el contenido; ahora flota encima, se puede seguir respondiendo con
 * la pista abierta y se cierra con la X o tocando la ampolleta otra vez.
 */
export function HintFab({ open, onPress, used }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={open ? 'Ocultar pista' : 'Ver pista'}
      accessibilityHint={used ? undefined : 'Usar una pista resta algunos puntos'}
      accessibilityState={{ expanded: open }}
      hitSlop={6}
      style={({ pressed }) => [styles.fab, open && styles.fabOpen, pressed && styles.pressed]}
    >
      <Ionicons name={open ? 'bulb' : 'bulb-outline'} size={24} color={open ? theme.colors.onWarning : theme.colors.warningText} />
    </Pressable>
  );
}

export function HintPopover({ hint, onClose }) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!hint) return;
    appear.setValue(reducedMotion ? 1 : 0);
    Animated.timing(appear, {
      toValue: 1,
      duration: theme.motion.duration.base,
      easing: theme.motion.easing.pop,
      useNativeDriver: true,
    }).start();
  }, [hint, reducedMotion, appear, theme]);

  if (!hint) return null;

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.popover,
        {
          opacity: appear,
          transform: [
            { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
            { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
          ],
        },
      ]}
    >
      <View style={styles.header}>
        <Ionicons name="bulb" size={18} color={theme.colors.warningText} />
        <AppText variant="bodyStrong" tone="warning" style={styles.flex}>
          {hint.title || 'Pista'}
        </AppText>
        <IconButton icon="close" label="Cerrar pista" onPress={onClose} size={32} iconSize={18} />
      </View>
      {hint.texto ? <AppText variant="body" style={styles.text}>{hint.texto}</AppText> : null}
      {hint.parametros?.length ? (
        <View style={styles.params}>
          {hint.parametros.map((param) => (
            <View key={param.label} style={styles.paramRow}>
              <Ionicons name={param.icon} size={14} color={theme.colors.warningText} style={styles.paramIcon} />
              <AppText variant="caption" style={styles.flex}>
                <AppText variant="label" tone="warning">
                  {param.label}:{' '}
                </AppText>
                {param.valor}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
      {/* Flecha que apunta a la ampolleta. */}
      <View style={styles.arrow} />
    </Animated.View>
  );
}

function createStyles(theme) {
  const { colors, spacing, radius } = theme;
  return StyleSheet.create({
    fab: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.warningSoft,
      borderWidth: 1.5,
      borderColor: colors.warning,
      ...theme.elevation.md,
    },
    fabOpen: { backgroundColor: colors.warning },
    pressed: { transform: [{ scale: 0.92 }] },
    // En el flujo normal (no absoluto) sobre la ampolleta: en Android los
    // toques fuera de los límites del padre no llegan, y la X debe funcionar.
    popover: {
      width: 300,
      maxWidth: '100%',
      marginBottom: spacing.sm + 4,
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.xl,
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1.5,
      borderColor: colors.warning,
      ...theme.elevation.lg,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    flex: { flex: 1 },
    text: { fontSize: 14, lineHeight: 20 },
    params: { gap: spacing.xs + 2 },
    paramRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs + 2 },
    paramIcon: { marginTop: 2 },
    arrow: {
      position: 'absolute',
      bottom: -8,
      right: 18,
      width: 14,
      height: 14,
      backgroundColor: colors.surfaceRaised,
      borderRightWidth: 1.5,
      borderBottomWidth: 1.5,
      borderColor: colors.warning,
      transform: [{ rotate: '45deg' }],
    },
  });
}
