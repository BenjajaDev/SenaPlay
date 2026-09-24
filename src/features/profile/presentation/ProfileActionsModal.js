import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';

/**
 * Menú desplegable del avatar (cabecera). "Cerrar sesión" no cierra aquí
 * mismo: delega en el shell, que pide confirmación antes de ejecutarlo.
 */
export default function ProfileActionsModal({ visible, onClose, onEditProfile, onLogout }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const actions = [
    { key: 'edit', icon: 'person-circle-outline', label: 'Editar perfil', onPress: onEditProfile, tone: 'primary' },
    { key: 'logout', icon: 'log-out-outline', label: 'Cerrar sesión', onPress: onLogout, tone: 'danger' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { paddingTop: insets.top + 64 }]} onPress={onClose} accessibilityLabel="Cerrar menú">
        <Pressable style={styles.panel} onPress={() => {}} accessibilityViewIsModal>
          <AppText variant="bodyStrong">Perfil</AppText>
          <AppText variant="caption" tone="secondary" style={styles.subtitle}>
            Elige una acción
          </AppText>
          {actions.map((action) => {
            const danger = action.tone === 'danger';
            return (
              <Pressable
                key={action.key}
                onPress={action.onPress}
                accessibilityRole="menuitem"
                accessibilityLabel={action.label}
                style={({ pressed }) => [styles.action, danger && styles.actionDanger, pressed && styles.pressed]}
              >
                <Ionicons name={action.icon} size={20} color={danger ? theme.colors.dangerText : theme.colors.textPrimary} />
                <AppText variant="bodyStrong" tone={danger ? 'danger' : 'primary'}>
                  {action.label}
                </AppText>
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(theme) {
  const { colors, spacing, radius } = theme;
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'flex-end', paddingHorizontal: spacing.lg },
    panel: {
      width: 230,
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...theme.elevation.lg,
    },
    subtitle: { marginBottom: spacing.md },
    action: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    actionDanger: { borderColor: colors.danger, backgroundColor: colors.dangerSoft, marginBottom: 0 },
    pressed: { opacity: 0.75 },
  });
}
