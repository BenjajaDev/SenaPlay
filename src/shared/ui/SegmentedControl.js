import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import haptics from '../../core/feedback/haptics';
import { useAppTheme } from '../theme/ThemeProvider';

/**
 * Selector de 2–4 opciones excluyentes (modo del diccionario, pestañas de
 * login). `options` = [{ key, label }].
 */
export default function SegmentedControl({ options, value, onChange, style }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.track, style]} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => {
              if (!selected) haptics.selection();
              onChange(option.key);
            }}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            style={({ pressed }) => [styles.segment, selected && styles.segmentActive, pressed && !selected && styles.pressed]}
          >
            <Text numberOfLines={1} style={[styles.label, selected && styles.labelActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: theme.colors.primarySoft,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.xs,
      gap: theme.spacing.xs,
    },
    segment: {
      flex: 1,
      minHeight: 40,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.md - 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentActive: { backgroundColor: theme.colors.surfaceRaised, ...theme.elevation.sm },
    pressed: { opacity: 0.7 },
    label: { ...theme.typography.label, color: theme.colors.textSecondary },
    labelActive: { ...theme.typography.button, fontSize: 13, color: theme.colors.primary },
  });
}
