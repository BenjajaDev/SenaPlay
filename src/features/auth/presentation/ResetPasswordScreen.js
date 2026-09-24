import { useState } from 'react';
import { useServices } from '../../../core/di/ServicesProvider';
import haptics from '../../../core/feedback/haptics';
import { AppText, Button, TextField, useFeedback } from '../../../shared/ui';
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '../domain/validation';
import AuthLayout from './components/AuthLayout';

/**
 * Último paso de la recuperación: el código ya se validó (hay sesión
 * temporal) y aquí se define la nueva contraseña. Al terminar se cierra esa
 * sesión para que el usuario ingrese con la clave nueva.
 */
export default function ResetPasswordScreen({ onDone }) {
  const { auth } = useServices();
  const { runBlocking, showMessage } = useFeedback();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});

  const handleSave = async () => {
    const fieldErrors = validateNewPassword({ password, confirmPassword });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) {
      haptics.warning();
      return;
    }
    const result = await runBlocking('Guardando contraseña…', async () => {
      const updated = await auth.updatePassword(password);
      if (updated.ok) await auth.signOut();
      return updated;
    });
    if (!result.ok) {
      showMessage({ context: 'auth-error', message: result.error });
      return;
    }
    await showMessage({ context: 'password-updated' });
    onDone?.();
  };

  return (
    <AuthLayout title="Nueva contraseña">
      <AppText variant="subtitle" tone="secondary">
        Elige una contraseña nueva de al menos {MIN_PASSWORD_LENGTH} caracteres.
      </AppText>
      <TextField
        label="Nueva contraseña"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        error={errors.password}
      />
      <TextField
        label="Confirmar contraseña"
        icon="lock-closed-outline"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="••••••••"
        secureTextEntry
        autoCapitalize="none"
        error={errors.confirmPassword}
        returnKeyType="done"
        onSubmitEditing={handleSave}
      />
      <Button label="Guardar contraseña" icon="checkmark" onPress={handleSave} />
    </AuthLayout>
  );
}
