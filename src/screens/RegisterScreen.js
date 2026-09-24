import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
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
import LoadingOverlay from '../components/LoadingOverlay';

const GENDERS = [
  { key: 'masculino', label: 'Masculino' },
  { key: 'femenino', label: 'Femenino' },
  { key: 'otro', label: 'Otro' },
];

export default function RegisterScreen({ onGoToLogin, onNeedVerification }) {
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fechaNac, setFechaNac] = useState('');
  const [genero, setGenero] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [modalState, setModalState] = useState({
    visible: false,
    context: 'info',
    title: '',
    message: '',
  });

  const openModal = (config) => setModalState({ visible: true, ...config });
  const closeModal = () => setModalState((prev) => ({ ...prev, visible: false }));

  const handleBirthdate = (text) => {
    const digits = text.replace(/\D/g, '');
    let formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
    if (digits.length > 4) formatted = formatted.slice(0, 5) + '/' + digits.slice(4);
    if (digits.length > 8) return;
    setFechaNac(formatted);
  };

  const handleRegister = async () => {
    if (!nombre.trim()) {
      openModal({ context: 'validation', message: 'Ingrese su nombre completo' });
      return;
    }
    if (!email.trim()) {
      openModal({ context: 'validation', message: 'Ingrese su correo' });
      return;
    }
    if (!password) {
      openModal({ context: 'validation', message: 'Ingrese la contraseña' });
      return;
    }
    if (password.length < 6) {
      openModal({ context: 'validation', message: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }
    if (password !== confirmPassword) {
      openModal({ context: 'validation', message: 'Las contraseñas no coinciden' });
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: nombre.trim(),
            phone: telefono.trim() || null,
            birthdate: fechaNac.trim() || null,
            gender: genero || null,
          },
        },
      });

      if (error) {
        openModal({ context: 'auth-error', message: error.message });
        return;
      }

      if (onNeedVerification) onNeedVerification(email.trim());
    } catch {
      openModal({
        context: 'auth-error',
        message: 'No se pudo completar el registro. Intentalo de nuevo.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalPrimary = () => {
    const shouldGoToLogin =
      modalState.context === 'register-success' ||
      modalState.context === 'email-verification-sent';
    closeModal();
    if (shouldGoToLogin && onGoToLogin) onGoToLogin();
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
            <Text style={styles.brand}>SeñaPlay</Text>
            <Text style={styles.subtitle}>Crea tu cuenta para empezar tu aprendizaje.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Crear cuenta</Text>
            <Text style={styles.cardSubtitle}>Completa los datos para registrarte</Text>



            <Text style={styles.label}>Nombre completo *</Text>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="Tu nombre y apellido"
              placeholderTextColor="#8D97A8"
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
            />

            <Text style={styles.label}>Correo *</Text>
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

            <Text style={styles.label}>Teléfono</Text>
            <TextInput
              keyboardType="phone-pad"
              placeholder="+54 9 11 1234-5678"
              placeholderTextColor="#8D97A8"
              style={styles.input}
              value={telefono}
              onChangeText={setTelefono}
            />

            <Text style={styles.label}>Fecha de nacimiento (opcional)</Text>
            <TextInput
              keyboardType="numeric"
              placeholder="DD/MM/AAAA"
              placeholderTextColor="#8D97A8"
              style={styles.input}
              value={fechaNac}
              onChangeText={handleBirthdate}
              maxLength={10}
            />

            <Text style={styles.label}>Género (opcional)</Text>
            <View style={styles.genderRow}>
              {GENDERS.map((g) => (
                <Pressable
                  key={g.key}
                  style={[styles.genderBtn, genero === g.key && styles.genderBtnActive]}
                  onPress={() => setGenero((prev) => (prev === g.key ? '' : g.key))}
                >
                  <Text style={[styles.genderText, genero === g.key && styles.genderTextActive]}>
                    {g.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 4 }]}>Contraseña *</Text>
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

            <Text style={styles.label}>Confirmar contraseña *</Text>
            <View style={styles.inputRow}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="••••••••"
                placeholderTextColor="#8D97A8"
                secureTextEntry={!showConfirmPassword}
                style={styles.inputWithIcon}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <Pressable onPress={() => setShowConfirmPassword((p) => !p)} style={styles.eyeButton} hitSlop={10}>
                <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6B7280" />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>{isLoading ? 'Registrando...' : 'Registrar'}</Text>
            </Pressable>

            <Pressable onPress={onGoToLogin} hitSlop={10}>
              <Text style={styles.registerText}>
                {'Ya tienes cuenta? '}<Text style={styles.registerLink}>Inicia sesion</Text>
              </Text>
            </Pressable>
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

      <LoadingOverlay visible={isLoading} label="Creando tu cuenta..." />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F7EEFC' },
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
    width: 120,
    height: 120,
    borderRadius: 20,
    backgroundColor: '#F7F7F1',
    borderWidth: 1,
    borderColor: '#D7DDE7',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 4,
    overflow: 'hidden',
  },
  brandLogoImage: { width: '84%', height: '84%' },
  brand: {
    color: '#8F1EAE',
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#5B6475',
    fontSize: 13,
    lineHeight: 22,
    maxWidth: 340,
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
  cardTitle: { color: '#101828', fontSize: 22, fontWeight: '800', marginBottom: 6 },
  cardSubtitle: { color: '#667085', fontSize: 14, marginBottom: 18 },
  label: { color: '#344054', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: {
    backgroundColor: '#F7EEFC',
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
    backgroundColor: '#F7EEFC',
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
  genderRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  genderBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F7EEFC',
    borderWidth: 1,
    borderColor: '#DCE3EE',
  },
  genderBtnActive: {
    backgroundColor: '#8F1EAE',
    borderColor: '#8F1EAE',
  },
  genderText: { fontSize: 13, fontWeight: '600', color: '#5B6475' },
  genderTextActive: { color: '#FFFFFF' },
  button: {
    backgroundColor: '#8F1EAE',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    marginTop: 4,
  },
  buttonPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  registerText: { color: '#667085', fontSize: 14, textAlign: 'center', marginTop: 18 },
  registerLink: { color: '#8F1EAE', fontWeight: '800' },
});
