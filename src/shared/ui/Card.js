import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';

/**
 * Tarjeta base. Todas las tarjetas de la app comparten radio (`radius.lg`),
 * borde y padding; cambian solo por variante:
 *
 *  - surface  (default) superficie + borde
 *  - raised   superficie elevada con sombra (tarjetas destacadas, menús)
 *  - gradient fondo con degradé sutil `gradients.card` (tarjetas "hero")
 *  - brand    degradé de marca; el contenido debe usar tono `inverse`
 *  - tone     fondo suave de estado: pasa `tone="success" | "danger" | "warning" | "info"`
 *
 * Con `onPress` se vuelve presionable con estado pressed/focus y rol de botón.
 */
export default function Card({
  children,
  variant = 'surface',
  tone,
  padding = 'lg',
  onPress,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const paddingValue = padding === 'none' ? 0 : theme.spacing[padding] ?? theme.spacing.lg;
  const toneStyle = tone
    ? { backgroundColor: theme.colors[`${tone}Soft`], borderColor: theme.colors[tone] }
    : null;

  const renderBody = (stateStyle, extraProps, bodyStyle = style) => {
    const base = [styles.base, styles[variant], toneStyle, { padding: paddingValue }, stateStyle, bodyStyle];
    if (variant === 'gradient' || variant === 'brand') {
      const gradient = variant === 'brand' ? theme.gradients.brand : theme.gradients.card;
      return (
        <LinearGradient {...gradient} {...extraProps} style={base}>
          {children}
        </LinearGradient>
      );
    }
    return (
      <View {...extraProps} style={base}>
        {children}
      </View>
    );
  };

  if (!onPress) {
    // Sin envoltorio extra: `style` (flex, width %) se aplica a la tarjeta misma.
    return renderBody(null, {
      testID,
      accessible: Boolean(accessibilityLabel),
      accessibilityLabel,
    });
  }

  // Presionable: el layout externo (margin, width, flex) va en el Pressable
  // para que el área táctil coincida con la tarjeta visible.
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={style}
    >
      {({ pressed, focused }) =>
        renderBody([pressed && styles.pressed, focused && styles.focused, disabled && styles.disabled], null, styles.fill)
      }
    </Pressable>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    base: {
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    surface: { backgroundColor: theme.colors.surface },
    raised: { backgroundColor: theme.colors.surfaceRaised, ...theme.elevation.md },
    gradient: {},
    brand: { borderColor: 'transparent' },
    fill: { flexGrow: 1 },
    pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
    focused: { borderColor: theme.colors.focusRing, borderWidth: 2 },
    disabled: { opacity: 0.55 },
  });
}
