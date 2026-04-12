import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export default function ProfileActionsModal({
  visible,
  onClose,
  onEditProfile,
  onLogout,
  isLoggingOut,
}) {
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
            <Ionicons name="person-circle-outline" size={20} color="#334155" />
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 78,
    paddingHorizontal: 16,
  },
  panel: {
    width: 210,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  logoutButton: {
    borderColor: '#FECACA',
    backgroundColor: '#FFF1F2',
    marginBottom: 0,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B42318',
  },
});
