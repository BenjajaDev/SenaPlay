import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../backend/supabase';
import AdaptiveModal from '../components/AdaptiveModal';

const CODE_LENGTH = 6;

// Pantalla reutilizable para verificar un codigo OTP enviado al correo.
// purpose === 'signup'   -> confirma la cuenta recien creada
// purpose === 'recovery' -> valida el codigo para cambiar la contrasena
export default function VerifyCodeScreen({ email, purpose = 'signup', onBack, onVerified }) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [modalState, setModalState] = useState({
    visible: false,
    context: 'info',
    title: '',
    message: '',
  });

  const openModal = (config) => setModalState({ visible: true, ...config });
  const closeModal = () => setModalState((prev) => ({ ...prev, visible: false }));

  useEffect(() => {
    if (!resendCooldown) return undefined;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleVerify = async () => {
    if (code.length !== CODE_LENGTH) {
      openModal({ context: 'validation', message: `Ingresa el codigo de ${CODE_LENGTH} digitos.` });
      return;
    }

    try {
      setIsVerifying(true);
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: purpose === 'recovery' ? 'recovery' : 'signup',
      });

      if (error) {
        openModal({ context: 'auth-error', message: 'El codigo es incorrecto o expiro. Intentalo de nuevo.' });
        return;
      }

      if (onVerified) onVerified(data);
    } catch {
      openModal({ context: 'auth-error', message: 'No se pudo verificar el codigo. Intentalo de nuevo.' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      setIsResending(true);
      const { error } =
        purpose === 'recovery'
          ? await supabase.auth.resetPasswordForEmail(email)
          : await supabase.auth.resend({ type: 'signup', email });

      if (error) {
        openModal({ context: 'auth-error', message: error.message });
        return;
      }

      openModal({ context: 'email-verification-sent', message: 'Te reenviamos un nuevo codigo a tu correo.' });
      setResendCooldown(60);
      setCode('');
    } catch {
      openModal({ context: 'auth-error', message: 'No se pudo reenviar el codigo. Intentalo de nuevo.' });
    } finally {
      setIsResending(false);
    }
  };

  const digits = code.padEnd(CODE_LENGTH).split('');

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.backgroundAccentTop} />
      <View style={styles.backgroundAccentBottom} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: 24 + insets.top, paddingBottom: 24 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.logoPlaceholder}>
              <Image
                source={require('../../assets/OratioLingo_png.png')}
                style={styles.brandLogoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brand}>OratioLingo</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Verifica tu correo</Text>
            <Text style={styles.cardSubtitle}>
              {`Escribe el codigo de ${CODE_LENGTH} digitos que enviamos a `}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>

            {/* Campo real (oculto) que captura el codigo */}
            <Pressable style={styles.codeRow} onPress={() => inputRef.current?.focus()}>
              {digits.map((d, i) => (
                <View
                  key={i}
                  style={[styles.codeCell, code.length === i && styles.codeCellActive]}
                >
                  <Text style={styles.codeCellText}>{d.trim()}</Text>
                </View>
              ))}
            </Pressable>

            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, CODE_LENGTH))}
              keyboardType="number-pad"
              maxLength={CODE_LENGTH}
              autoFocus
              style={styles.hiddenInput}
              caretHidden
            />

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                isVerifying && styles.buttonDisabled,
              ]}
              onPress={handleVerify}
              disabled={isVerifying}
            >
              <Text style={styles.buttonText}>{isVerifying ? 'Verificando...' : 'Verificar'}</Text>
            </Pressable>

            <Pressable
              onPress={handleResend}
              hitSlop={10}
              disabled={isResending || resendCooldown > 0}
            >
              <Text style={styles.resendText}>
                {isResending
                  ? 'Reenviando...'
                  : resendCooldown > 0
                    ? `Reenviar disponible en ${resendCooldown}s`
                    : 'No te llego el codigo? Reenviar'}
              </Text>
            </Pressable>

            <Pressable onPress={onBack} hitSlop={10} style={styles.backRow}>
              <Ionicons name="arrow-back" size={16} color="#7E57C2" />
              <Text style={styles.backText}>Volver</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AdaptiveModal
        visible={modalState.visible}
        context={modalState.context}
        title={modalState.title}
        message={modalState.message}
        onPrimaryPress={closeModal}
        onRequestClose={closeModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#EDE7F6' },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  backgroundAccentTop: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(66, 133, 244, 0.14)',
  },
  backgroundAccentBottom: {
    position: 'absolute',
    bottom: -90,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(31, 41, 55, 0.08)',
  },
  hero: { marginBottom: 18, alignItems: 'center' },
  logoPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 20,
    backgroundColor: '#F7F7F1',
    borderWidth: 1,
    borderColor: '#D7DDE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  brandLogoImage: { width: '84%', height: '84%' },
  brand: {
    color: '#7E57C2',
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fbfbfb',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E6EBF3',
    shadowColor: '#0F172A',
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 5,
  },
  cardTitle: { color: '#101828', fontSize: 22, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  cardSubtitle: { color: '#667085', fontSize: 14, marginBottom: 22, textAlign: 'center', lineHeight: 20 },
  emailHighlight: { color: '#7E57C2', fontWeight: '700' },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 22 },
  codeCell: {
    flex: 1,
    aspectRatio: 0.82,
    borderRadius: 14,
    backgroundColor: '#EDE7F6',
    borderWidth: 1.5,
    borderColor: '#DCE3EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeCellActive: { borderColor: '#7E57C2', backgroundColor: '#FFFFFF' },
  codeCellText: { fontSize: 24, fontWeight: '800', color: '#101828' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  button: {
    backgroundColor: '#7E57C2',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  buttonPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  resendText: { color: '#7E57C2', fontSize: 13, textAlign: 'center', marginTop: 16, fontWeight: '700' },
  backRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  backText: { color: '#7E57C2', fontSize: 14, fontWeight: '700' },
});
