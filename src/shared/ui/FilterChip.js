import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { APP_FONTS } from '../theme/fonts';
import { useAppTheme } from '../theme/ThemeProvider';

export default function FilterChip({ label, selected, onPress }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (selected) {
    return (
      <Pressable onPress={onPress}>
        <LinearGradient
          colors={theme.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.chip}
        >
          <Text style={[styles.text, styles.textActive]}>{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.chip} onPress={onPress}>
      <Text style={styles.text}>{label}</Text>
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
    text: {
      fontFamily: APP_FONTS.semiBold,
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    textActive: {
      color: theme.colors.primaryContrast,
    },
  });
}
