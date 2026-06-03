import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FilterChip from '../../components/ui/FilterChip';
import SectionHeader from '../../components/ui/SectionHeader';
import SurfaceCard from '../../components/ui/SurfaceCard';
import { APP_FONTS } from '../../constants/fonts';
import { useAppTheme } from '../../theme/ThemeProvider';

const ENTRIES = [
  // Letras A-M
  { letter: 'A', sign: 'a', description: 'Puño cerrado con pulgar al lado', category: 'A-M', difficulty: 'Fácil' },
  { letter: 'B', sign: 'b', description: 'Dedos juntos hacia arriba', category: 'A-M', difficulty: 'Fácil' },
  { letter: 'C', sign: 'c', description: 'Mano curvada en forma de C', category: 'A-M', difficulty: 'Fácil' },
  { letter: 'D', sign: 'd', description: 'Índice arriba, otros dedos doblados', category: 'A-M', difficulty: 'Fácil' },
  { letter: 'E', sign: 'e', description: 'Dedos doblados sobre la palma', category: 'A-M', difficulty: 'Fácil' },
  { letter: 'F', sign: 'f', description: 'Círculo entre índice y pulgar', category: 'A-M', difficulty: 'Medio' },
  { letter: 'G', sign: 'g', description: 'Índice y pulgar extendidos en horizontal', category: 'A-M', difficulty: 'Medio' },
  { letter: 'H', sign: 'h', description: 'Índice y medio extendidos en horizontal', category: 'A-M', difficulty: 'Medio' },
  { letter: 'I', sign: 'i', description: 'Meñique extendido hacia arriba', category: 'A-M', difficulty: 'Medio' },
  { letter: 'J', sign: 'j', description: 'Meñique dibuja una J en el aire', category: 'A-M', difficulty: 'Medio' },
  { letter: 'K', sign: 'k', description: 'Índice arriba y medio en ángulo', category: 'A-M', difficulty: 'Medio' },
  { letter: 'L', sign: 'l', description: 'Índice y pulgar en forma de L', category: 'A-M', difficulty: 'Medio' },
  { letter: 'M', sign: 'm', description: 'Pulgar bajo tres dedos', category: 'A-M', difficulty: 'Medio' },

  // Letras N-Z
  { letter: 'N', sign: 'n', description: 'Pulgar entre medio y anular', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'Ñ', sign: 'ñ', description: 'N con movimiento ondulatorio', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'O', sign: 'o', description: 'Todos los dedos forman un círculo', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'P', sign: 'p', description: 'Como K pero apuntando hacia abajo', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'Q', sign: 'q', description: 'Como G pero hacia abajo', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'R', sign: 'r', description: 'Índice y medio cruzados', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'S', sign: 's', description: 'Puño cerrado con pulgar sobre dedos', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'T', sign: 't', description: 'Pulgar entre índice y medio', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'U', sign: 'u', description: 'Índice y medio juntos hacia arriba', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'V', sign: 'v', description: 'Índice y medio separados en V', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'W', sign: 'w', description: 'Índice, medio y anular separados', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'X', sign: 'x', description: 'Índice doblado como gancho', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'Y', sign: 'y', description: 'Pulgar y meñique extendidos', category: 'N-Z', difficulty: 'Difícil' },
  { letter: 'Z', sign: 'z', description: 'Índice dibuja una Z en el aire', category: 'N-Z', difficulty: 'Difícil' },

  // Números (deletreados)
  { letter: 'UNO (1)', sign: 'uno', description: 'Se deletrea U-N-O', category: 'Números', difficulty: 'Fácil' },
  { letter: 'DOS (2)', sign: 'dos', description: 'Se deletrea D-O-S', category: 'Números', difficulty: 'Fácil' },
  { letter: 'TRES (3)', sign: 'tres', description: 'Se deletrea T-R-E-S', category: 'Números', difficulty: 'Fácil' },
  { letter: 'CUATRO (4)', sign: 'cuatro', description: 'Se deletrea C-U-A-T-R-O', category: 'Números', difficulty: 'Medio' },
  { letter: 'CINCO (5)', sign: 'cinco', description: 'Mano abierta, todos los dedos extendidos', category: 'Números', difficulty: 'Fácil' },
  { letter: 'SEIS (6)', sign: 'seis', description: 'Se deletrea S-E-I-S', category: 'Números', difficulty: 'Medio' },
  { letter: 'SIETE (7)', sign: 'siete', description: 'Se deletrea S-I-E-T-E', category: 'Números', difficulty: 'Medio' },
  { letter: 'OCHO (8)', sign: 'ocho', description: 'Se deletrea O-C-H-O', category: 'Números', difficulty: 'Medio' },
  { letter: 'NUEVE (9)', sign: 'nueve', description: 'Se deletrea N-U-E-V-E', category: 'Números', difficulty: 'Medio' },
  { letter: 'DIEZ (10)', sign: 'diez', description: 'Se deletrea D-I-E-Z', category: 'Números', difficulty: 'Medio' },

  // Acciones / verbos
  { letter: 'COMER', sign: 'comer', description: 'Llevar la mano cerrada hacia la boca', category: 'Acciones', difficulty: 'Fácil' },
  { letter: 'BEBER', sign: 'beber', description: 'Simular tomar un vaso con la mano', category: 'Acciones', difficulty: 'Fácil' },
  { letter: 'DORMIR', sign: 'dormir', description: 'Mano apoyada en la mejilla, cabeza inclinada', category: 'Acciones', difficulty: 'Medio' },
  { letter: 'CORRER', sign: 'correr', description: 'Movimiento alternado de manos como brazos al correr', category: 'Acciones', difficulty: 'Medio' },
  { letter: 'CAMINAR', sign: 'caminar', description: 'Dedos índice y medio simulando pasos', category: 'Acciones', difficulty: 'Medio' },
  { letter: 'JUGAR', sign: 'jugar', description: 'Manos con pulgar y meñique extendidos, sacudidas', category: 'Acciones', difficulty: 'Medio' },
  { letter: 'LEER', sign: 'leer', description: 'Dos dedos en V apuntando a la palma como ojos leyendo', category: 'Acciones', difficulty: 'Medio' },
  { letter: 'ESCRIBIR', sign: 'escribir', description: 'Simular escribir con una mano sobre la palma', category: 'Acciones', difficulty: 'Medio' },
  { letter: 'HABLAR', sign: 'hablar', description: 'Dedos abriendo y cerrando frente a la boca', category: 'Acciones', difficulty: 'Medio' },
  { letter: 'TRABAJAR', sign: 'trabajar', description: 'Puños cerrados, uno golpea el otro', category: 'Acciones', difficulty: 'Difícil' },
];

const FILTERS = ['Todos', 'A-M', 'N-Z', 'Números', 'Acciones'];

function getBadgeColor(difficulty) {
  if (difficulty === 'Fácil') return '#58CC02';
  if (difficulty === 'Difícil') return '#FF4B4B';
  return '#F59E0B';
}

export default function DictionaryTabScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [filter, setFilter] = useState('Todos');

  const items = useMemo(() => {
    if (filter === 'Todos') return ENTRIES;
    return ENTRIES.filter((entry) => entry.category === filter);
  }, [filter]);

  return (
    <View style={styles.container}>
      <SectionHeader title="Diccionario de señas" subtitle="Letras, números y acciones por categoría" />

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
        {items.map((item) => {
          const isMulti = item.sign.length > 1;
          return (
            <SurfaceCard key={`${item.letter}-${item.sign}`} style={styles.card}>
              <View style={styles.cardTopRow}>
                <Text style={styles.letter}>{item.letter}</Text>
                <View style={[styles.badge, { backgroundColor: getBadgeColor(item.difficulty) }]}>
                  <Text style={styles.badgeText}>{item.difficulty}</Text>
                </View>
              </View>
              <View style={styles.signRow}>
                <Text style={styles.signLabel}>Seña:</Text>
                <Text style={[styles.signGlyph, isMulti && styles.signGlyphSmall]}>
                  {item.sign}
                </Text>
              </View>
              <Text style={styles.description}>{item.description}</Text>
            </SurfaceCard>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { gap: 12 },
    filtersRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 10,
    },
    card: { width: '48.5%', padding: 10 },
    cardTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    letter: {
      fontSize: 16,
      color: theme.colors.textPrimary,
      fontWeight: '900',
      flexShrink: 1,
    },
    signRow: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
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
      flexShrink: 1,
    },
    signGlyphSmall: {
      fontSize: 18,
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
