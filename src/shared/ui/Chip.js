import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import haptics from '../../core/feedback/haptics';
import { useAppTheme } from '../theme/ThemeProvider';

/**
 * Chip seleccionable (filtros, categorías, opciones cortas).
 * Seleccionado = degradé de marca + check (el estado no depende solo del color).
 */
export default function Chip({ label, selected = false, onPress, icon, disabled = false, style }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const textColor = selected ? theme.colors.primaryContrast : theme.colors.textSecondary;

  const content = (
    <>
      {selected ? <Ionicons name="checkmark" size={14} color={textColor} /> : null}
      {!selected && icon ? <Ionicons name={icon} size={14} color={textColor} /> : null}
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </>
  );

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress?.();
      }}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      style={style}
    >
      {({ pressed }) =>
        selected ? (
          <LinearGradient {...theme.gradients.brand} style={[styles.chip, styles.chipSelected, pressed && styles.pressed]}>
            {content}
          </LinearGradient>
        ) : (
          <View style={[styles.chip, pressed && styles.pressed, disabled && styles.disabled]}>{content}</View>
        )
      }
    </Pressable>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    chip: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    chipSelected: { borderColor: 'transparent' },
    text: { ...theme.typography.label },
    pressed: { opacity: 0.8 },
    disabled: { opacity: 0.5 },
  });
}
