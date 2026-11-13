import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import haptics from '../../core/feedback/haptics';
import { useAppTheme } from '../theme/ThemeProvider';

/**
 * Chip seleccionable (filtros, categorías, opciones cortas).
 * `role="switch"` para ajustes que se encienden y apagan (Lento, Repetir).
 * Seleccionado = degradé de marca + check (el estado no depende solo del color).
 */
export default function Chip({ label, selected = false, onPress, icon, iconOnly = false, role = 'button', disabled = false, style }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const textColor = selected ? theme.colors.primaryContrast : theme.colors.textSecondary;
  const compact = iconOnly && Boolean(icon);

  // `iconOnly`: solo el ícono (el label sigue siendo el nombre accesible). Al
  // elegirlo se distingue por el relleno de marca, no solo por el matiz.
  const content = compact ? (
    <Ionicons name={icon} size={20} color={textColor} />
  ) : (
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
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'switch' ? { selected, checked: selected, disabled } : { selected, disabled }}
      style={style}
    >
      {({ pressed }) =>
        selected ? (
          <LinearGradient
            {...theme.gradients.brand}
            style={[styles.chip, compact && styles.chipIcon, styles.chipSelected, pressed && styles.pressed]}
          >
            {content}
          </LinearGradient>
        ) : (
          <View style={[styles.chip, compact && styles.chipIcon, pressed && styles.pressed, disabled && styles.disabled]}>{content}</View>
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
    chipIcon: { minWidth: 44, minHeight: 44, justifyContent: 'center', paddingHorizontal: theme.spacing.sm },
    chipSelected: { borderColor: 'transparent' },
    text: { ...theme.typography.label },
    pressed: { opacity: 0.8 },
    disabled: { opacity: 0.5 },
  });
}
