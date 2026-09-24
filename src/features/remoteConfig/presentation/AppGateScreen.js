import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button } from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { useRemoteConfig } from './RemoteConfigProvider';

/**
 * Pantalla de bloqueo controlada remotamente:
 *  - maintenance     modo mantenimiento activado desde el panel web
 *  - updateRequired  la versión instalada es menor que la mínima exigida
 *
 * Ambas permiten reintentar (volver a consultar la configuración) para que el
 * usuario no tenga que cerrar la app cuando el mantenimiento termina.
 */
export default function AppGateScreen({ gate }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { config, refresh } = useRemoteConfig();
  const [checking, setChecking] = useState(false);
  const isMaintenance = gate === 'maintenance';

  const title = isMaintenance ? config.maintenance.title : 'Actualiza SeñaPlay';
  const message = isMaintenance
    ? config.maintenance.message
    : 'Esta versión ya no es compatible. Descarga la última versión para seguir aprendiendo.';

  const retry = async () => {
    setChecking(true);
    try {
      await refresh();
    } finally {
      setChecking(false);
    }
  };

  return (
    <LinearGradient
      {...theme.gradients.header}
      style={[styles.screen, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.card} accessibilityRole="alert">
        <View style={styles.iconWrap}>
          <Ionicons name={isMaintenance ? 'construct' : 'cloud-download'} size={40} color={theme.colors.primary} />
        </View>
        <AppText variant="title" align="center">
          {title}
        </AppText>
        <AppText variant="body" tone="secondary" align="center">
          {message}
        </AppText>
        {!isMaintenance && config.appVersion.storeUrl ? (
          <Button
            label="Actualizar ahora"
            icon="arrow-down-circle"
            onPress={() => WebBrowser.openBrowserAsync(config.appVersion.storeUrl)}
          />
        ) : null}
        <Button label="Reintentar" variant="secondary" icon="refresh" onPress={retry} loading={checking} />
      </View>
    </LinearGradient>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    screen: { flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing.xl },
    card: {
      gap: theme.spacing.md,
      padding: theme.spacing.xxl,
      borderRadius: theme.radius.xxl,
      backgroundColor: theme.colors.surfaceRaised,
      ...theme.elevation.lg,
    },
    iconWrap: {
      alignSelf: 'center',
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primarySoft,
      marginBottom: theme.spacing.xs,
    },
  });
}
