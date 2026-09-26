import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useServices } from '../../../core/di/ServicesProvider';
import haptics from '../../../core/feedback/haptics';
import { AppText, BottomSheet, Button, TextField, useFeedback } from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '../../auth/domain/validation';

const EMPTY = { current: '', password: '', confirmPassword: '' };

/** Cuentas de Google u otro proveedor no tienen contraseña que comprobar. */
export const hasEmailPassword = (user) => {
  const providers = user?.app_metadata?.providers || [user?.app_metadata?.provider].filter(Boolean);
  return !providers.length || providers.includes('email');
};

/**
 * Hoja para cambiar la contraseña desde Perfil: pide la actual (si la
 * cuenta tiene), valida la nueva junto a cada campo y confirma antes de
 * guardar.
 */
export default function ChangePasswordSheet({ visible, user, onClose }) {
  const theme = useAppTheme();
  const { auth } = useServices();
  const { confirm, notify } = useFeedback();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const needsCurrent = hasEmailPassword(user);

  useEffect(() => {
    if (!visible) return;
    setForm(EMPTY);
    setErrors({});
  }, [visible]);

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    const next = validateNewPassword(form);
    if (needsCurrent && !form.current) next.current = 'Ingresa tu contraseña actual.';
    if (needsCurrent && form.current && form.password && form.current === form.password) {
      next.password = 'La nueva contraseña debe ser distinta a la actual.';
    }
    setErrors(next);
    if (Object.keys(next).length) {
      haptics.warning();
      return;
    }
    try {
      const done = await confirm({
        title: '¿Cambiar tu contraseña?',
        message: 'La próxima vez que inicies sesión tendrás que usar la nueva.',
        tone: 'info',
        icon: 'key-outline',
        confirmLabel: 'Cambiar',
        onConfirm: async () => {
          const result = await auth.changePassword({
            email: user?.email,
            currentPassword: needsCurrent ? form.current : undefined,
            newPassword: form.password,
          });
          if (!result.ok) throw Object.assign(new Error(result.error), { code: result.cause?.code });
        },
      });
      if (done) {
        haptics.success();
        notify({ tone: 'success', title: 'Contraseña actualizada', message: 'Úsala la próxima vez que ingreses.' });
        onClose();
      }
    } catch (error) {
      haptics.error();
      // El error va junto al campo que corresponde, no en un modal aparte.
      if (error.code === 'wrong_password') setErrors({ current: error.message });
      else setErrors({ general: error.message });
    }
  };

  return (
    <BottomSheet
      visible={visible}
      title="Cambiar contraseña"
      onClose={onClose}
      footer={<Button label="Guardar contraseña" icon="key-outline" onPress={handleSave} />}
    >
      {needsCurrent ? (
        <TextField
          label="Contraseña actual"
          value={form.current}
          onChangeText={set('current')}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          icon="lock-closed-outline"
          error={errors.current}
        />
      ) : (
        <AppText variant="caption" tone="secondary">
          Ingresaste con Google u otro proveedor: puedes crear una contraseña para entrar también con tu correo.
        </AppText>
      )}
      <TextField
        label="Nueva contraseña"
        value={form.password}
        onChangeText={set('password')}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        icon="key-outline"
        placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
        error={errors.password}
      />
      <TextField
        label="Repite la nueva contraseña"
        value={form.confirmPassword}
        onChangeText={set('confirmPassword')}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        icon="key-outline"
        error={errors.confirmPassword}
      />
      {errors.general ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={16} color={theme.colors.dangerText} />
          <AppText variant="caption" tone="danger" style={styles.flex}>
            {errors.general}
          </AppText>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
