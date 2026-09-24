import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SectionHeader from '../../../shared/ui/SectionHeader';
import StatCard from '../../../shared/ui/StatCard';
import SurfaceCard from '../../../shared/ui/SurfaceCard';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';

export default function ProgressTabScreen({ levelProgress, userStats }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const completed = levelProgress?.completed || {};
  const unlocked = levelProgress?.unlocked || [1];

  const completedCount = Object.keys(completed).length;
  const totalLevels = 6;

  // Precision = aciertos / (aciertos + fallos) por nivel, promediada. Siempre 0-100%.
  const accuracies = Object.values(completed).map((c) => {
    const hits = c.hits || 0;
    const fails = c.fails || 0;
    const attempts = hits + fails;
    return attempts > 0 ? (hits / attempts) * 100 : 0;
  });
  const avgScore =
    accuracies.length > 0
      ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length)
      : 0;

  const streak = userStats?.streak ?? 0;
  const totalDays = userStats?.totalDays ?? 0;

  const streakLabel = streak === 1 ? '1 dia' : `${streak} dias`;
  const totalLabel = totalDays === 1 ? '1 dia' : `${totalDays} dias`;

  const levelEntries = Array.from({ length: totalLevels }, (_, i) => {
    const id = i + 1;
    const isCompleted = Boolean(completed[id]);
    const isUnlocked = unlocked.includes(id);
    const score = completed[id]?.score ?? null;

    let statusLabel;
    if (isCompleted) statusLabel = `Completado (${score}pts)`;
    else if (isUnlocked) statusLabel = 'En progreso';
    else statusLabel = 'Bloqueado';

    return { id, isCompleted, isUnlocked, statusLabel };
  });

  return (
    <View style={styles.container}>
      <SectionHeader title="Tu progreso" subtitle="Resumen de actividad y rendimiento" />

      <View style={styles.statsGrid}>
        <StatCard
          label="Niveles completados"
          value={`${completedCount} / ${totalLevels}`}
          tone="green"
          style={styles.statCard}
        />
        <StatCard
          label="Precision promedio"
          value={completedCount > 0 ? `${avgScore}%` : '-'}
          tone="blue"
          style={styles.statCard}
        />
        <StatCard
          label="Racha actual"
          value={streakLabel}
          tone="orange"
          style={styles.statCard}
        />
        <StatCard
          label="Dias activos"
          value={totalLabel}
          tone="violet"
          style={styles.statCard}
        />
      </View>

      <SurfaceCard style={styles.panel}>
        <Text style={styles.panelTitle}>Detalle por nivel</Text>
        {levelEntries.map((entry) => (
          <View key={entry.id} style={styles.levelRow}>
            <View
              style={[
                styles.levelDot,
                entry.isCompleted && styles.levelDotCompleted,
                !entry.isUnlocked && styles.levelDotLocked,
              ]}
            />
            <Text
              style={[
                styles.levelText,
                entry.isCompleted && styles.levelTextCompleted,
                !entry.isUnlocked && styles.levelTextLocked,
              ]}
            >
              {`Nivel ${entry.id}: ${entry.statusLabel}`}
            </Text>
          </View>
        ))}
      </SurfaceCard>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { gap: 12 },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 8,
    },
    statCard: { width: '48.5%' },
    panel: { marginTop: 6, padding: 14, gap: 10 },
    panelTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginBottom: 4,
    },
    levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    levelDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#F59E0B',
    },
    levelDotCompleted: { backgroundColor: '#22C55E' },
    levelDotLocked: { backgroundColor: '#D1D5DB' },
    levelText: { fontSize: 13, color: theme.colors.textSecondary },
    levelTextCompleted: { color: '#22C55E', fontWeight: '700' },
    levelTextLocked: { color: '#9CA3AF' },
  });
}
