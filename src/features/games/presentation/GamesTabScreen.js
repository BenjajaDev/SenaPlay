import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { AppText, Badge, Card, EmptyState, SectionHeader, StaggerItem } from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { useRemoteConfig } from '../../remoteConfig/presentation/RemoteConfigProvider';

// Catálogo de juegos. `flag` permite activarlos/desactivarlos desde el panel
// web (módulos experimentales o eventos) sin publicar una versión nueva.
export const GAMES = [
  {
    id: 'memory',
    flag: 'games.memory',
    title: 'Memoria de señas',
    description: 'Encuentra parejas entre seña y letra',
    icon: 'extension-puzzle-outline',
    tone: 'success',
  },
  {
    id: 'quiz',
    flag: 'games.quiz',
    title: 'Quiz rápido',
    description: 'Responde antes de que termine el tiempo',
    icon: 'flash-outline',
    tone: 'warning',
  },
  {
    id: 'practice',
    flag: 'games.practice',
    title: 'Práctica de señas',
    description: 'La IA te corrige la seña frente a la cámara',
    icon: 'hand-left-outline',
    tone: 'info',
    camera: true,
  },
  {
    id: 'spelling',
    flag: 'games.spelling',
    title: 'Deletreo',
    description: 'Escribe palabras haciendo una seña por letra',
    icon: 'text-outline',
    tone: 'danger',
    camera: true,
  },
  {
    id: 'camera-translation',
    flag: 'games.cameraTranslation',
    title: 'Traducción en vivo',
    description: 'Traduce tus señas a texto en tiempo real',
    icon: 'camera-outline',
    tone: 'info',
    camera: true,
  },
  {
    id: 'dynamic-monitor',
    flag: 'games.dynamicMonitor',
    title: 'Señas dinámicas',
    description: 'Graba una seña con movimiento y prueba el modelo nuevo',
    icon: 'videocam-outline',
    tone: 'brand',
    camera: true,
    beta: true,
  },
];

const TONE_TOKENS = {
  success: ['successSoft', 'successText'],
  warning: ['warningSoft', 'warningText'],
  info: ['infoSoft', 'infoText'],
  danger: ['dangerSoft', 'dangerText'],
  brand: ['primarySoft', 'primary'],
};

export default function GamesTabScreen({ onOpenGame }) {
  const theme = useAppTheme();
  const { isEnabled } = useRemoteConfig();
  const games = GAMES.filter((game) => isEnabled(game.flag));

  return (
    <View style={styles.container}>
      <SectionHeader title="Juegos" subtitle="Aprende jugando con retos interactivos" />

      {games.length === 0 ? (
        <EmptyState icon="game-controller-outline" title="Juegos en pausa" message="Volverán muy pronto." />
      ) : (
        <View style={styles.grid}>
          {games.map((game, index) => {
            const [soft, strong] = TONE_TOKENS[game.tone];
            return (
              <StaggerItem key={game.id} index={index} style={styles.cell}>
                <Card
                  padding="md"
                  onPress={() => onOpenGame?.(game.id)}
                  accessibilityLabel={`${game.title}. ${game.description}`}
                  accessibilityHint="Toca para jugar"
                  style={styles.card}
                >
                  <View style={styles.topRow}>
                    <View style={[styles.iconBox, { backgroundColor: theme.colors[soft] }]}>
                      <Ionicons name={game.icon} size={24} color={theme.colors[strong]} />
                    </View>
                    {game.beta ? <Badge label="Beta" tone="brand" /> : null}
                    {game.camera && !game.beta ? <Ionicons name="camera" size={14} color={theme.colors.textMuted} /> : null}
                  </View>
                  <AppText variant="bodyStrong">{game.title}</AppText>
                  <AppText variant="caption" tone="secondary" style={styles.description}>
                    {game.description}
                  </AppText>
                  <View style={[styles.cta, { backgroundColor: theme.colors[soft] }]}>
                    <AppText variant="label" style={{ color: theme.colors[strong] }}>
                      Jugar
                    </AppText>
                    <Ionicons name="play" size={12} color={theme.colors[strong]} />
                  </View>
                </Card>
              </StaggerItem>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  cell: { width: '48.5%' },
  card: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  iconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  description: { marginTop: 4, minHeight: 36 },
  cta: {
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
