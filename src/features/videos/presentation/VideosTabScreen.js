import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import SectionHeader from '../../../shared/ui/SectionHeader';
import SurfaceCard from '../../../shared/ui/SurfaceCard';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';

const VIDEOS = [
  { title: 'Pronunciacion diaria', category: 'Basico', duration: '06:12' },
  { title: 'Vocabulario para saludos', category: 'Basico', duration: '08:45' },
  { title: 'Frases en contexto', category: 'Intermedio', duration: '10:03' },
  { title: 'Conversaciones reales', category: 'Avanzado', duration: '12:20' },
];

export default function VideosTabScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) {
      return VIDEOS;
    }
    return VIDEOS.filter((item) => {
      return item.title.toLowerCase().includes(value) || item.category.toLowerCase().includes(value);
    });
  }, [query]);

  return (
    <View style={styles.container}>
      <SectionHeader
        title="Videos"
        subtitle="Busca y filtra contenido de aprendizaje"
      />

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={theme.colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar videos..."
          placeholderTextColor={theme.colors.navInactive}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.list}>
        {filtered.map((video) => (
          <SurfaceCard key={video.title} style={styles.videoCard}>
            <Pressable style={styles.videoCardPressable}>
              <View style={styles.thumb}>
                <Ionicons name="play-circle" size={32} color={theme.colors.primary} />
              </View>
              <View style={styles.info}>
                <Text style={styles.videoTitle}>{video.title}</Text>
                <Text style={styles.videoMeta}>{video.category} • {video.duration}</Text>
              </View>
            </Pressable>
          </SurfaceCard>
        ))}
      </View>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      gap: 12,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      color: theme.colors.textPrimary,
      fontSize: 14,
    },
    list: {
      gap: 8,
    },
    videoCard: {
      padding: 10,
    },
    videoCardPressable: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    thumb: {
      width: 64,
      height: 54,
      borderRadius: 10,
      backgroundColor: theme.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    info: {
      flex: 1,
    },
    videoTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    videoMeta: {
      marginTop: 3,
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
  });
}
