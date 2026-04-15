import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import ActionButton from '../../components/ui/ActionButton';
import SectionHeader from '../../components/ui/SectionHeader';
import SurfaceCard from '../../components/ui/SurfaceCard';
import { useAppTheme } from '../../theme/ThemeProvider';

export default function ProfileTabScreen({ userEmail, onLogout, isLoggingOut }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <SectionHeader
        title="Perfil"
        subtitle="Configura tu cuenta y preferencias"
      />

      <SurfaceCard style={styles.profileCard}>
        <Ionicons name="person-circle" size={72} color={theme.colors.primary} />
        <Text style={styles.name}>Usuario</Text>
        <Text style={styles.email}>{userEmail || 'correo@ejemplo.com'}</Text>
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

function createStyles(theme) {
  return StyleSheet.create({
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
      color: theme.colors.textPrimary,
      fontWeight: '800',
    },
    email: {
      marginTop: 2,
      fontSize: 13,
      color: theme.colors.textSecondary,
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
      borderBottomColor: theme.colors.border,
    },
    optionLabel: {
      fontSize: 14,
      color: theme.colors.textPrimary,
      fontWeight: '600',
    },
    logoutButton: {
      backgroundColor: theme.colors.danger,
      borderColor: theme.colors.danger,
    },
  });
}
