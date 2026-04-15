import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '../../theme/ThemeProvider';

export default function ActionButton({
  label,
  onPress,
  variant = 'primary',
  style,
  textStyle,
  disabled = false,
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.base,
        variant === 'secondary' ? styles.secondary : styles.primary,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.baseText, variant === 'secondary' ? styles.secondaryText : styles.primaryText, textStyle]}>
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    base: {
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
    },
    primary: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    secondary: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.primary,
    },
    disabled: {
      opacity: 0.55,
    },
    baseText: {
      fontWeight: '800',
    },
    primaryText: {
      color: theme.colors.primaryContrast,
    },
    secondaryText: {
      color: theme.colors.primary,
    },
  });
}
