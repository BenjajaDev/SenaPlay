import { useEffect, useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../theme/ThemeProvider';

const CONTEXT_PRESETS = {
  'login-success': {
    variant: 'success',
    title: 'Bienvenido',
    message: 'Inicio de sesion exitoso.',
    primaryText: 'Continuar',
  },
  'register-success': {
    variant: 'success',
    title: 'Registro exitoso',
    message: 'Tu cuenta fue creada correctamente.',
    primaryText: 'Continuar',
  },
  'email-verification-sent': {
    variant: 'info',
    title: 'Verifica tu correo',
    message: 'Te enviamos un correo de verificacion. Revisa tu bandeja y spam.',
    primaryText: 'Entendido',
  },
  'email-verification-required': {
    variant: 'warning',
    title: 'Correo no verificado',
    message: 'Debes verificar tu correo antes de iniciar sesion.',
    primaryText: 'Entendido',
  },
  'password-updated': {
    variant: 'success',
    title: 'Contrasena actualizada',
    message: 'Tu contrasena se cambio correctamente. Inicia sesion con la nueva.',
    primaryText: 'Iniciar sesion',
  },
  validation: {
    variant: 'warning',
    title: 'Validacion',
    message: 'Revisa los campos e intentalo de nuevo.',
    primaryText: 'Entendido',
  },
  'auth-error': {
    variant: 'error',
    title: 'Error',
    message: 'No se pudo completar la accion.',
    primaryText: 'Cerrar',
  },
  'level-complete': {
    variant: 'celebration',
    title: 'Nivel completado',
    message: 'Excelente trabajo. Estas listo para el siguiente reto.',
    primaryText: 'Siguiente',
    secondaryText: 'Mas tarde',
  },
};

const VARIANT_STYLES = {
  info: {
    badge: 'I',
    badgeBackground: '#DBEAFE',
    badgeText: '#1D4ED8',
    accent: '#2563EB',
  },
  success: {
    badge: 'OK',
    badgeBackground: '#DCFCE7',
    badgeText: '#166534',
    accent: '#22C55E',
  },
  warning: {
    badge: '!',
    badgeBackground: '#FEF3C7',
    badgeText: '#92400E',
    accent: '#F59E0B',
  },
  error: {
    badge: 'X',
    badgeBackground: '#FEE2E2',
    badgeText: '#B91C1C',
    accent: '#EF4444',
  },
  celebration: {
    badge: '+',
    badgeBackground: '#EDE9FE',
    badgeText: '#6D28D9',
    accent: '#8B5CF6',
  },
};

export default function AdaptiveModal({
  visible,
  context,
  title,
  message,
  variant,
  primaryText,
  secondaryText,
  autoCloseMs,
  onPrimaryPress,
  onSecondaryPress,
  onRequestClose,
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const preset = CONTEXT_PRESETS[context] || {};
  const resolvedVariant = variant || preset.variant || 'info';
  const palette = VARIANT_STYLES[resolvedVariant] || VARIANT_STYLES.info;
  const resolvedTitle = title || preset.title || 'Mensaje';
  const resolvedMessage = message || preset.message || '';
  const resolvedPrimaryText = primaryText || preset.primaryText || 'Aceptar';
  const resolvedSecondaryText = secondaryText || preset.secondaryText;

  useEffect(() => {
    if (!visible || !autoCloseMs) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      if (onPrimaryPress) {
        onPrimaryPress();
      } else if (onRequestClose) {
        onRequestClose();
      }
    }, autoCloseMs);

    return () => clearTimeout(timeoutId);
  }, [autoCloseMs, onPrimaryPress, onRequestClose, visible]);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onRequestClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <View style={[styles.topAccent, { backgroundColor: palette.accent }]} />

          <View style={[styles.badge, { backgroundColor: palette.badgeBackground }]}>
            <Text style={[styles.badgeText, { color: palette.badgeText }]}>{palette.badge}</Text>
          </View>

          <Text style={styles.title}>{resolvedTitle}</Text>
          <Text style={styles.message}>{resolvedMessage}</Text>

          <View style={styles.actions}>
            {resolvedSecondaryText ? (
              <Pressable style={styles.secondaryButton} onPress={onSecondaryPress || onRequestClose}>
                <Text style={styles.secondaryButtonText}>{resolvedSecondaryText}</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[styles.primaryButton, { backgroundColor: palette.accent }]}
              onPress={onPrimaryPress || onRequestClose}
            >
              <Text style={styles.primaryButtonText}>{resolvedPrimaryText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme) {
  const isDark = theme.mode === 'dark';

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'center',
      paddingHorizontal: 22,
    },
    container: {
      backgroundColor: isDark ? '#221C35' : '#FFFFFF',
      borderColor: isDark ? '#4B3B73' : theme.colors.border,
      borderWidth: 1,
      borderRadius: 24,
      paddingHorizontal: 22,
      paddingTop: 22,
      paddingBottom: 18,
      overflow: 'hidden',
    },
    topAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 5,
    },
    badge: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: 12,
    },
    badgeText: {
      fontSize: 15,
      fontWeight: '800',
    },
    title: {
      textAlign: 'center',
      color: theme.colors.textPrimary,
      fontSize: 21,
      fontWeight: '800',
      marginBottom: 8,
    },
    message: {
      textAlign: 'center',
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 20,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
    },
    primaryButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },
    secondaryButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: isDark ? '#4B3B73' : '#D1D5DB',
      backgroundColor: isDark ? '#2A2341' : '#F9FAFB',
    },
    secondaryButtonText: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}