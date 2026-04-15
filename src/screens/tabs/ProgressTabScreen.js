import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SectionHeader from '../../components/ui/SectionHeader';
import StatCard from '../../components/ui/StatCard';
import SurfaceCard from '../../components/ui/SurfaceCard';
import { useAppTheme } from '../../theme/ThemeProvider';

export default function ProgressTabScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <SectionHeader
        title="Tu progreso"
        subtitle="Resumen de actividad y rendimiento"
      />

      <View style={styles.statsGrid}>
        <StatCard label="Niveles completados" value="2 / 6" tone="green" style={styles.statCard} />
        <StatCard label="Precision" value="86%" tone="blue" style={styles.statCard} />
        <StatCard label="Racha actual" value="5 dias" tone="orange" style={styles.statCard} />
        <StatCard label="Tiempo total" value="3h 42m" tone="violet" style={styles.statCard} />
      </View>

      <SurfaceCard style={styles.panel}>
        <Text style={styles.panelTitle}>Detalle por nivel</Text>
        <Text style={styles.panelItem}>Nivel 1: Completado, puntaje max 95</Text>
        <Text style={styles.panelItem}>Nivel 2: En progreso</Text>
        <Text style={styles.panelItem}>Nivel 3: Bloqueado</Text>
      </SurfaceCard>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      gap: 12,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 8,
    },
    statCard: {
      width: '48.5%',
    },
    panel: {
      marginTop: 6,
      padding: 12,
      gap: 6,
    },
    panelTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      marginBottom: 2,
    },
    panelItem: {
      color: theme.colors.textSecondary,
      fontSize: 13,
    },
  });
}
