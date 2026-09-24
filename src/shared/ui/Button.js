import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import useReducedMotion from '../../core/a11y/useReducedMotion';
import haptics from '../../core/feedback/haptics';
import { useAppTheme } from '../theme/ThemeProvider';

/**
 * Botón único del sistema de diseño.
 *
 * Variantes:
 *  - primary    degradé de marca (acción principal de la pantalla; una sola)
 *  - secondary  superficie + borde de marca
 *  - ghost      solo texto (acciones terciarias, "Más tarde")
 *  - danger     acción destructiva (eliminar, cerrar sesión)
 *  - success    confirmar tras un acierto ("Continuar")
 *
 * Estados: pressed (escala + opacidad), disabled, loading (spinner y bloquea
 * el toque para evitar dobles envíos) y focus/hover en web (Pressable los
 * reporta; se pintan con un borde `focusRing`).
 *
 * `haptic` agrega una vibración leve al presionar; úsalo en acciones de
 * juego, no en navegación común.
 */
export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = true,
  haptic = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  textStyle,
  testID,
}) {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scale = useRef(new Animated.Value(1)).current;
  const isInactive = disabled || loading;
  const palette = getVariantPalette(theme, variant);

  const animateTo = (toValue) => {
    if (reducedMotion) return;
    Animated.spring(scale, { toValue, useNativeDriver: true, ...theme.motion.spring.press }).start();
  };

  const handlePress = (event) => {
    if (isInactive) return;
    if (haptic) haptics.tap();
    onPress?.(event);
  };

  const content = (
    <View style={[styles.content, sizeStyles[size]]}>
      {loading ? (
        <ActivityIndicator size="small" color={palette.text} />
      ) : (
        <>
          {icon && iconPosition === 'left' ? <Ionicons name={icon} size={iconSizes[size]} color={palette.text} /> : null}
          <Text
            numberOfLines={1}
            style={[theme.typography.button, size === 'sm' && styles.smallText, { color: palette.text }, textStyle]}
          >
            {label}
          </Text>
          {icon && iconPosition === 'right' ? <Ionicons name={icon} size={iconSizes[size]} color={palette.text} /> : null}
        </>
      )}
    </View>
  );

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      onPressIn={() => animateTo(0.96)}
      onPressOut={() => animateTo(1)}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      style={[fullWidth ? styles.fullWidth : styles.inline, style]}
    >
      {({ pressed, focused, hovered }) => (
        <Animated.View
          style={[
            styles.base,
            { transform: [{ scale }] },
            (focused || hovered) && styles.focused,
            pressed && styles.pressed,
            isInactive && styles.disabled,
          ]}
        >
          {palette.gradient ? (
            <LinearGradient {...palette.gradient} style={styles.fill}>
              {content}
            </LinearGradient>
          ) : (
            <View style={[styles.fill, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: palette.border ? 1 : 0 }]}>
              {content}
            </View>
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

function getVariantPalette(theme, variant) {
  const { colors, gradients } = theme;
  switch (variant) {
    case 'secondary':
      return { background: colors.surface, border: colors.primary, text: colors.primary };
    case 'ghost':
      return { background: 'transparent', border: null, text: colors.primary };
    case 'danger':
      return { background: colors.danger, border: null, text: colors.onDanger };
    case 'success':
      return { background: colors.success, border: null, text: colors.onSuccess };
    default:
      return { gradient: gradients.brand, text: colors.primaryContrast };
  }
}

const iconSizes = { sm: 16, md: 18, lg: 20 };

const sizeStyles = StyleSheet.create({
  sm: { minHeight: 36, paddingHorizontal: 12, paddingVertical: 6 },
  md: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12 },
  lg: { minHeight: 56, paddingHorizontal: 20, paddingVertical: 14 },
});

function createStyles(theme) {
  return StyleSheet.create({
    fullWidth: { alignSelf: 'stretch' },
    inline: { alignSelf: 'flex-start' },
    base: {
      borderRadius: theme.radius.md,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    fill: { borderRadius: theme.radius.md - 2 },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
    },
    smallText: { fontSize: 13 },
    pressed: { opacity: 0.9 },
    focused: { borderColor: theme.colors.focusRing },
    disabled: { opacity: 0.5 },
  });
}
