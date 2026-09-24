import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';
import AppText from './AppText';
import Button from './Button';

/** Estado vacío / error recuperable con icono, texto y acción opcional. */
export default function EmptyState({ icon = 'hand-left-outline', title, message, actionLabel, onAction, style }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.container, style]} accessible accessibilityLabel={[title, message].filter(Boolean).join('. ')}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.primarySoft }]}>
        <Ionicons name={icon} size={30} color={theme.colors.primary} />
      </View>
      {title ? (
        <AppText variant="heading" align="center">
          {title}
        </AppText>
      ) : null}
      {message ? (
        <AppText variant="subtitle" tone="secondary" align="center">
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} fullWidth={false} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 16 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  action: { marginTop: 8, alignSelf: 'center' },
});
