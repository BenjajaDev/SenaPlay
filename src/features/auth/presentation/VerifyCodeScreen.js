import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useServices } from '../../../core/di/ServicesProvider';
import haptics from '../../../core/feedback/haptics';
import { AppText, Button, useFeedback } from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import AuthLayout from './components/AuthLayout';
import useCooldown from './components/useCooldown';

const CODE_LENGTH = 6;

/**
 * Verificación del código OTP enviado al correo.
 *   purpose 'signup'   → confirma la cuenta recién creada
 *   purpose 'recovery' → valida el código para cambiar la contraseña
 *
 * Las casillas son visuales; un TextInput oculto captura el código (así
 * funciona pegar el código desde el correo y el autocompletado de SMS/email).
 */
export default function VerifyCodeScreen({ email, purpose = 'signup', onBack, onVerified }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { auth } = useServices();
  const { runBlocking, notify, showMessage } = useFeedback();
  const inputRef = useRef(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useCooldown();

  const handleVerify = async () => {
    if (code.length !== CODE_LENGTH) {
      setError(`Ingresa los ${CODE_LENGTH} dígitos del código.`);
      haptics.warning();
      return;
    }
    setError(null);
    const result = await runBlocking('Verificando…', () => auth.verifyCode({ email, code, purpose }));
    if (!result.ok) {
      setError(result.error);
      haptics.error();
      return;
    }
    haptics.success();
    onVerified?.();
  };

  const handleResend = async () => {
    const result = await runBlocking('Reenviando código…', () =>
      purpose === 'recovery' ? auth.requestPasswordReset(email) : auth.resendSignupEmail(email),
    );
    if (!result.ok) {
      showMessage({ context: 'auth-error', message: result.error });
      return;
    }
    setCooldown(60);
    notify({ tone: 'success', title: 'Código reenviado', message: 'Revisa tu correo (también spam).' });
  };

  const digits = code.padEnd(CODE_LENGTH).split('');

  return (
    <AuthLayout title={purpose === 'recovery' ? 'Recupera tu cuenta' : 'Verifica tu correo'}>
      <AppText variant="subtitle" tone="secondary">
        Escribe el código de {CODE_LENGTH} dígitos que enviamos a{' '}
        <AppText variant="bodyStrong" tone="brand">
          {email}
        </AppText>
      </AppText>

      <Pressable
        style={styles.codeRow}
        onPress={() => inputRef.current?.focus()}
        accessibilityRole="button"
        accessibilityLabel={`Código: ${code.length} de ${CODE_LENGTH} dígitos ingresados. Toca para escribir.`}
      >
        {digits.map((digit, index) => (
          <View
            key={index}
            style={[
              styles.cell,
              code.length === index && styles.cellActive,
              digit.trim() && styles.cellFilled,
              error && styles.cellError,
            ]}
          >
            <AppText variant="title">{digit.trim()}</AppText>
          </View>
        ))}
      </Pressable>
      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={(text) => {
          setError(null);
          setCode(text.replace(/\D/g, '').slice(0, CODE_LENGTH));
        }}
        keyboardType="number-pad"
        maxLength={CODE_LENGTH}
        autoFocus
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        style={styles.hiddenInput}
        caretHidden
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}

      <Button label="Verificar" icon="shield-checkmark-outline" onPress={handleVerify} disabled={code.length !== CODE_LENGTH} />
      <Button
        label={cooldown > 0 ? `Reenviar código en ${cooldown}s` : '¿No te llegó? Reenviar código'}
        variant="ghost"
        size="sm"
        onPress={handleResend}
        disabled={cooldown > 0}
      />
      <Button label="Volver" variant="secondary" icon="arrow-back" onPress={onBack} />
    </AuthLayout>
  );
}

function createStyles(theme) {
  const { colors, radius } = theme;
  return StyleSheet.create({
    codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
    cell: {
      flex: 1,
      aspectRatio: 0.82,
      maxWidth: 52,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSunken,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellActive: { borderColor: colors.primary, borderWidth: 2 },
    cellFilled: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    cellError: { borderColor: colors.danger },
    hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  });
}
