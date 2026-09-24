import { useEffect } from 'react';
import { View } from 'react-native';
import announce from '../../../core/a11y/announce';
import haptics from '../../../core/feedback/haptics';
import Button from '../Button';
import Dialog from './Dialog';

// Mensajes recurrentes: agrega aquí un preset en vez de pasar título y
// mensaje a mano en cada pantalla (mantiene el tono de voz consistente).
export const MESSAGE_PRESETS = {
  'login-success': {
    variant: 'success',
    title: 'Bienvenido',
    message: 'Inicio de sesión exitoso.',
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
    message: 'Te enviamos un correo de verificación. Revisa tu bandeja de entrada y spam.',
    primaryText: 'Entendido',
  },
  'email-verification-required': {
    variant: 'warning',
    title: 'Correo no verificado',
    message: 'Debes verificar tu correo antes de iniciar sesión.',
    primaryText: 'Entendido',
  },
  'password-updated': {
    variant: 'success',
    title: 'Contraseña actualizada',
    message: 'Tu contraseña se cambió correctamente. Inicia sesión con la nueva.',
    primaryText: 'Iniciar sesión',
  },
  'profile-saved': {
    variant: 'success',
    title: 'Perfil actualizado',
    message: 'Tus cambios se guardaron correctamente.',
    primaryText: 'Listo',
  },
  validation: {
    variant: 'warning',
    title: 'Revisa los datos',
    message: 'Revisa los campos e inténtalo de nuevo.',
    primaryText: 'Entendido',
  },
  'auth-error': {
    variant: 'error',
    title: 'Algo salió mal',
    message: 'No se pudo completar la acción.',
    primaryText: 'Cerrar',
  },
  'network-error': {
    variant: 'error',
    title: 'Sin conexión',
    message: 'No pudimos conectarnos. Revisa tu internet e inténtalo de nuevo.',
    primaryText: 'Entendido',
  },
  'level-complete': {
    variant: 'celebration',
    title: 'Nivel completado',
    message: 'Excelente trabajo. Estás listo para el siguiente reto.',
    primaryText: 'Siguiente',
    secondaryText: 'Más tarde',
  },
};

const VARIANT_TO_TONE = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'danger',
  celebration: 'celebration',
};

/**
 * Diálogo de mensaje (reemplaza a AdaptiveModal con la misma API):
 * informa un resultado y ofrece 1 o 2 acciones. Para PEDIR confirmación
 * antes de una acción crítica usa ConfirmDialog / useConfirm.
 *
 * Al abrirse vibra según el tipo (éxito/error/aviso) y lo anuncia al lector
 * de pantalla: el feedback nunca depende de un solo sentido.
 */
export default function MessageDialog({
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
  children,
}) {
  const preset = MESSAGE_PRESETS[context] || {};
  const resolvedVariant = variant || preset.variant || 'info';
  const tone = VARIANT_TO_TONE[resolvedVariant] || 'info';
  const resolvedTitle = title || preset.title || 'Mensaje';
  const resolvedMessage = message || preset.message || '';
  const resolvedPrimaryText = primaryText || preset.primaryText || 'Aceptar';
  const resolvedSecondaryText = secondaryText || preset.secondaryText;

  useEffect(() => {
    if (!visible) return;
    if (tone === 'success') haptics.success();
    else if (tone === 'danger') haptics.error();
    else if (tone === 'warning') haptics.warning();
    else if (tone === 'celebration') haptics.celebrate();
    announce(`${resolvedTitle}. ${resolvedMessage}`);
    // Solo al abrir: re-vibrar en cada re-render sería molesto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible || !autoCloseMs) return undefined;
    const timeoutId = setTimeout(() => {
      if (onPrimaryPress) onPrimaryPress();
      else onRequestClose?.();
    }, autoCloseMs);
    return () => clearTimeout(timeoutId);
  }, [autoCloseMs, onPrimaryPress, onRequestClose, visible]);

  return (
    <Dialog
      visible={visible}
      tone={tone}
      title={resolvedTitle}
      message={resolvedMessage}
      onRequestClose={onRequestClose}
      actions={
        <>
          {resolvedSecondaryText ? (
            <View style={{ flex: 1 }}>
              <Button
                label={resolvedSecondaryText}
                variant="secondary"
                onPress={onSecondaryPress || onRequestClose}
              />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button
              label={resolvedPrimaryText}
              variant={tone === 'danger' ? 'danger' : 'primary'}
              onPress={onPrimaryPress || onRequestClose}
            />
          </View>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
