import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useServices } from '../../../core/di/ServicesProvider';
import haptics from '../../../core/feedback/haptics';
import { AppText, Button, Card, SectionHeader, SegmentedControl, TextField, useFeedback } from '../../../shared/ui';
import BottomSheet from '../../../shared/ui/feedback/BottomSheet';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import usePreferences from './usePreferences';

const GENDERS = [
  { key: 'masculino', label: 'Masculino' },
  { key: 'femenino', label: 'Femenino' },
  { key: 'otro', label: 'Otro' },
];

function formatBirthdate(text) {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function PreferenceRow({ icon, label, description, value, onChange, theme }) {
  return (
    <View style={styles.prefRow}>
      <Ionicons name={icon} size={20} color={theme.colors.primary} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{label}</AppText>
        {description ? (
          <AppText variant="caption" tone="secondary">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
        thumbColor={theme.colors.surfaceRaised}
      />
    </View>
  );
}

/**
 * Perfil: datos del usuario, foto, preferencias y cierre de sesión.
 * Guardar la edición y cambiar la foto piden confirmación; ambas muestran
 * estado de carga y confirman el resultado con un aviso (toast).
 */
export default function ProfileTabScreen({ user, onLogout, onRefreshUser, editTrigger }) {
  const theme = useAppTheme();
  const { profile } = useServices();
  const { confirm, notify } = useFeedback();
  const { prefs, update: updatePrefs } = usePreferences();
  const meta = user?.user_metadata || {};

  const [editVisible, setEditVisible] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', birthdate: '', gender: '' });
  const [formError, setFormError] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const lastEditTrigger = useRef(editTrigger ?? 0);

  const openEdit = useCallback(() => {
    const m = user?.user_metadata || {};
    setForm({ fullName: m.full_name || '', phone: m.phone || '', birthdate: m.birthdate || '', gender: m.gender || '' });
    setFormError('');
    setEditVisible(true);
  }, [user]);

  // "Editar perfil" desde el menú de la cabecera abre directamente la hoja.
  useEffect(() => {
    const current = editTrigger ?? 0;
    if (current > lastEditTrigger.current) openEdit();
    lastEditTrigger.current = current;
  }, [editTrigger, openEdit]);

  const hasChanges = useMemo(
    () =>
      form.fullName.trim() !== (meta.full_name || '') ||
      form.phone.trim() !== (meta.phone || '') ||
      form.birthdate.trim() !== (meta.birthdate || '') ||
      form.gender !== (meta.gender || ''),
    [form, meta],
  );

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      setFormError('El nombre no puede estar vacío.');
      haptics.warning();
      return;
    }
    if (form.birthdate && form.birthdate.length !== 10) {
      setFormError('Usa el formato DD/MM/AAAA.');
      haptics.warning();
      return;
    }
    setFormError('');
    try {
      const saved = await confirm({
        title: '¿Guardar cambios?',
        message: 'Se actualizarán tus datos de perfil.',
        tone: 'info',
        icon: 'save-outline',
        confirmLabel: 'Guardar',
        onConfirm: async () => {
          const result = await profile.updateProfile(user, form);
          if (!result.ok) throw new Error(result.error);
          onRefreshUser?.(result.value || undefined);
        },
      });
      if (saved) {
        setEditVisible(false);
        notify({ tone: 'success', title: 'Perfil actualizado', message: 'Tus cambios se guardaron.' });
      }
    } catch (error) {
      setFormError(error.message);
    }
  };

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      notify({ tone: 'warning', title: 'Sin permiso', message: 'Permite el acceso a tus fotos para cambiar tu imagen.' });
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    const accepted = await confirm({
      title: '¿Usar esta foto?',
      message: 'Reemplazará tu foto de perfil actual.',
      tone: 'info',
      icon: 'image-outline',
      confirmLabel: 'Usar foto',
    });
    if (!accepted) return;

    setIsUploadingAvatar(true);
    const result = await profile.uploadAvatar(user, picked.assets[0].uri);
    setIsUploadingAvatar(false);
    if (result.ok) {
      onRefreshUser?.(result.value || undefined);
      notify({ tone: 'success', message: 'Foto de perfil actualizada.' });
    } else {
      notify({ tone: 'danger', title: 'No se pudo subir la foto', message: result.error });
    }
  };

  const avatarUrl = meta.avatar_url || null;
  const details = [
    meta.phone ? { icon: 'call-outline', text: meta.phone } : null,
    meta.birthdate ? { icon: 'calendar-outline', text: meta.birthdate } : null,
    meta.gender ? { icon: 'person-outline', text: meta.gender.charAt(0).toUpperCase() + meta.gender.slice(1) } : null,
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      <SectionHeader title="Perfil" subtitle="Tu cuenta y preferencias" />

      <Card variant="gradient" padding="xl" style={styles.profileCard}>
        <Pressable
          onPress={handlePickAvatar}
          disabled={isUploadingAvatar}
          accessibilityRole="button"
          accessibilityLabel="Cambiar foto de perfil"
          style={styles.avatarWrapper}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={[styles.avatar, { borderColor: theme.colors.primary }]} />
          ) : (
            <Ionicons name="person-circle" size={88} color={theme.colors.primary} />
          )}
          <View style={[styles.avatarBadge, { backgroundColor: theme.colors.primary, borderColor: theme.colors.surface }]}>
            {isUploadingAvatar ? (
              <ActivityIndicator size="small" color={theme.colors.primaryContrast} />
            ) : (
              <Ionicons name="camera" size={14} color={theme.colors.primaryContrast} />
            )}
          </View>
        </Pressable>
        <AppText variant="title" align="center">
          {meta.full_name || 'Usuario'}
        </AppText>
        <AppText variant="subtitle" tone="secondary" align="center">
          {user?.email || ''}
        </AppText>
        {details.map((item) => (
          <View key={item.icon} style={styles.detailRow}>
            <Ionicons name={item.icon} size={14} color={theme.colors.textSecondary} />
            <AppText variant="caption" tone="secondary">
              {item.text}
            </AppText>
          </View>
        ))}
      </Card>

      <Card padding="md" style={styles.prefs}>
        <PreferenceRow
          icon="moon-outline"
          label="Tema oscuro"
          value={theme.isDark}
          onChange={theme.toggleMode}
          theme={theme}
        />
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        <PreferenceRow
          icon="phone-portrait-outline"
          label="Vibración"
          description="Vibra al acertar, fallar o completar un nivel"
          value={prefs.haptics}
          onChange={(value) => {
            updatePrefs({ haptics: value });
            if (value) haptics.success();
          }}
          theme={theme}
        />
      </Card>

      <Button label="Editar mis datos" icon="create-outline" onPress={openEdit} />
      <Button label="Cerrar sesión" icon="log-out-outline" variant="danger" onPress={onLogout} />

      <BottomSheet
        visible={editVisible}
        title="Editar perfil"
        onClose={() => setEditVisible(false)}
        footer={<Button label="Guardar cambios" icon="checkmark" onPress={handleSave} disabled={!hasChanges} />}
      >
        <TextField
          label="Nombre completo"
          value={form.fullName}
          onChangeText={(fullName) => setForm((prev) => ({ ...prev, fullName }))}
          autoCapitalize="words"
          placeholder="Tu nombre completo"
          icon="person-outline"
          error={formError && !form.fullName.trim() ? formError : undefined}
        />
        <TextField
          label="Teléfono"
          value={form.phone}
          onChangeText={(phone) => setForm((prev) => ({ ...prev, phone }))}
          keyboardType="phone-pad"
          placeholder="+56 9 1234 5678"
          icon="call-outline"
        />
        <TextField
          label="Fecha de nacimiento"
          value={form.birthdate}
          onChangeText={(text) => setForm((prev) => ({ ...prev, birthdate: formatBirthdate(text) }))}
          keyboardType="numeric"
          placeholder="DD/MM/AAAA"
          icon="calendar-outline"
          maxLength={10}
        />
        <View style={styles.genderBlock}>
          <AppText variant="label">Género</AppText>
          <SegmentedControl
            options={GENDERS}
            value={form.gender}
            onChange={(gender) => setForm((prev) => ({ ...prev, gender: prev.gender === gender ? '' : gender }))}
          />
        </View>
        {formError && form.fullName.trim() ? (
          <View style={styles.errorRow} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle" size={16} color={theme.colors.dangerText} />
            <AppText variant="caption" tone="danger" style={styles.flex}>
              {formError}
            </AppText>
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  flex: { flex: 1 },
  profileCard: { alignItems: 'center', gap: 4 },
  avatarWrapper: { marginBottom: 8, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3 },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: -2,
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  prefs: { gap: 4 },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  divider: { height: 1 },
  genderBlock: { gap: 6 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
