import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import haptics from '../../../../core/feedback/haptics';
import { useAppTheme } from '../../../../shared/theme/ThemeProvider';

/**
 * Casilla seleccionable común a todos los ejercicios (opciones, letras del
 * banco, cartas de memoria, casilleros). Un solo componente = mismos estados
 * visuales en toda la sesión:
 *
 *   state: 'idle' | 'selected' | 'matched' | 'empty'
 *
 * 'selected' y 'matched' agregan icono (✓ / borde de marca), no solo color.
 * `onLongPress` se usa para pedir la pista de una seña.
 */
export default function OptionTile({
  children,
  label,
  onPress,
  onLongPress,
  state = 'idle',
  disabled = false,
  shape = 'rounded',
  style,
  accessibilityLabel,
  accessibilityHint,
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isSelected = state === 'selected';
  const isMatched = state === 'matched';

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        haptics.selection();
        onPress?.();
      }}
      onLongPress={onLongPress}
      delayLongPress={400}
      disabled={disabled && !onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected: isSelected, disabled, checked: isMatched }}
      style={({ pressed }) => [
        styles.base,
        shape === 'pill' && styles.pill,
        state === 'empty' && styles.empty,
        isSelected && styles.selected,
        isMatched && styles.matched,
        pressed && !disabled && styles.pressed,
        disabled && !isMatched && styles.disabled,
        style,
      ]}
    >
      {children ?? (
        <Text style={[styles.label, isSelected && styles.labelSelected, isMatched && styles.labelMatched]}>{label}</Text>
      )}
      {isMatched ? (
        <View style={styles.corner}>
          <Ionicons name="checkmark-circle" size={16} color={theme.colors.successText} />
        </View>
      ) : null}
    </Pressable>
  );
}

function createStyles(theme) {
  const { colors, radius, spacing, typography } = theme;
  return StyleSheet.create({
    base: {
      minHeight: 48,
      borderRadius: radius.lg,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
    },
    pill: { borderRadius: radius.pill, minWidth: 48, paddingHorizontal: spacing.lg - 2 },
    empty: { borderStyle: 'dashed', backgroundColor: colors.surfaceSunken },
    selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    matched: { borderColor: colors.success, backgroundColor: colors.successSoft },
    pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
    disabled: { opacity: 0.6 },
    label: { ...typography.heading, fontSize: 18, color: colors.textPrimary, textAlign: 'center' },
    labelSelected: { color: colors.primary },
    labelMatched: { color: colors.successText },
    corner: { position: 'absolute', top: 4, right: 4 },
  });
}
