import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { AppText, Badge, Card, ScreenHeader, StaggerItem } from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import SignImage from '../../signs/presentation/SignImage';
import { formatDuration } from '../data/MediaRepository';
import VideoPlayer from './VideoPlayer';

const MAX_UP_NEXT = 4;

/**
 * Ver un video sin salir de la app: reproductor arriba, datos del video y
 * «Más videos» (primero los de la misma categoría) para seguir viendo.
 * La flecha y el botón atrás de Android vuelven a la lista.
 */
export default function VideoPlayerScreen({ video, videos = [], onSelect, onBack }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [ended, setEnded] = useState(false);
  const [captionsFailed, setCaptionsFailed] = useState(false);

  useEffect(() => {
    setEnded(false);
    setCaptionsFailed(false);
  }, [video?.id]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const upNext = useMemo(() => {
    const playable = videos.filter((item) => item.id !== video?.id && item.url);
    const same = playable.filter((item) => item.category === video?.category);
    const others = playable.filter((item) => item.category !== video?.category);
    return [...same, ...others].slice(0, MAX_UP_NEXT);
  }, [videos, video]);

  const meta = [video?.category, formatDuration(video?.durationSeconds)].filter(Boolean).join(' • ');

  return (
    <View style={styles.container}>
      <ScreenHeader title="Video" onBack={onBack} backLabel="Volver a la lista de videos" />

      <VideoPlayer
        key={video?.id}
        video={video}
        onEnded={() => setEnded(true)}
        onCaptionsError={() => setCaptionsFailed(true)}
      />

      <View style={styles.info}>
        <AppText variant="title" accessibilityRole="header">
          {video?.title}
        </AppText>
        <View style={styles.metaRow}>
          {meta ? (
            <AppText variant="caption" tone="secondary">
              {meta}
            </AppText>
          ) : null}
          {video?.captionsUrl && !captionsFailed ? <Badge label="Subtítulos" tone="info" icon="text" /> : null}
        </View>
        {captionsFailed ? (
          <View style={styles.noticeRow}>
            <Ionicons name="alert-circle-outline" size={16} color={theme.colors.warningText} />
            <AppText variant="caption" tone="warning" style={styles.flex}>
              No se pudieron cargar los subtítulos de este video.
            </AppText>
          </View>
        ) : null}
        {video?.description ? <AppText tone="secondary">{video.description}</AppText> : null}
      </View>

      {video?.signKey ? (
        <Card padding="md" style={styles.signCard}>
          <SignImage signKey={video.signKey} size={64} rounded={theme.radius.md} />
          <View style={styles.flex}>
            <AppText variant="label" tone="secondary">
              Seña del video
            </AppText>
            <AppText variant="heading">{String(video.signKey).toLocaleUpperCase('es')}</AppText>
          </View>
        </Card>
      ) : null}

      {upNext.length ? (
        <View style={styles.upNext}>
          <AppText variant="heading">{ended ? 'Sigue con otro video' : 'Más videos'}</AppText>
          {upNext.map((item, index) => (
            <StaggerItem key={item.id} index={index}>
              <Card
                padding="md"
                onPress={() => onSelect(item)}
                accessibilityLabel={`${item.title}${item.durationSeconds ? `, ${formatDuration(item.durationSeconds)}` : ''}`}
                accessibilityHint="Reproduce este video"
              >
                <View style={styles.row}>
                  <View style={styles.thumb}>
                    <Ionicons name="play" size={22} color={theme.colors.primary} />
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" numberOfLines={2}>
                      {item.title}
                    </AppText>
                    <AppText variant="caption" tone="secondary">
                      {[item.category, formatDuration(item.durationSeconds)].filter(Boolean).join(' • ')}
                    </AppText>
                  </View>
                </View>
              </Card>
            </StaggerItem>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(theme) {
  const { spacing, radius, colors } = theme;
  return StyleSheet.create({
    container: { gap: spacing.md },
    flex: { flex: 1 },
    info: { gap: spacing.xs + 2 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
    noticeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    signCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    upNext: { gap: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    thumb: {
      width: 56,
      height: 42,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
  });
}
