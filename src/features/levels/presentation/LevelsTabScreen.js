import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import haptics from '../../../core/feedback/haptics';
import { AppText, Card, ProgressBar, SectionHeader, SkeletonList, StaggerItem, useFeedback } from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { useCatalog } from './CatalogContext';

function Stars({ count, theme }) {
  return (
    <View style={styles.stars} accessible accessibilityLabel={`${count} de 3 estrellas`}>
      {[0, 1, 2].map((index) => (
        <Ionicons key={index} name={index < count ? 'star' : 'star-outline'} size={13} color={index < count ? theme.colors.gold : theme.colors.textMuted} />
      ))}
    </View>
  );
}

function LevelNode({ item, onPress, theme }) {
  const status = item.completed ? 'completed' : item.unlocked && item.available ? 'unlocked' : 'locked';
  const statusText = { completed: 'completado', unlocked: 'disponible', locked: 'bloqueado' }[status];

  const bubbleContent =
    status === 'completed' ? (
      <Ionicons name="checkmark" size={30} color={theme.colors.onSuccess} />
    ) : status === 'unlocked' ? (
      <AppText variant="display" tone="inverse">
        {item.id}
      </AppText>
    ) : (
      <Ionicons name="lock-closed" size={22} color={theme.colors.textMuted} />
    );

  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`Nivel ${item.id}: ${item.title}, ${statusText}`}
      accessibilityState={{ disabled: status === 'locked' }}
      style={({ pressed }) => [
        styles.node,
        {
          backgroundColor: status === 'completed' ? theme.colors.successSoft : status === 'unlocked' ? theme.colors.primarySoft : theme.colors.surfaceSunken,
          borderColor: status === 'completed' ? theme.colors.success : status === 'unlocked' ? theme.colors.primary : theme.colors.border,
          borderRadius: theme.radius.xl,
        },
        pressed && status !== 'locked' && styles.pressed,
      ]}
    >
      {status === 'unlocked' ? (
        <LinearGradient {...theme.gradients.brand} style={styles.bubble}>
          {bubbleContent}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.bubble,
            { backgroundColor: status === 'completed' ? theme.colors.success : theme.colors.border },
          ]}
        >
          {bubbleContent}
        </View>
      )}
      <AppText variant="label" tone={status === 'locked' ? 'muted' : 'primary'} align="center" numberOfLines={2}>
        {item.title}
      </AppText>
      {item.completed ? <Stars count={item.stars} theme={theme} /> : null}
    </Pressable>
  );
}

function LivesPoolCard({ lives, theme }) {
  if (lives?.config?.mode !== 'pool') return null;
  const minutes = lives.nextRefillAt ? Math.max(1, Math.ceil((lives.nextRefillAt - Date.now()) / 60000)) : null;
  return (
    <Card tone={lives.available > 0 ? undefined : 'warning'} padding="md">
      <View style={styles.livesRow}>
        <Ionicons name="heart" size={22} color={theme.colors.danger} />
        <AppText variant="bodyStrong" style={styles.flex}>
          {lives.available} de {lives.config.maxLives} vidas
        </AppText>
        {minutes ? (
          <AppText variant="caption" tone="secondary">
            +1 en {minutes} min
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * Ruta de niveles: nodos de dos columnas unidos por un camino, con entrada
 * escalonada. Estados con icono + texto (no solo color): completado ✓ con
 * estrellas, disponible con número y degradé, bloqueado con candado.
 */
export default function LevelsTabScreen({ levelProgress, onOpenLevel, isLoading, lives }) {
  const theme = useAppTheme();
  const { notify } = useFeedback();
  const { levels: catalogLevels } = useCatalog();

  const levels = useMemo(
    () =>
      catalogLevels.map((level) => {
        const completion = levelProgress?.completed?.[level.id];
        return {
          id: level.id,
          title: level.title,
          available: level.available,
          unlocked: (levelProgress?.unlocked || [1]).includes(level.id),
          completed: Boolean(completion),
          stars: completion?.stars ?? (completion ? 1 : 0),
        };
      }),
    [catalogLevels, levelProgress],
  );

  const completedCount = levels.filter((item) => item.completed).length;

  const handleOpen = (item) => {
    if (!item.available) {
      notify({ tone: 'info', title: 'Muy pronto', message: 'Este nivel todavía se está preparando.' });
      return;
    }
    if (!item.unlocked) {
      haptics.warning();
      notify({ tone: 'warning', title: 'Nivel bloqueado', message: 'Completa el nivel anterior para desbloquearlo.' });
      return;
    }
    onOpenLevel?.(item.id);
  };

  const rows = [];
  for (let i = 0; i < levels.length; i += 2) rows.push(levels.slice(i, i + 2));

  return (
    <View style={styles.container}>
      <SectionHeader title="Ruta de niveles" subtitle="Completa un nivel para desbloquear el siguiente" />

      <Card variant="gradient" padding="md">
        <View style={styles.summaryRow}>
          <AppText variant="bodyStrong">Tu avance</AppText>
          <AppText variant="caption" tone="secondary">
            {completedCount} de {levels.length} niveles
          </AppText>
        </View>
        <ProgressBar value={levels.length ? completedCount / levels.length : 0} label="Niveles completados" />
      </Card>

      <LivesPoolCard lives={lives} theme={theme} />

      {isLoading ? (
        <SkeletonList count={3} label="Cargando niveles" />
      ) : (
        rows.map((row, rowIndex) => (
          <StaggerItem key={`row-${row[0].id}`} index={rowIndex}>
            <View style={styles.pathRow}>
              <LevelNode item={row[0]} onPress={handleOpen} theme={theme} />
              {row[1] ? (
                <>
                  <View style={[styles.pathLine, { backgroundColor: row[0].completed ? theme.colors.success : theme.colors.border }]} />
                  <LevelNode item={row[1]} onPress={handleOpen} theme={theme} />
                </>
              ) : (
                <View style={styles.placeholder} />
              )}
            </View>
          </StaggerItem>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  flex: { flex: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  livesRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pathRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  node: { width: '44%', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1.5 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  bubble: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  stars: { flexDirection: 'row', gap: 2 },
  pathLine: { marginTop: 48, height: 4, width: 24, borderRadius: 2 },
  placeholder: { width: '44%' },
});
