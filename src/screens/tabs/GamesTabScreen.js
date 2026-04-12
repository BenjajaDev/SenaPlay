import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import SectionHeader from '../../components/ui/SectionHeader';
import SurfaceCard from '../../components/ui/SurfaceCard';

const GAMES = [
  {
    id: 'memory',
    title: 'Memoria de SEÑAS',
    description: 'Encuentra parejas entre SEÑA y letra',
    icon: 'extension-puzzle-outline',
    color: '#58CC02',
    available: true,
  },
  {
    id: 'quiz',
    title: 'Quiz Rapido',
    description: 'Selecciona respuestas antes de que termine el tiempo',
    icon: 'flash-outline',
    color: '#F59E0B',
    available: true,
  },
  {
    id: 'hand3d',
    title: 'Mano 3D',
    description: 'Vista previa del modulo interactivo',
    icon: 'hand-left-outline',
    color: '#1CB0F6',
    available: true,
  },
  {
    id: 'spelling',
    title: 'Deletreo',
    description: 'Proximamente',
    icon: 'text-outline',
    color: '#FF4B4B',
    available: false,
  },
];

export default function GamesTabScreen({ onOpenGame }) {
  return (
    <View style={styles.container}>
      <SectionHeader
        title="Juegos divertidos"
        subtitle="Aprende jugando con retos interactivos"
      />

      <View style={styles.grid}>
        {GAMES.map((game) => (
          <SurfaceCard
            key={game.title}
            style={[styles.card, !game.available && styles.cardDisabled]}
          >
            <Pressable
              onPress={() => {
                if (game.available && onOpenGame) {
                  onOpenGame(game.id);
                }
              }}
            >
              <View style={[styles.iconBox, { backgroundColor: `${game.color}20` }]}> 
                <Ionicons name={game.icon} size={24} color={game.color} />
              </View>
              <Text style={styles.title}>{game.title}</Text>
              <Text style={styles.description}>{game.description}</Text>
              <View style={[styles.cta, { backgroundColor: game.available ? game.color : '#94A3B8' }]}>
                <Text style={styles.ctaText}>{game.available ? 'Jugar' : 'Muy pronto'}</Text>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  card: {
    width: '48.5%',
    padding: 12,
  },
  cardDisabled: {
    opacity: 0.7,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  description: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    minHeight: 30,
  },
  cta: {
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
