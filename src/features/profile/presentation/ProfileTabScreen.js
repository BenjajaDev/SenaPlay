import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import LoadingOverlay from '../../../shared/ui/feedback/LoadingOverlay';
import ActionButton from '../../../shared/ui/ActionButton';
import SectionHeader from '../../../shared/ui/SectionHeader';
import SurfaceCard from '../../../shared/ui/SurfaceCard';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { supabase } from '../../../core/supabase/client';

const GENDERS = [
  { key: 'masculino', label: 'Masc.' },
  { key: 'femenino', label: 'Fem.' },
  { key: 'otro', label: 'Otro' },
];

export default function ProfileTabScreen({ user, onLogout, isLoggingOut, onRefreshUser, editTrigger }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const meta = user?.user_metadata || {};

  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBirthdate, setEditBirthdate] = useState('');
  const [editGender, setEditGender] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const lastEditTrigger = useRef(editTrigger ?? 0);

  const openEdit = useCallback(() => {
    const m = user?.user_metadata || {};
    setEditName(m.full_name || '');
    setEditPhone(m.phone || '');
    setEditBirthdate(m.birthdate || '');
    setEditGender(m.gender || '');
    setErrorMessage('');
    setEditVisible(true);
  }, [user]);

  useEffect(() => {
    const current = editTrigger ?? 0;
    if (current > lastEditTrigger.current) {
      openEdit();
    }
    lastEditTrigger.current = current;
  }, [editTrigger, openEdit]);

  const handleBirthdate = (text) => {
    const digits = text.replace(/\D/g, '');
    let formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
    if (digits.length > 4) formatted = formatted.slice(0, 5) + '/' + digits.slice(4);
    if (digits.length > 8) return;
    setEditBirthdate(formatted);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setErrorMessage('El nombre no puede estar vacio');
      return;
    }
    try {
      setIsSaving(true);
      setErrorMessage('');
      const { data, error } = await supabase.auth.updateUser({
        data: {
          ...(user?.user_metadata || {}),
          full_name: editName.trim(),
          phone: editPhone.trim() || null,
          birthdate: editBirthdate.trim() || null,
          gender: editGender || null,
        },
      });
      if (error) {
        setErrorMessage(error.message || 'No se pudo guardar.');
        return;
      }
      setEditVisible(false);
      if (data?.user) {
        onRefreshUser?.(data.user);
      } else {
        onRefreshUser?.();
      }
    } catch {
      setErrorMessage('No se pudo guardar el perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const uri = result.assets[0].uri;
    setIsUploadingAvatar(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileName = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        const { data: updateData } = await supabase.auth.updateUser({
          data: {
            ...(user?.user_metadata || {}),
            avatar_url: `${urlData.publicUrl}?t=${Date.now()}`,
          },
        });
        if (updateData?.user) {
          onRefreshUser?.(updateData.user);
        } else {
          onRefreshUser?.();
        }
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const displayName = meta.full_name || 'Usuario';
  const displayEmail = user?.email || '';
  const avatarUrl = meta.avatar_url || null;

  return (
    <View style={styles.container}>
      <SectionHeader title="Perfil" subtitle="Configura tu cuenta y preferencias" />

      <SurfaceCard style={styles.profileCard}>
        <Pressable onPress={handlePickAvatar} style={styles.avatarWrapper} disabled={isUploadingAvatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person-circle" size={80} color={theme.colors.primary} />
          )}
          <View style={styles.avatarBadge}>
            {isUploadingAvatar ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            )}
          </View>
        </Pressable>

        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{displayEmail}</Text>

        {meta.phone ? (
          <Text style={styles.metaItem}>
            <Ionicons name="call-outline" size={13} color={theme.colors.textSecondary} />
            {'  '}{meta.phone}
          </Text>
        ) : null}
        {meta.birthdate ? (
          <Text style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={theme.colors.textSecondary} />
            {'  '}{meta.birthdate}
          </Text>
        ) : null}
        {meta.gender ? (
          <Text style={styles.metaItem}>
            <Ionicons name="person-outline" size={13} color={theme.colors.textSecondary} />
            {'  '}{meta.gender.charAt(0).toUpperCase() + meta.gender.slice(1)}
          </Text>
        ) : null}
      </SurfaceCard>

      <SurfaceCard style={styles.optionCard}>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Notificaciones</Text>
          <Switch
            value
            onValueChange={() => {}}
            trackColor={{ true: theme.colors.primarySoft }}
            thumbColor={theme.colors.primary}
          />
        </View>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Tema oscuro</Text>
          <Switch
            value={theme.isDark}
            onValueChange={theme.toggleMode}
            trackColor={{ true: theme.colors.primarySoft }}
            thumbColor={theme.colors.primary}
          />
        </View>
      </SurfaceCard>

      <Pressable style={styles.editProfileBtn} onPress={openEdit}>
        <Ionicons name="create-outline" size={18} color="#FFFFFF" />
        <Text style={styles.editProfileText}>Editar mis datos</Text>
      </Pressable>

      <ActionButton
        label={isLoggingOut ? 'Cerrando...' : 'Cerrar sesion'}
        onPress={onLogout}
        disabled={isLoggingOut}
        gradientColors={[theme.colors.danger, theme.colors.danger]}
      />

      {/* Edit profile modal */}
      <Modal visible={editVisible} animationType="slide" transparent onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar perfil</Text>
              <Pressable onPress={() => setEditVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>Nombre completo</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                autoCapitalize="words"
                placeholder="Tu nombre completo"
                placeholderTextColor="#8D97A8"
              />

              <Text style={styles.modalLabel}>Telefono</Text>
              <TextInput
                style={styles.modalInput}
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                placeholder="+54 9 11 1234-5678"
                placeholderTextColor="#8D97A8"
              />

              <Text style={styles.modalLabel}>Fecha de nacimiento</Text>
              <TextInput
                style={styles.modalInput}
                value={editBirthdate}
                onChangeText={handleBirthdate}
                keyboardType="numeric"
                placeholder="DD/MM/AAAA"
                placeholderTextColor="#8D97A8"
                maxLength={10}
              />

              <Text style={styles.modalLabel}>Genero</Text>
              <View style={styles.genderRow}>
                {GENDERS.map((g) => (
                  <Pressable
                    key={g.key}
                    style={[styles.genderBtn, editGender === g.key && styles.genderBtnActive]}
                    onPress={() => setEditGender((prev) => (prev === g.key ? '' : g.key))}
                  >
                    <Text style={[styles.genderText, editGender === g.key && styles.genderTextActive]}>
                      {g.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}

              <Pressable
                style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                onPress={handleSaveProfile}
                disabled={isSaving}
              >
                <Text style={styles.saveBtnText}>{isSaving ? 'Guardando...' : 'Guardar cambios'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <LoadingOverlay visible={isSaving} label="Guardando cambios..." />
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { gap: 12 },
    profileCard: { alignItems: 'center', paddingVertical: 18, gap: 4 },
    avatarWrapper: {
      marginBottom: 8,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImage: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    avatarBadge: {
      position: 'absolute',
      bottom: 0,
      right: -4,
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.surface,
    },
    name: { fontSize: 17, color: theme.colors.textPrimary, fontWeight: '800' },
    email: { fontSize: 13, color: theme.colors.textSecondary },
    metaItem: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
    optionCard: { paddingHorizontal: 12, paddingVertical: 4 },
    optionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    optionLabel: { fontSize: 14, color: theme.colors.textPrimary, fontWeight: '600' },
    editProfileBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
    },
    editProfileText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    errorText: {
      color: theme.colors.danger,
      fontSize: 13,
      marginBottom: 10,
      textAlign: 'center',
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: 40,
      maxHeight: '85%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
    modalLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: '#344054',
      marginBottom: 8,
      marginTop: 4,
    },
    modalInput: {
      backgroundColor: '#F7EEFC',
      borderWidth: 1,
      borderColor: '#DCE3EE',
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 13,
      color: '#101828',
      fontSize: 15,
      marginBottom: 14,
    },
    genderRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    genderBtn: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: 'center',
      backgroundColor: '#F7EEFC',
      borderWidth: 1,
      borderColor: '#DCE3EE',
    },
    genderBtnActive: { backgroundColor: '#8F1EAE', borderColor: '#8F1EAE' },
    genderText: { fontSize: 13, fontWeight: '600', color: '#5B6475' },
    genderTextActive: { color: '#FFFFFF' },
    saveBtn: {
      backgroundColor: '#8F1EAE',
      borderRadius: 16,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 4,
    },
    saveBtnDisabled: { opacity: 0.65 },
    saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  });
}
