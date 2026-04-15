import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FilterChip from '../../components/ui/FilterChip';
import SectionHeader from '../../components/ui/SectionHeader';
import SurfaceCard from '../../components/ui/SurfaceCard';
import { APP_FONTS } from '../../constants/fonts';
import { useAppTheme } from '../../theme/ThemeProvider';

const LETTERS = [
  { letter: 'A', sign: 'a', description: 'Puno cerrado con pulgar al lado', category: 'A-M', difficulty: 'Facil' },
  { letter: 'B', sign: 'b', description: 'Dedos juntos hacia arriba', category: 'A-M', difficulty: 'Facil' },
  { letter: 'C', sign: 'c', description: 'Mano curvada en forma de C', category: 'A-M', difficulty: 'Facil' },
  { letter: 'D', sign: 'd', description: 'Indice arriba, otros dedos doblados', category: 'A-M', difficulty: 'Facil' },
  { letter: 'E', sign: 'e', description: 'Dedos doblados sobre la palma', category: 'A-M', difficulty: 'Facil' },
  { letter: 'F', sign: 'f', description: 'Circulo entre indice y pulgar', category: 'A-M', difficulty: 'Medio' },
  { letter: 'G', sign: 'g', description: 'Indice y pulgar extendidos en horizontal', category: 'A-M', difficulty: 'Medio' },
  { letter: 'H', sign: 'h', description: 'Indice y medio extendidos en horizontal', category: 'A-M', difficulty: 'Medio' },
  { letter: 'I', sign: 'i', description: 'Menique extendido hacia arriba', category: 'A-M', difficulty: 'Medio' },
  { letter: 'J', sign: 'j', description: 'Menique dibuja una J en el aire', category: 'A-M', difficulty: 'Medio' },
  { letter: 'K', sign: 'k', description: 'Indice arriba y medio en angulo', category: 'A-M', difficulty: 'Medio' },
  { letter: 'L', sign: 'l', description: 'Indice y pulgar en forma de L', category: 'A-M', difficulty: 'Medio' },
  { letter: 'M', sign: 'm', description: 'Pulgar bajo tres dedos', category: 'A-M', difficulty: 'Medio' },
  { letter: 'N', sign: 'n', description: 'Pulgar entre medio y anular', category: 'N-Z', difficulty: 'Dificil' },
  { letter: 'N~', sign: 'n~', description: 'N con movimiento ondulatorio', category: 'N-Z', difficulty: 'Dificil' },
  { letter: 'O', sign: 'o', description: 'Todos los dedos forman un circulo', category: 'N-Z', difficulty: 'Dificil' },
  { letter: 'P', sign: 'p', description: 'Como K pero apuntando hacia abajo', category: 'N-Z', difficulty: 'Dificil' },
  { letter: 'Q', sign: 'q', description: 'Como G pero hacia abajo', category: 'N-Z', difficulty: 'Dificil' },
  { letter: 'R', sign: 'r', description: 'Indice y medio cruzados', category: 'N-Z', difficulty: 'Dificil' },
  { letter: 'S', sign: 's', description: 'Puno cerrado con pulgar sobre dedos', category: 'N-Z', difficulty: 'Dificil' },
  { letter: 'T', sign: 't', description: 'Pulgar entre indice y medio', category: 'N-Z', difficulty: 'Dificil' },
  { letter: 'U', sign: 'u', description: 'Indice y medio juntos hacia arriba', category: 'N-Z', difficulty: 'Dificil' },
  { letter: 'V', sign: 'v', description: 'Indice y medio separados en V', category: 'N-Z', difficulty: 'Dificil' },
  { letter: 'W', sign: 'w', description: 'Indice, medio y anular separados', category: 'N-Z', difficulty: 'Dificil' },
  { letter: 'X', sign: 'x', description: 'Indice doblado como gancho', category: 'N-Z', difficulty: 'Dificil' },
  { letter: 'Y', sign: 'y', description: 'Pulgar y menique extendidos', category: 'N-Z', difficulty: 'Dificil' },
  { letter: 'Z', sign: 'z', description: 'Indice dibuja una Z en el aire', category: 'N-Z', difficulty: 'Dificil' },
];

const FILTERS = ['Todos', 'A-M', 'N-Z'];

function getBadgeColor(difficulty) {
  if (difficulty === 'Facil') return '#58CC02';
  if (difficulty === 'Dificil') return '#FF4B4B';
  return '#F59E0B';
}

export default function DictionaryTabScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [filter, setFilter] = useState('Todos');

  const items = useMemo(() => {
    if (filter === 'Todos') {
      return LETTERS;
    }
    return LETTERS.filter((entry) => entry.category === filter);
  }, [filter]);

  return (
    <View style={styles.container}>
      <SectionHeader
        title="Diccionario de señas"
        subtitle="Aprende letras por categoria"
      />

      <View style={styles.filtersRow}>
        {FILTERS.map((item) => {
          const selected = item === filter;
          return (
            <FilterChip
              key={item}
              label={item}
              selected={selected}
              onPress={() => setFilter(item)}
            />
          );
        })}
      </View>

      <View style={styles.grid}>
        {items.map((item) => (
          <SurfaceCard key={`${item.letter}-${item.sign}`} style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.letter}>{item.letter}</Text>
              <View style={[styles.badge, { backgroundColor: getBadgeColor(item.difficulty) }]}>
                <Text style={styles.badgeText}>{item.difficulty}</Text>
              </View>
            </View>
            <View style={styles.signRow}>
              <Text style={styles.signLabel}>Seña:</Text>
              <Text style={styles.signGlyph}>{item.sign}</Text>
            </View>
            <Text style={styles.description}>{item.description}</Text>
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
    filtersRow: {
      flexDirection: 'row',
      gap: 8,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 10,
    },
    card: {
      width: '48.5%',
      padding: 10,
    },
    cardTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    letter: {
      fontSize: 20,
      color: theme.colors.textPrimary,
      fontWeight: '900',
    },
    sign: {
      marginTop: 6,
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '700',
    },
    signRow: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    signLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '700',
    },
    signGlyph: {
      fontSize: 24,
      color: theme.colors.primary,
      fontFamily: APP_FONTS.sign,
      fontWeight: '400',
    },
    description: {
      marginTop: 6,
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 16,
    },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
    },
  });
}
