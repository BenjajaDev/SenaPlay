import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import useStaleWhileRevalidate from '../../../core/data/useStaleWhileRevalidate';
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
import VideoPlayerScreen from './VideoPlayerScreen';
import VideoThumbnail from './VideoThumbnail';

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
export default function VideosTabScreen({ onScrollToTop }) {
  const theme = useAppTheme();
  const { media } = useServices();
  const { notify } = useFeedback();
  // Sin contenido empaquetado útil (los videos locales son solo «Muy
  // pronto»): skeleton hasta tener la caché o la respuesta remota.
  const { data } = useStaleWhileRevalidate(media.getCachedVideos, media.listVideos);
  const videos = useMemo(() => data?.videos ?? [], [data]);
  const loading = !data;
  // Sin videos publicados (o borrados desde el panel) no tiene sentido buscar:
  // se muestra solo el aviso de que aquí se añadirán.
  const hasVideos = videos.length > 0;
  // `local` = no respondió Supabase y no había nada guardado.
  const offline = data?.source === 'local';
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  // Video en reproducción: se ve aquí mismo, sin abrir el navegador.
  const [selected, setSelected] = useState(null);

  const categories = useMemo(() => ['Todos', ...new Set(videos.map((video) => video.category))], [videos]);
  const filtered = useMemo(() => {
    const search = normalizeText(query.trim());
    return videos.filter(
      (video) =>
        (category === 'Todos' || video.category === category) &&
        (!search || normalizeText(`${video.title} ${video.category} ${video.description || ''}`).includes(search)),
    );
  }, [videos, query, category]);

  const openVideo = (video) => {
    if (!video.url) {
      notify({ tone: 'info', title: 'Muy pronto', message: 'Este video todavía no está publicado.' });
      return;
    }
    setSelected(video);
    onScrollToTop?.();
  };

  if (selected) {
    return (
      <VideoPlayerScreen
        video={selected}
        videos={filtered.length ? filtered : videos}
        onSelect={(next) => {
          setSelected(next);
          // «Más videos» está abajo: se vuelve arriba, al reproductor.
          onScrollToTop?.();
        }}
        onBack={() => {
          setSelected(null);
          onScrollToTop?.();
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <SectionHeader title="Videos" subtitle="Aprende con videos cortos por nivel" />
      {hasVideos ? (
        <TextField
          icon="search"
          placeholder="Buscar videos…"
          value={query}
          onChangeText={setQuery}
          accessibilityLabel="Buscar videos"
          returnKeyType="search"
        />
      ) : null}
      {categories.length > 2 ? (
        <View style={styles.chips}>
          {categories.map((item) => (
            <Chip key={item} label={item} selected={item === category} onPress={() => setCategory(item)} />
          ))}
        </View>
      ) : null}

      {loading ? (
        <SkeletonList count={4} label="Cargando videos" />
      ) : !hasVideos ? (
        offline ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="No pudimos cargar los videos"
            message="Revisa tu conexión. Cuando vuelvas a tener internet, los videos aparecerán aquí."
          />
        ) : (
          <EmptyState
            icon="videocam-outline"
            title="Aún no hay videos"
            message="Aquí se añadirán los videos de Lengua de Señas Chilena que publique el equipo de SeñaPlay."
          />
        )
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
                accessibilityHint="Reproduce el video dentro de la app"
              >
                <View style={styles.row}>
                  <VideoThumbnail uri={video.thumbnailUrl} iconSize={16} style={[styles.thumb, { borderRadius: theme.radius.md }]} />
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
  // 16:9, como el reproductor.
  thumb: { width: 96, height: 54 },
  info: { flex: 1, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
