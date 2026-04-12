import { Pressable, StyleSheet, Text } from 'react-native';

export default function ActionButton({
  label,
  onPress,
  variant = 'primary',
  style,
  textStyle,
  disabled = false,
}) {
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

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: '#7E57C2',
    borderColor: '#7E57C2',
  },
  secondary: {
    backgroundColor: '#FFFFFF',
    borderColor: '#7E57C2',
  },
  disabled: {
    opacity: 0.55,
  },
  baseText: {
    fontWeight: '800',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#7E57C2',
  },
});
