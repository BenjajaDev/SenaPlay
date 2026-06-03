import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
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

WebBrowser.maybeCompleteAuthSession();

const TABS = [
  { key: 'login', label: 'Iniciar sesion' },
  { key: 'forgot', label: 'Recuperar contrasena' },
];

const SOCIAL = [
  { id: 'google', provider: 'google', icon: require('../../assets/google.png') },
  { id: 'facebook', provider: 'facebook', icon: require('../../assets/facebook.png') },
  { id: 'x', provider: 'twitter', icon: require('../../assets/x.png') },
];

export default function LoginScreen({ onGoToRegister, onLoginSuccess }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState('');
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
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

  const isEmailVerified = (user) => Boolean(user?.email_confirmed_at || user?.confirmed_at);

  const handleModalPrimary = () => {
    const shouldEnterSystem = modalState.context === 'login-success';
    closeModal();
    if (shouldEnterSystem && onLoginSuccess) onLoginSuccess();
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      openModal({ context: 'validation', message: 'Ingrese su correo' });
      return;
    }
    if (!password) {
      openModal({ context: 'validation', message: 'Ingrese la contrasena' });
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        openModal({ context: 'auth-error', message: error.message });
        return;
      }

      if (!isEmailVerified(data?.user)) {
        await supabase.auth.signOut();
        openModal({ context: 'email-verification-required' });
        return;
      }

      openModal({ context: 'login-success' });
    } catch {
      openModal({ context: 'auth-error', message: 'No se pudo iniciar sesion. Intentalo de nuevo.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      openModal({ context: 'validation', message: 'Ingresa tu correo para recibir el enlace de recuperacion.' });
      return;
    }

    try {
      setIsSendingReset(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Linking.createURL('/auth/reset-password'),
      });

      if (error) {
        openModal({ context: 'auth-error', message: error.message });
        return;
      }

      openModal({
        context: 'email-verification-sent',
        message: 'Te enviamos un enlace de recuperacion a tu correo. Revisalo y sigue las instrucciones.',
      });
    } catch {
      openModal({ context: 'auth-error', message: 'No se pudo enviar el enlace. Intentalo de nuevo.' });
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    try {
      setIsSocialLoading(provider);
      const redirectTo = Linking.createURL('/auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (error) {
        openModal({ context: 'auth-error', message: error.message });
        return;
      }

      if (!data?.url) return;

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success' && result.url) {
        const url = result.url;
        const hash = url.split('#')[1] || '';
        const params = new URLSearchParams(hash.includes('=') ? hash : url.split('?')[1] || '');
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
      }
    } catch {
      openModal({ context: 'auth-error', message: 'No se pudo iniciar sesion con este proveedor.' });
    } finally {
      setIsSocialLoading('');
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) {
      openModal({ context: 'validation', message: `Espera ${resendCooldown}s para reenviar el correo.` });
      return;
    }
    if (!email.trim()) {
      openModal({ context: 'validation', message: 'Ingresa tu correo para reenviar la verificacion.' });
      return;
    }

    try {
      setIsResendingVerification(true);
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
      if (error) {
        openModal({ context: 'auth-error', message: error.message });
        return;
      }
      openModal({ context: 'email-verification-sent' });
      setResendCooldown(60);
    } catch {
      openModal({ context: 'auth-error', message: 'No se pudo reenviar el correo de verificacion.' });
    } finally {
      setIsResendingVerification(false);
    }
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
              Inicia sesion para continuar con tus niveles, progreso y practica diaria.
            </Text>
          </View>

          <View style={styles.card}>
            {/* Tab switcher */}
            <View style={styles.tabRow}>
              {TABS.map((tab) => (
                <Pressable
                  key={tab.key}
                  style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {activeTab === 'login' ? (
              <>
                <Text style={styles.cardSubtitle}>Ingresa con tu correo y contrasena</Text>

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

                <Text style={styles.label}>Contrasena</Text>
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
                  <Pressable onPress={() => setShowPassword((p) => !p)} style={styles.eyeButton} hitSlop={10}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6B7280" />
                  </Pressable>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    pressed && styles.buttonPressed,
                    isLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleLogin}
                  disabled={isLoading}
                >
                  <Text style={styles.buttonText}>{isLoading ? 'Entrando...' : 'Entrar'}</Text>
                </Pressable>

                <Pressable onPress={onGoToRegister} hitSlop={10}>
                  <Text style={styles.linkText}>
                    {'No tienes cuenta? '}<Text style={styles.linkHighlight}>Registrate</Text>
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

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>o continua con</Text>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.socialRow}>
                  {SOCIAL.map((s) => (
                    <Pressable
                      key={s.id}
                      style={({ pressed }) => [
                        styles.socialButton,
                        pressed && styles.socialButtonPressed,
                        isSocialLoading === s.provider && styles.buttonDisabled,
                      ]}
                      onPress={() => handleSocialLogin(s.provider)}
                      disabled={!!isSocialLoading}
                    >
                      <View style={styles.socialIcon}>
                        <Image source={s.icon} style={styles.socialIconImage} resizeMode="contain" />
                      </View>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.cardSubtitle}>
                  Te enviaremos un enlace a tu correo para restablecer tu contrasena.
                </Text>

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

                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    pressed && styles.buttonPressed,
                    isSendingReset && styles.buttonDisabled,
                  ]}
                  onPress={handleForgotPassword}
                  disabled={isSendingReset}
                >
                  <Text style={styles.buttonText}>
                    {isSendingReset ? 'Enviando...' : 'Enviar enlace de recuperacion'}
                  </Text>
                </Pressable>

                <Pressable onPress={() => setActiveTab('login')} hitSlop={10}>
                  <Text style={styles.linkText}>
                    {'Volver a '}<Text style={styles.linkHighlight}>Iniciar sesion</Text>
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.footerNote}>
            <Text style={styles.footerText}>
              Todos los derechos reservados 2024 OratioLingo.
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
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#EDE7F6' },
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
  hero: { marginBottom: 18, alignItems: 'center' },
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
  brandLogoImage: { width: '84%', height: '84%' },
  brand: {
    color: '#7E57C2',
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: { color: '#5B6475', fontSize: 13, lineHeight: 22, maxWidth: 340, textAlign: 'center' },
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
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#EDE7F6',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: '#7E57C2' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#7E57C2' },
  tabTextActive: { color: '#FFFFFF' },
  cardSubtitle: { color: '#667085', fontSize: 14, marginBottom: 18 },
  label: { color: '#344054', fontSize: 13, fontWeight: '700', marginBottom: 8 },
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
  eyeButton: { paddingHorizontal: 6, paddingVertical: 6 },
  button: {
    backgroundColor: '#7E57C2',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    marginTop: 4,
  },
  buttonPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  linkText: { color: '#667085', fontSize: 14, textAlign: 'center', marginTop: 18 },
  linkHighlight: { color: '#7E57C2', fontWeight: '800' },
  verifyText: { color: '#7E57C2', fontSize: 13, textAlign: 'center', marginTop: 10, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E6EBF3' },
  dividerText: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 14 },
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
  socialButtonPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  socialIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  socialIconImage: { width: 22, height: 22 },
  footerNote: { alignItems: 'center', marginTop: 18, paddingHorizontal: 10 },
  footerText: { color: '#7A8699', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
