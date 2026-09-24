import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { APP_FONTS } from '../../constants/fonts';
import { useAppTheme } from '../../theme/ThemeProvider';

export default function ActionButton({
  label,
  onPress,
  variant = 'primary',
  style,
  textStyle,
  disabled = false,
  // Permite pintar el botón primario con un degradé distinto al de marca
  // (ej: verde/rojo sólido en el feedback de un ejercicio).
  gradientColors,
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (variant === 'secondary') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[styles.base, styles.secondary, disabled && styles.disabled, style]}
      >
        <Text style={[styles.baseText, styles.secondaryText, textStyle]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} disabled={disabled} style={[disabled && styles.disabled, style]}>
      <LinearGradient
        colors={gradientColors || theme.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.base}
      >
        <Text style={[styles.baseText, styles.primaryText, textStyle]}>{label}</Text>
      </LinearGradient>
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
    },
    secondary: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    disabled: {
      opacity: 0.55,
    },
    baseText: {
      fontFamily: APP_FONTS.bold,
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
