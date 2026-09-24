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
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../core/supabase/client';
import MessageDialog from '../../../shared/ui/feedback/MessageDialog';

// Pantalla final del flujo de recuperacion: el usuario ya valido el codigo
// (existe una sesion activa) y aqui define su nueva contrasena.
export default function ResetPasswordScreen({ onDone }) {
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalState, setModalState] = useState({
    visible: false,
    context: 'info',
    title: '',
    message: '',
  });

  const openModal = (config) => setModalState({ visible: true, ...config });
  const closeModal = () => setModalState((prev) => ({ ...prev, visible: false }));

  const handleSave = async () => {
    if (password.length < 6) {
      openModal({ context: 'validation', message: 'La contrasena debe tener al menos 6 caracteres.' });
      return;
    }
    if (password !== confirmPassword) {
      openModal({ context: 'validation', message: 'Las contrasenas no coinciden.' });
      return;
    }

    try {
      setIsSaving(true);
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        openModal({ context: 'auth-error', message: error.message });
        return;
      }

      // Cerramos la sesion de recuperacion para que el usuario entre con su nueva clave.
      await supabase.auth.signOut();
      openModal({ context: 'password-updated' });
    } catch {
      openModal({ context: 'auth-error', message: 'No se pudo actualizar la contrasena. Intentalo de nuevo.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleModalPrimary = () => {
    const done = modalState.context === 'password-updated';
    closeModal();
    if (done && onDone) onDone();
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
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.logoPlaceholder}>
              <Image
                source={require('../../../../assets/OratioLingo_png.png')}
                style={styles.brandLogoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brand}>SeñaPlay</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nueva contrasena</Text>
            <Text style={styles.cardSubtitle}>Define una contrasena nueva para tu cuenta.</Text>

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

            <Text style={styles.label}>Confirmar contrasena</Text>
            <View style={styles.inputRow}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="••••••••"
                placeholderTextColor="#8D97A8"
                secureTextEntry={!showConfirm}
                style={styles.inputWithIcon}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <Pressable onPress={() => setShowConfirm((p) => !p)} style={styles.eyeButton} hitSlop={10}>
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6B7280" />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                isSaving && styles.buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={isSaving}
            >
              <Text style={styles.buttonText}>{isSaving ? 'Guardando...' : 'Guardar contrasena'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <MessageDialog
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
  safeArea: { flex: 1, backgroundColor: '#F7EEFC' },
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
    color: '#8F1EAE',
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
  label: { color: '#344054', fontSize: 13, fontWeight: '700', marginBottom: 8 },
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
});
