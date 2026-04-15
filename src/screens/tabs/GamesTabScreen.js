import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import SectionHeader from '../../components/ui/SectionHeader';
import SurfaceCard from '../../components/ui/SurfaceCard';
import { useAppTheme } from '../../theme/ThemeProvider';

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
    description: 'Proximamente',
    icon: 'hand-left-outline',
    color: '#1CB0F6',
    available: false,
  },
  {
    id: 'spelling',
    title: 'Deletreo',
    description: 'Proximamente',
    icon: 'text-outline',
    color: '#FF4B4B',
    available: false,
  },
  {
    id: 'camera-translation',
    title: 'Traducción con cámara',
    description: 'Proximamente',
    icon: 'camera-outline',
    color: '#0EA5E9',
    available: false,
  },
];

export default function GamesTabScreen({ onOpenGame }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <SectionHeader
        title="Juegos divertidos"
        subtitle="Aprende jugando con retos interactivos"
      />

      <View style={styles.grid}>
        {GAMES.map((game) => {
          const cardTone = getGameCardTone(theme, game);

          return (
          <SurfaceCard
            key={game.title}
            style={[
              styles.card,
              cardTone.card,
              !game.available && styles.cardDisabled,
            ]}
          >
            <Pressable
              onPress={() => {
                if (game.available && onOpenGame) {
                  onOpenGame(game.id);
                }
              }}
            >
              <View style={[styles.iconBox, cardTone.iconBox]}> 
                <Ionicons name={game.icon} size={24} color={game.color} />
              </View>
              <Text style={[styles.title, cardTone.title]}>{game.title}</Text>
              <Text style={[styles.description, cardTone.description]}>{game.description}</Text>
              <View
                style={[
                  styles.cta,
                  {
                    backgroundColor: game.available ? game.color : theme.colors.primarySoft,
                    borderColor: game.available ? game.color : theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.ctaText,
                    { color: game.available ? '#FFFFFF' : theme.colors.textSecondary },
                  ]}
                >
                  {game.available ? 'Jugar' : 'Muy pronto'}
                </Text>
              </View>
            </Pressable>
          </SurfaceCard>
        );})}
      </View>
    </View>
  );
}

function getGameCardTone(theme, game) {
  const baseBg = theme.mode === 'dark' ? '#221C35' : '#F8F4FF';
  const baseBorder = theme.mode === 'dark' ? '#4A3D66' : '#DCCDF8';

  if (game.id === 'memory') {
    return {
      card: {
        backgroundColor: theme.mode === 'dark' ? '#1D2E1A' : '#EFFCE7',
        borderColor: theme.mode === 'dark' ? '#3E6B34' : '#B9E79A',
      },
      iconBox: {
        backgroundColor: theme.mode === 'dark' ? 'rgba(126, 219, 67, 0.16)' : 'rgba(88, 204, 2, 0.14)',
      },
      title: {
        color: theme.mode === 'dark' ? '#F0FFE7' : '#1F3A16',
      },
      description: {
        color: theme.mode === 'dark' ? '#CFEABD' : '#3E6B34',
      },
    };
  }

  if (game.id === 'quiz') {
    return {
      card: {
        backgroundColor: theme.mode === 'dark' ? '#34280F' : '#FFF6DD',
        borderColor: theme.mode === 'dark' ? '#6F5520' : '#F2D286',
      },
      iconBox: {
        backgroundColor: theme.mode === 'dark' ? 'rgba(242, 201, 76, 0.18)' : 'rgba(245, 158, 11, 0.14)',
      },
      title: {
        color: theme.mode === 'dark' ? '#FFF7E3' : '#4A3200',
      },
      description: {
        color: theme.mode === 'dark' ? '#ECD8A6' : '#7A5A16',
      },
    };
  }

  return {
    card: {
      backgroundColor: baseBg,
      borderColor: baseBorder,
    },
    iconBox: {
      backgroundColor: theme.mode === 'dark' ? 'rgba(242, 201, 76, 0.12)' : 'rgba(126, 87, 194, 0.12)',
    },
    title: {
      color: theme.colors.textPrimary,
    },
    description: {
      color: theme.colors.textSecondary,
    },
  };
}

function createStyles(theme) {
  return StyleSheet.create({
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
      opacity: 0.75,
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
      color: theme.colors.textPrimary,
    },
    description: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 6,
      minHeight: 30,
    },
    cta: {
      marginTop: 10,
      borderRadius: 10,
      borderWidth: 1,
      paddingVertical: 7,
      alignItems: 'center',
    },
    ctaText: {
      fontSize: 12,
      fontWeight: '800',
    },
  });
}
