import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';

export default function ProfileActionsModal({
  visible,
  onClose,
  onEditProfile,
  onLogout,
  isLoggingOut,
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel} onPress={() => {}}>
          <Text style={styles.title}>Perfil</Text>
          <Text style={styles.subtitle}>Elige una accion</Text>

          <Pressable style={styles.actionButton} onPress={onEditProfile}>
            <Ionicons name="person-circle-outline" size={20} color={theme.colors.textPrimary} />
            <Text style={styles.actionText}>Editar perfil</Text>
          </Pressable>

          <Pressable style={[styles.actionButton, styles.logoutButton]} onPress={onLogout} disabled={isLoggingOut}>
            <Ionicons name="log-out-outline" size={20} color="#B42318" />
            <Text style={styles.logoutText}>{isLoggingOut ? 'Cerrando...' : 'Cerrar sesion'}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(theme) {
  const isDark = theme.mode === 'dark';

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      paddingTop: 78,
      paddingHorizontal: 16,
    },
    panel: {
      width: 210,
      backgroundColor: isDark ? '#221C35' : '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? '#4B3B73' : '#E5E7EB',
      padding: 12,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.14,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    title: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    subtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 12,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? '#4B3B73' : '#E5E7EB',
      backgroundColor: isDark ? '#2A2341' : '#FFFFFF',
      paddingHorizontal: 10,
      paddingVertical: 10,
      marginBottom: 8,
    },
    actionText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    logoutButton: {
      borderColor: isDark ? '#7A3A4E' : '#FECACA',
      backgroundColor: isDark ? '#3A1E28' : '#FFF1F2',
      marginBottom: 0,
    },
    logoutText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.danger,
    },
  });
}
