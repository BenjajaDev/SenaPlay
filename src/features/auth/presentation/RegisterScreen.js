import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useServices } from '../../../core/di/ServicesProvider';
import haptics from '../../../core/feedback/haptics';
import { AppText, Button, SegmentedControl, TextField, useFeedback } from '../../../shared/ui';
import { formatBirthdateInput, MIN_PASSWORD_LENGTH, validateRegistration } from '../domain/validation';
import AuthLayout from './components/AuthLayout';

const GENDERS = [
  { key: 'masculino', label: 'Masculino' },
  { key: 'femenino', label: 'Femenino' },
  { key: 'otro', label: 'Otro' },
];

/** Registro de cuenta. Los errores se muestran junto a cada campo. */
export default function RegisterScreen({ onGoToLogin, onNeedVerification }) {
  const { auth } = useServices();
  const { runBlocking, showMessage } = useFeedback();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    birthdate: '',
    gender: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});

  const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleRegister = async () => {
    const fieldErrors = validateRegistration(form);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) {
      haptics.warning();
      return;
    }
    const result = await runBlocking('Creando tu cuenta…', () =>
      auth.signUp({
        email: form.email,
        password: form.password,
        profile: { fullName: form.fullName, phone: form.phone, birthdate: form.birthdate, gender: form.gender },
      }),
    );
    if (!result.ok) {
      showMessage({ context: 'auth-error', message: result.error });
      return;
    }
    onNeedVerification?.(form.email.trim());
  };

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Crea tu cuenta para empezar a aprender"
      footer={
        <Pressable onPress={onGoToLogin} hitSlop={10} accessibilityRole="link">
          <AppText variant="body" tone="secondary">
            ¿Ya tienes cuenta? <AppText variant="bodyStrong" tone="brand">Inicia sesión</AppText>
          </AppText>
        </Pressable>
      }
    >
      <TextField label="Nombre completo *" icon="person-outline" value={form.fullName} onChangeText={set('fullName')} placeholder="Tu nombre y apellido" autoCapitalize="words" autoComplete="name" error={errors.fullName} />
      <TextField label="Correo *" icon="mail-outline" value={form.email} onChangeText={set('email')} placeholder="tuemail@correo.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" error={errors.email} />
      <TextField label="Teléfono" icon="call-outline" value={form.phone} onChangeText={set('phone')} placeholder="+56 9 1234 5678" keyboardType="phone-pad" autoComplete="tel" />
      <TextField
        label="Fecha de nacimiento"
        icon="calendar-outline"
        value={form.birthdate}
        onChangeText={(text) => set('birthdate')(formatBirthdateInput(text))}
        placeholder="DD/MM/AAAA"
        keyboardType="numeric"
        maxLength={10}
        error={errors.birthdate}
        helper="Opcional"
      />
      <View style={styles.group}>
        <AppText variant="label">Género (opcional)</AppText>
        <SegmentedControl options={GENDERS} value={form.gender} onChange={(gender) => set('gender')(form.gender === gender ? '' : gender)} />
      </View>
      <TextField
        label="Contraseña *"
        icon="lock-closed-outline"
        value={form.password}
        onChangeText={set('password')}
        placeholder="••••••••"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        error={errors.password}
        helper={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
      />
      <TextField
        label="Confirmar contraseña *"
        icon="lock-closed-outline"
        value={form.confirmPassword}
        onChangeText={set('confirmPassword')}
        placeholder="••••••••"
        secureTextEntry
        autoCapitalize="none"
        error={errors.confirmPassword}
        returnKeyType="done"
        onSubmitEditing={handleRegister}
      />
      <Button label="Crear cuenta" icon="person-add-outline" onPress={handleRegister} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
});
