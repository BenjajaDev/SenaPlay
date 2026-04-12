import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import SectionHeader from '../../components/ui/SectionHeader';
import SurfaceCard from '../../components/ui/SurfaceCard';

const VIDEOS = [
  { title: 'Pronunciacion diaria', category: 'Basico', duration: '06:12' },
  { title: 'Vocabulario para saludos', category: 'Basico', duration: '08:45' },
  { title: 'Frases en contexto', category: 'Intermedio', duration: '10:03' },
  { title: 'Conversaciones reales', category: 'Avanzado', duration: '12:20' },
];

export default function VideosTabScreen() {
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
        <Ionicons name="search" size={18} color="#64748B" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar videos..."
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
        />
      </View>

      <View style={styles.list}>
        {filtered.map((video) => (
          <SurfaceCard key={video.title} style={styles.videoCard}>
            <Pressable style={styles.videoCardPressable}>
              <View style={styles.thumb}>
                <Ionicons name="play-circle" size={32} color="#7E57C2" />
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

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: '#0F172A',
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
    backgroundColor: '#F5F3FF',
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
    color: '#0F172A',
  },
  videoMeta: {
    marginTop: 3,
    fontSize: 12,
    color: '#64748B',
  },
});
