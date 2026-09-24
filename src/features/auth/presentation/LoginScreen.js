import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useServices } from '../../../core/di/ServicesProvider';
import haptics from '../../../core/feedback/haptics';
import { AppText, Button, SegmentedControl, TextField, useFeedback } from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { validateEmail, validateLogin } from '../domain/validation';
import AuthLayout from './components/AuthLayout';
import useCooldown from './components/useCooldown';

WebBrowser.maybeCompleteAuthSession();

const MODES = [
  { key: 'login', label: 'Iniciar sesión' },
  { key: 'forgot', label: 'Recuperar' },
];

const SOCIAL = [
  { id: 'google', provider: 'google', label: 'Google', icon: require('../../../../assets/google.png') },
  { id: 'facebook', provider: 'facebook', label: 'Facebook', icon: require('../../../../assets/facebook.png') },
  { id: 'x', provider: 'twitter', label: 'X', icon: require('../../../../assets/x.png') },
];

/**
 * Inicio de sesión y recuperación de contraseña. Al iniciar sesión con
 * éxito no hace falta navegar: SessionProvider detecta la sesión y el
 * navegador raíz entra a la app.
 */
export default function LoginScreen({ onGoToRegister, onNeedPasswordReset }) {
  const theme = useAppTheme();
  const { auth } = useServices();
  const { runBlocking, notify, showMessage } = useFeedback();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [cooldown, setCooldown] = useCooldown();

  const fail = (fieldErrors) => {
    setErrors(fieldErrors);
    haptics.warning();
  };

  const handleLogin = async () => {
    const fieldErrors = validateLogin({ email, password });
    if (Object.keys(fieldErrors).length) return fail(fieldErrors);
    setErrors({});
    const result = await runBlocking('Entrando…', () => auth.signIn(email, password));
    if (!result.ok) {
      const needsVerification = result.cause?.code === 'email_not_verified';
      showMessage({ context: needsVerification ? 'email-verification-required' : 'auth-error', message: result.error });
    }
  };

  const handleForgot = async () => {
    const emailError = validateEmail(email);
    if (emailError) return fail({ email: emailError });
    setErrors({});
    const result = await runBlocking('Enviando código…', () => auth.requestPasswordReset(email));
    if (!result.ok) {
      showMessage({ context: 'auth-error', message: result.error });
      return;
    }
    onNeedPasswordReset?.(email.trim());
  };

  const handleResendVerification = async () => {
    const emailError = validateEmail(email);
    if (emailError) return fail({ email: emailError });
    const result = await runBlocking('Reenviando correo…', () => auth.resendSignupEmail(email));
    if (!result.ok) {
      showMessage({ context: 'auth-error', message: result.error });
      return;
    }
    setCooldown(60);
    notify({ tone: 'success', title: 'Correo reenviado', message: 'Revisa tu bandeja de entrada y spam.' });
  };

  const handleSocial = async (provider) => {
    const result = await auth.signInWithProvider(provider);
    if (!result.ok) showMessage({ context: 'auth-error', message: result.error });
  };

  return (
    <AuthLayout
      subtitle="Aprende Lengua de Señas Chilena jugando"
      footer={
        <Pressable onPress={onGoToRegister} hitSlop={10} accessibilityRole="link">
          <AppText variant="body" tone="secondary">
            ¿No tienes cuenta? <AppText variant="bodyStrong" tone="brand">Regístrate</AppText>
          </AppText>
        </Pressable>
      }
    >
      <SegmentedControl
        options={MODES}
        value={mode}
        onChange={(next) => {
          setMode(next);
          setErrors({});
        }}
      />

      <TextField
        label="Correo"
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        placeholder="tuemail@correo.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        error={errors.email}
      />

      {mode === 'login' ? (
        <>
          <TextField
            label="Contraseña"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            error={errors.password}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />
          <Button label="Entrar" icon="log-in-outline" iconPosition="right" onPress={handleLogin} />
          <Button
            label={cooldown > 0 ? `Reenviar verificación en ${cooldown}s` : '¿No te llegó el correo? Reenviar verificación'}
            variant="ghost"
            size="sm"
            onPress={handleResendVerification}
            disabled={cooldown > 0}
          />

          <View style={styles.divider}>
            <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
            <AppText variant="caption" tone="muted">
              o continúa con
            </AppText>
            <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
          </View>

          <View style={styles.socialRow}>
            {SOCIAL.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => handleSocial(item.provider)}
                accessibilityRole="button"
                accessibilityLabel={`Continuar con ${item.label}`}
                style={({ pressed }) => [
                  styles.social,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md },
                  pressed && styles.pressed,
                ]}
              >
                <Image source={item.icon} style={styles.socialIcon} resizeMode="contain" />
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          <AppText variant="subtitle" tone="secondary">
            Te enviaremos un código de 6 dígitos a tu correo para crear una nueva contraseña.
          </AppText>
          <Button label="Enviar código" icon="send-outline" iconPosition="right" onPress={handleForgot} />
        </>
      )}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flex: 1, height: 1 },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  social: { width: 64, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  socialIcon: { width: 26, height: 26 },
  pressed: { opacity: 0.7 },
});
