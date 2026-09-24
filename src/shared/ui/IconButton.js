import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import haptics from '../../core/feedback/haptics';
import { useAppTheme } from '../theme/ThemeProvider';

/**
 * Botón de solo icono. `label` es obligatorio: es lo que lee el lector de
 * pantalla, ya que no hay texto visible. El área táctil siempre es ≥ 44px
 * (se completa con hitSlop cuando el icono es más chico).
 *
 * Variantes: ghost (sin fondo), soft (fondo primarySoft), solid (degradé),
 * surface (tarjeta con borde; útil flotando sobre contenido).
 */
export default function IconButton({
  icon,
  label,
  onPress,
  variant = 'ghost',
  size = 44,
  iconSize,
  color,
  disabled = false,
  haptic = false,
  style,
  testID,
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const resolvedIconSize = iconSize || Math.round(size * 0.5);
  const slop = Math.max(0, Math.ceil((theme.minTouch - size) / 2));
  const iconColor =
    color || (variant === 'solid' ? theme.colors.primaryContrast : variant === 'ghost' ? theme.colors.textPrimary : theme.colors.primary);

  const box = { width: size, height: size, borderRadius: size / 2 };
  const inner = <Ionicons name={icon} size={resolvedIconSize} color={iconColor} />;

  return (
    <Pressable
      testID={testID}
      onPress={(event) => {
        if (haptic) haptics.selection();
        onPress?.(event);
      }}
      disabled={disabled}
      hitSlop={slop}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={style}
    >
      {({ pressed, focused }) => {
        const stateStyle = [pressed && styles.pressed, focused && styles.focused, disabled && styles.disabled];
        if (variant === 'solid') {
          return (
            <LinearGradient {...theme.gradients.brand} style={[styles.center, box, ...stateStyle]}>
              {inner}
            </LinearGradient>
          );
        }
        return <View style={[styles.center, box, styles[variant], ...stateStyle]}>{inner}</View>;
      }}
    </Pressable>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    center: { alignItems: 'center', justifyContent: 'center' },
    ghost: { backgroundColor: 'transparent' },
    soft: { backgroundColor: theme.colors.primarySoft },
    surface: {
      backgroundColor: theme.colors.surfaceRaised,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.elevation.md,
    },
    pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
    focused: { borderWidth: 2, borderColor: theme.colors.focusRing },
    disabled: { opacity: 0.45 },
  });
}
