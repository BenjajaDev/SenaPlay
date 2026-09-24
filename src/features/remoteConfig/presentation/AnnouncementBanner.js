import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { jsonStorage, storageKey } from '../../../core/storage/jsonStorage';
import { AppText, IconButton } from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { useRemoteConfig } from './RemoteConfigProvider';

const DISMISSED_KEY = storageKey('announcements.dismissed', 'v1');
const TONE_ICON = { info: 'megaphone', success: 'sparkles', warning: 'alert-circle', danger: 'warning' };

/**
 * Avisos globales configurados desde el panel web (eventos, novedades,
 * mantenimientos programados). Se muestran arriba del contenido y el usuario
 * puede descartarlos; el descarte se recuerda por id.
 */
export default function AnnouncementBanner() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { remoteState, config } = useRemoteConfig();
  const [dismissed, setDismissed] = useState([]);

  useEffect(() => {
    jsonStorage.get(DISMISSED_KEY, []).then(setDismissed);
  }, []);

  const pending = remoteState.announcements.filter((item) => !dismissed.includes(item.id));
  const items = remoteState.updateAvailable
    ? [
        {
          id: `update-${config.appVersion.recommended}`,
          tone: 'info',
          title: 'Hay una nueva versión',
          message: 'Actualiza para obtener las últimas mejoras.',
          dismissible: true,
        },
        ...pending,
      ].filter((item) => !dismissed.includes(item.id))
    : pending;

  if (!items.length) return null;
  const current = items[0];
  const tone = current.tone || 'info';
  const accent = theme.colors[tone] || theme.colors.info;

  const dismiss = () => {
    const next = [...dismissed, current.id];
    setDismissed(next);
    jsonStorage.set(DISMISSED_KEY, next);
  };

  return (
    <View
      style={[styles.banner, { borderLeftColor: accent, backgroundColor: theme.colors[`${tone}Soft`] || theme.colors.infoSoft }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={TONE_ICON[tone] || 'megaphone'} size={20} color={accent} />
      <View style={styles.texts}>
        {current.title ? <AppText variant="bodyStrong">{current.title}</AppText> : null}
        {current.message ? (
          <AppText variant="caption" tone="secondary">
            {current.message}
          </AppText>
        ) : null}
      </View>
      {current.dismissible !== false ? (
        <IconButton icon="close" label="Descartar aviso" onPress={dismiss} size={32} iconSize={18} />
      ) : null}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radius.lg,
      borderLeftWidth: 4,
      marginBottom: theme.spacing.md,
    },
    texts: { flex: 1, gap: 2 },
  });
}
