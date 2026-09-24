import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';

/**
 * Casilla de entrada única del sistema de diseño.
 *
 * Estados visuales: normal, focus (borde de marca + halo), error (borde y
 * mensaje en rojo con icono — nunca solo color), disabled.
 * `secureTextEntry` agrega automáticamente el botón mostrar/ocultar.
 * `multiline` sirve para descripciones (panel de pistas, perfil).
 *
 * El label es texto visible (no solo placeholder): el placeholder desaparece
 * al escribir y no lo leen bien todos los lectores de pantalla.
 */
const TextField = forwardRef(function TextField(
  {
    label,
    value,
    onChangeText,
    placeholder,
    error,
    helper,
    icon,
    secureTextEntry = false,
    disabled = false,
    multiline = false,
    right,
    style,
    inputStyle,
    onFocus,
    onBlur,
    ...inputProps
  },
  ref,
) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const hasError = Boolean(error);

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          focused && styles.fieldFocused,
          hasError && styles.fieldError,
          disabled && styles.fieldDisabled,
        ]}
      >
        {icon ? (
          <Ionicons name={icon} size={18} color={focused ? theme.colors.primary : theme.colors.textMuted} />
        ) : null}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          editable={!disabled}
          multiline={multiline}
          secureTextEntry={secureTextEntry && !revealed}
          accessibilityLabel={inputProps.accessibilityLabel || label || placeholder}
          accessibilityState={{ disabled }}
          accessibilityHint={hasError ? error : helper}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, multiline && styles.inputMultiline, inputStyle]}
          {...inputProps}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setRevealed((prev) => !prev)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        ) : null}
        {right}
      </View>
      {hasError ? (
        <View style={styles.messageRow} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={14} color={theme.colors.dangerText} />
          <Text style={[styles.message, styles.errorText]}>{error}</Text>
        </View>
      ) : helper ? (
        <Text style={styles.message}>{helper}</Text>
      ) : null}
    </View>
  );
});

export default TextField;

function createStyles(theme) {
  const { colors, radius, spacing, typography } = theme;
  return StyleSheet.create({
    container: { gap: spacing.xs + 2 },
    label: { ...typography.label, color: colors.textPrimary },
    field: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md + 2,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
    },
    fieldMultiline: { alignItems: 'flex-start', paddingVertical: spacing.sm },
    fieldFocused: {
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOpacity: 0.18,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 0 },
      elevation: 2,
    },
    fieldError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
    fieldDisabled: { opacity: 0.55, backgroundColor: colors.surfaceSunken },
    input: {
      flex: 1,
      ...typography.body,
      color: colors.textPrimary,
      paddingVertical: spacing.sm + 2,
    },
    inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
    messageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    message: { ...typography.caption, color: colors.textSecondary },
    errorText: { color: colors.dangerText },
  });
}
