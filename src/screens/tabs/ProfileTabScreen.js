import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import ActionButton from '../../components/ui/ActionButton';
import SectionHeader from '../../components/ui/SectionHeader';
import SurfaceCard from '../../components/ui/SurfaceCard';

export default function ProfileTabScreen({ userEmail, onLogout, isLoggingOut }) {
  return (
    <View style={styles.container}>
      <SectionHeader
        title="Perfil"
        subtitle="Configura tu cuenta y preferencias"
      />

      <SurfaceCard style={styles.profileCard}>
        <Ionicons name="person-circle" size={72} color="#7E57C2" />
        <Text style={styles.name}>Usuario</Text>
        <Text style={styles.email}>{userEmail || 'correo@ejemplo.com'}</Text>
      </SurfaceCard>

      <SurfaceCard style={styles.optionCard}>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Notificaciones</Text>
          <Switch value onValueChange={() => {}} trackColor={{ true: '#C4B5FD' }} thumbColor="#7E57C2" />
        </View>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Tema oscuro</Text>
          <Switch value={false} onValueChange={() => {}} trackColor={{ true: '#C4B5FD' }} thumbColor="#7E57C2" />
        </View>
      </SurfaceCard>

      <ActionButton label="Editar perfil" variant="secondary" />

      <ActionButton
        label={isLoggingOut ? 'Cerrando...' : 'Cerrar sesion'}
        onPress={onLogout}
        disabled={isLoggingOut}
        style={styles.logoutButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  name: {
    marginTop: 4,
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '800',
  },
  email: {
    marginTop: 2,
    fontSize: 13,
    color: '#64748B',
  },
  optionCard: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  optionLabel: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
});
