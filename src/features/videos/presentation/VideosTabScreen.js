import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useServices } from '../../../core/di/ServicesProvider';
import {
  AppText,
  Badge,
  Card,
  Chip,
  EmptyState,
  SectionHeader,
  SkeletonList,
  StaggerItem,
  TextField,
  useFeedback,
} from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { formatDuration } from '../data/MediaRepository';

const normalizeText = (value) =>
  String(value || '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Videos de aprendizaje administrados desde el Gestor de Medios del panel
 * web. Muestra si el video trae subtítulos (CC): la app sirve a personas
 * oyentes y no oyentes, y los videos con voz deben ser accesibles.
 */
export default function VideosTabScreen() {
  const theme = useAppTheme();
  const { media } = useServices();
  const { notify } = useFeedback();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');

  useEffect(() => {
    let mounted = true;
    media.listVideos().then((result) => {
      if (!mounted) return;
      setVideos(result.videos);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [media]);

  const categories = useMemo(() => ['Todos', ...new Set(videos.map((video) => video.category))], [videos]);
  const filtered = useMemo(() => {
    const search = normalizeText(query.trim());
    return videos.filter(
      (video) =>
        (category === 'Todos' || video.category === category) &&
        (!search || normalizeText(`${video.title} ${video.category} ${video.description || ''}`).includes(search)),
    );
  }, [videos, query, category]);

  const openVideo = async (video) => {
    if (!video.url) {
      notify({ tone: 'info', title: 'Muy pronto', message: 'Este video todavía no está publicado.' });
      return;
    }
    await WebBrowser.openBrowserAsync(video.url);
  };

  return (
    <View style={styles.container}>
      <SectionHeader title="Videos" subtitle="Aprende con videos cortos por nivel" />
      <TextField
        icon="search"
        placeholder="Buscar videos…"
        value={query}
        onChangeText={setQuery}
        accessibilityLabel="Buscar videos"
        returnKeyType="search"
      />
      {categories.length > 2 ? (
        <View style={styles.chips}>
          {categories.map((item) => (
            <Chip key={item} label={item} selected={item === category} onPress={() => setCategory(item)} />
          ))}
        </View>
      ) : null}

      {loading ? (
        <SkeletonList count={4} label="Cargando videos" />
      ) : filtered.length === 0 ? (
        <EmptyState icon="videocam-outline" title="Sin videos" message="Prueba con otra búsqueda." />
      ) : (
        <View style={styles.list}>
          {filtered.map((video, index) => (
            <StaggerItem key={video.id} index={index}>
              <Card
                padding="md"
                onPress={() => openVideo(video)}
                accessibilityLabel={`${video.title}, ${video.category}${video.durationSeconds ? `, ${formatDuration(video.durationSeconds)}` : ''}${video.captionsUrl ? ', con subtítulos' : ''}`}
                accessibilityHint="Abre el video"
              >
                <View style={styles.row}>
                  <View style={[styles.thumb, { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.md }]}>
                    <Ionicons name="play-circle" size={32} color={theme.colors.primary} />
                  </View>
                  <View style={styles.info}>
                    <AppText variant="bodyStrong" numberOfLines={2}>
                      {video.title}
                    </AppText>
                    <View style={styles.metaRow}>
                      <AppText variant="caption" tone="secondary">
                        {[video.category, formatDuration(video.durationSeconds)].filter(Boolean).join(' • ')}
                      </AppText>
                      {video.captionsUrl ? <Badge label="CC" tone="info" icon="text" /> : null}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                </View>
              </Card>
            </StaggerItem>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 64, height: 54, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
