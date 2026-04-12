import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../backend/supabase';
import AdaptiveModal from '../components/AdaptiveModal';

export default function LoginScreen({ onGoToRegister, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [modalState, setModalState] = useState({
    visible: false,
    context: 'info',
    title: '',
    message: '',
  });
  const insets = useSafeAreaInsets();

  const socialLogins = [
    { id: 'google', icon: require('../../assets/google.png'), accent: '#FFFFFF' },
    { id: 'facebook', icon: require('../../assets/facebook.png'), accent: '#FFFFFF' },
    { id: 'x', icon: require('../../assets/x.png'), accent: '#FFFFFF' },
  ];

  const openModal = (config) => {
    setModalState({ visible: true, ...config });
  };

  const closeModal = () => {
    setModalState((prev) => ({ ...prev, visible: false }));
  };

  useEffect(() => {
    if (!resendCooldown) {
      return undefined;
    }

    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  const isEmailVerified = (user) => {
    return Boolean(user?.email_confirmed_at || user?.confirmed_at);
  };

  const handleModalPrimary = () => {
    const shouldEnterSystem = modalState.context === 'login-success';
    closeModal();

    if (shouldEnterSystem && onLoginSuccess) {
      onLoginSuccess();
    }
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      openModal({
        context: 'validation',
        message: 'Ingrese su correo',
      });
      return;
    }

    if (!password) {
      openModal({
        context: 'validation',
        message: 'Ingrese la contraseña',
      });
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        openModal({
          context: 'auth-error',
          message: error.message,
        });
        return;
      }

      if (!isEmailVerified(data?.user)) {
        await supabase.auth.signOut();
        openModal({
          context: 'email-verification-required',
        });
        return;
      }

      openModal({
        context: 'login-success',
      });
    } catch (err) {
      openModal({
        context: 'auth-error',
        message: 'No se pudo iniciar sesion. Intentalo de nuevo.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) {
      openModal({
        context: 'validation',
        message: `Espera ${resendCooldown}s para reenviar el correo.`,
      });
      return;
    }

    if (!email.trim()) {
      openModal({
        context: 'validation',
        message: 'Ingresa tu correo para reenviar la verificacion.',
      });
      return;
    }

    try {
      setIsResendingVerification(true);
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });

      if (error) {
        openModal({
          context: 'auth-error',
          message: error.message,
        });
        return;
      }

      openModal({
        context: 'email-verification-sent',
      });
      setResendCooldown(60);
    } catch (err) {
      openModal({
        context: 'auth-error',
        message: 'No se pudo reenviar el correo de verificacion.',
      });
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleRegister = () => {
    if (onGoToRegister) {
      onGoToRegister();
      return;
    }

    openModal({
      context: 'info',
      title: 'Registro',
      message: 'Aqui navegaras a la pantalla de registro.',
    });
  };

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
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
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
            <Text style={styles.subtitle}>
              Inicia sesión para continuar con tus niveles, progreso y práctica diaria.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>¡Bienvenido de nuevo!</Text>
            <Text style={styles.cardSubtitle}>Ingresa con tu correo y contraseña</Text>

            <Text style={styles.label}>Correo</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="tuemail@correo.com"
              placeholderTextColor="#8D97A8"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.inputRow}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="••••••••"
                placeholderTextColor="#8D97A8"
                secureTextEntry={!showPassword}
                style={styles.inputWithIcon}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eyeButton}
                hitSlop={10}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#6B7280"
                />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>{isLoading ? 'Entrando...' : 'Entrar'}</Text>
            </Pressable>

            <Pressable onPress={handleRegister} hitSlop={10}>
              <Text style={styles.registerText}>
                ¿No tienes cuenta? <Text style={styles.registerLink}>Regístrate</Text>
              </Text>
            </Pressable>

            <Pressable
              onPress={handleResendVerification}
              hitSlop={10}
              disabled={isResendingVerification || resendCooldown > 0}
            >
              <Text style={styles.verifyText}>
                {isResendingVerification
                  ? 'Reenviando verificacion...'
                  : resendCooldown > 0
                    ? `Reenviar disponible en ${resendCooldown}s`
                    : 'No te llego el correo? Reenviar verificacion'}
              </Text>
            </Pressable>

            <View style={styles.socialLogin}>
              {socialLogins.map((provider) => (
                <Pressable
                  key={provider.id}
                  style={({ pressed }) => [
                    styles.socialButton,
                    pressed && styles.socialButtonPressed,
                  ]}
                >
                  <View style={[styles.socialIcon, { backgroundColor: provider.accent }]}>
                    <Image source={provider.icon} style={styles.socialIconImage} resizeMode="contain" />
                  </View>
                </Pressable>
              ))}
            </View>

          </View>

          <View style={styles.footerNote}>
            <Text style={styles.footerText}>
              Todos los derechos reservados © 2024 OratioLingo. Hecho con ❤️.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AdaptiveModal
        visible={modalState.visible}
        context={modalState.context}
        title={modalState.title}
        message={modalState.message}
        onPrimaryPress={handleModalPrimary}
        onRequestClose={closeModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#EDE7F6',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'flex-start',
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
  hero: {
    marginBottom: 18,
    alignItems: 'center',
  },
  logoPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 20,
    backgroundColor: '#F7F7F1',
    borderWidth: 1,
    borderColor: '#D7DDE7',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 4,
    overflow: 'hidden',
  },
  brandLogoImage: {
    width: '84%',
    height: '84%',
  },
  brand: {
    color: '#7E57C2',
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: 10,
    textAlign: 'center',
  },
  title: {
    color: '#101828',
    fontSize: 20,
    lineHeight: 36,
    fontWeight: '800',
    marginBottom: 12,
    maxWidth: 340,
    textAlign: 'center',
  },
  subtitle: {
    color: '#5B6475',
    fontSize: 13,
    lineHeight: 22,
    maxWidth: 340,
    textAlign: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 18,
    gap: 10,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E3E8F1',
  },
  chipText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
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
  cardTitle: {
    color: '#101828',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  cardSubtitle: {
    color: '#667085',
    fontSize: 14,
    marginBottom: 18,
  },
  label: {
    color: '#344054',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#EDE7F6',
    borderWidth: 1,
    borderColor: '#DCE3EE',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#101828',
    fontSize: 15,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE7F6',
    borderWidth: 1,
    borderColor: '#DCE3EE',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  inputWithIcon: {
    flex: 1,
    color: '#101828',
    fontSize: 15,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  eyeButton: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  button: {
    backgroundColor: '#7E57C2',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    marginTop: 4,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  registerText: {
    color: '#667085',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 18,
  },
  registerLink: {
    color: '#7E57C2',
    fontWeight: '800',
  },
  verifyText: {
    color: '#7E57C2',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '700',
  },
  socialLogin: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  socialButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE3EE',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  socialButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  socialIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialIconImage: {
    width: 22,
    height: 22,
  },
  footerNote: {
    alignItems: 'center',
    marginTop: 18,
    paddingHorizontal: 10,
  },
  footerText: {
    color: '#7A8699',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});