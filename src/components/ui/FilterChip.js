import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '../../theme/ThemeProvider';

export default function FilterChip({ label, selected, onPress }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable style={[styles.chip, selected && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.text, selected && styles.textActive]}>{label}</Text>
    </Pressable>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    chipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    text: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    textActive: {
      color: theme.colors.primaryContrast,
    },
  });
}
