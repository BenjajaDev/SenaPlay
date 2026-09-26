import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, ProgressBar, SectionHeader, SkeletonList, StatCard, StaggerItem } from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { useCatalog } from '../../levels/presentation/CatalogContext';
import { currentStreak, toLocalISODate } from '../domain/streak';
import FrequentMistakesCard from './FrequentMistakesCard';

const plural = (n, singular, pluralWord) => `${n} ${n === 1 ? singular : pluralWord}`;

/** Resumen de actividad: métricas, racha y detalle por nivel (del catálogo real). */
export default function ProgressTabScreen({ levelProgress, userStats, isLoading, frequentMistakes, onOpenLevel }) {
  const theme = useAppTheme();
  const { levels } = useCatalog();

  const completed = levelProgress?.completed || {};
  const unlocked = levelProgress?.unlocked || [1];
  const completedCount = levels.filter((level) => completed[level.id]).length;
  const totalLevels = levels.length;

  // Precisión = aciertos / (aciertos + fallos) por nivel, promediada (0–100 %).
  const accuracies = Object.values(completed).map(({ hits = 0, fails = 0 }) =>
    hits + fails > 0 ? (hits / (hits + fails)) * 100 : 0,
  );
  const avgAccuracy = accuracies.length ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length) : 0;
  const streak = currentStreak(userStats, toLocalISODate());
  const totalDays = userStats?.totalDays ?? 0;
  const totalStars = Object.values(completed).reduce((sum, item) => sum + (item.stars || 0), 0);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SectionHeader title="Tu progreso" subtitle="Resumen de actividad y rendimiento" />
        <SkeletonList count={4} lines={1} label="Cargando tu progreso" />
      </View>
    );
  }

  const stats = [
    { label: 'Niveles completados', value: `${completedCount} / ${totalLevels}`, tone: 'green', icon: 'layers' },
    { label: 'Precisión promedio', value: completedCount ? `${avgAccuracy}%` : '–', tone: 'blue', icon: 'analytics' },
    { label: 'Racha actual', value: plural(streak, 'día', 'días'), tone: 'orange', icon: 'flame' },
    { label: 'Estrellas', value: String(totalStars), tone: 'gold', icon: 'star' },
  ];

  return (
    <View style={styles.container}>
      <SectionHeader title="Tu progreso" subtitle="Resumen de actividad y rendimiento" />

      <View style={styles.statsGrid}>
        {stats.map((stat, index) => (
          <StaggerItem key={stat.label} index={index} style={styles.statCell}>
            <StatCard {...stat} />
          </StaggerItem>
        ))}
      </View>

      <Card padding="lg">
        <AppText variant="heading" style={styles.panelTitle}>
          Días activos: {totalDays}
        </AppText>
        <ProgressBar value={totalLevels ? completedCount / totalLevels : 0} gradient="reward" label="Avance total" />
      </Card>

      <FrequentMistakesCard items={frequentMistakes} onPractice={onOpenLevel} />

      <Card padding="lg" style={styles.panel}>
        <AppText variant="heading">Detalle por nivel</AppText>
        {levels.map((level) => {
          const done = completed[level.id];
          const isUnlocked = unlocked.includes(level.id);
          const status = done
            ? { icon: 'checkmark-circle', color: theme.colors.successText, text: `Completado · ${done.score} pts`, tone: 'success' }
            : isUnlocked
              ? { icon: 'play-circle', color: theme.colors.primary, text: 'Disponible', tone: 'brand' }
              : { icon: 'lock-closed', color: theme.colors.textMuted, text: 'Bloqueado', tone: 'muted' };
          return (
            <View key={level.id} style={styles.levelRow} accessible accessibilityLabel={`Nivel ${level.id}, ${level.title}: ${status.text}`}>
              <Ionicons name={status.icon} size={18} color={status.color} />
              <AppText variant="caption" style={styles.flex} numberOfLines={1}>
                {`Nivel ${level.id} · ${level.title}`}
              </AppText>
              <AppText variant="label" tone={status.tone}>
                {status.text}
              </AppText>
            </View>
          );
        })}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  statCell: { width: '48.5%' },
  panelTitle: { marginBottom: 8 },
  panel: { gap: 10 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  flex: { flex: 1 },
});
