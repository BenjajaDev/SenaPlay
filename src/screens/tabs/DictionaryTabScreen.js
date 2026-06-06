import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import FilterChip from '../../components/ui/FilterChip';
import SectionHeader from '../../components/ui/SectionHeader';
import SurfaceCard from '../../components/ui/SurfaceCard';
import { APP_FONTS } from '../../constants/fonts';
import { fetchDictionary } from '../../../backend/dictionary';
import { fetchSigns } from '../../../backend/signs';
import { DICTIONARY_ENTRIES, DICTIONARY_FILTERS } from '../../data/dictionaryData';
import { REAL_SIGNS, SIGN_THEMES } from '../../data/signsData';
import { useAppTheme } from '../../theme/ThemeProvider';

const MODES = [
  { key: 'deletreo', label: 'Deletreo' },
  { key: 'senas', label: 'Señas reales' },
];

function getBadgeColor(difficulty) {
  if (difficulty === 'Fácil') return '#58CC02';
  if (difficulty === 'Difícil') return '#FF4B4B';
  return '#F59E0B';
}

export default function DictionaryTabScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [mode, setMode] = useState('deletreo');
  const [filter, setFilter] = useState('Todos');
  const [entries, setEntries] = useState(DICTIONARY_ENTRIES);
  const [signs, setSigns] = useState(REAL_SIGNS);

  useEffect(() => {
    let mounted = true;
    fetchDictionary().then((result) => {
      if (mounted) setEntries(result.entries);
    });
    fetchSigns().then((result) => {
      if (mounted) setSigns(result.signs);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Al cambiar de modo, reseteamos el filtro porque las categorias difieren.
  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setFilter('Todos');
  };

  const filters = mode === 'deletreo' ? DICTIONARY_FILTERS : SIGN_THEMES;

  const dictionaryItems = useMemo(() => {
    if (filter === 'Todos') return entries;
    return entries.filter((entry) => entry.category === filter);
  }, [entries, filter]);

  const signItems = useMemo(() => {
    if (filter === 'Todos') return signs;
    return signs.filter((s) => s.theme === filter);
  }, [signs, filter]);

  return (
    <View style={styles.container}>
      <SectionHeader
        title="Diccionario de señas"
        subtitle={mode === 'deletreo' ? 'Letras, números y acciones por categoría' : 'Señas reales (un gesto por palabra)'}
      />

      {/* Selector de modo */}
      <View style={styles.modeRow}>
        {MODES.map((m) => {
          const selected = m.key === mode;
          return (
            <Pressable
              key={m.key}
              style={[styles.modeBtn, selected && styles.modeBtnActive]}
              onPress={() => handleModeChange(m.key)}
            >
              <Text style={[styles.modeText, selected && styles.modeTextActive]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.filtersRow}>
        {filters.map((item) => (
          <FilterChip
            key={item}
            label={item}
            selected={item === filter}
            onPress={() => setFilter(item)}
          />
        ))}
      </View>

      {mode === 'deletreo' ? (
        <View style={styles.grid}>
          {dictionaryItems.map((item) => {
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
                  <Text style={[styles.signGlyph, isMulti && styles.signGlyphSmall]}>{item.sign}</Text>
                </View>
                <Text style={styles.description}>{item.description}</Text>
              </SurfaceCard>
            );
          })}
        </View>
      ) : (
        <View style={styles.signsList}>
          {signItems.map((item) => (
            <SurfaceCard key={item.word} style={styles.signCard}>
              <View style={styles.cardTopRow}>
                <Text style={styles.word}>{item.word}</Text>
                {item.type ? (
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{item.type}</Text>
                  </View>
                ) : null}
              </View>
              {item.meaning ? <Text style={styles.meaning}>{item.meaning}</Text> : null}
              <View style={styles.howToRow}>
                <Text style={styles.howToLabel}>Cómo se hace</Text>
                <Text style={styles.howToText}>{item.howTo}</Text>
              </View>
              {item.page ? <Text style={styles.sourceRef}>Diccionario MINEDUC · pág. {item.page}</Text> : null}
            </SurfaceCard>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { gap: 12 },
    modeRow: {
      flexDirection: 'row',
      backgroundColor: theme.mode === 'dark' ? '#251E3B' : '#EDE7F6',
      borderRadius: 14,
      padding: 4,
      gap: 4,
    },
    modeBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 11,
      alignItems: 'center',
    },
    modeBtnActive: { backgroundColor: theme.colors.primary },
    modeText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
    modeTextActive: { color: theme.colors.primaryContrast },
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
    // Senas reales
    signsList: { gap: 10 },
    signCard: { padding: 14 },
    word: {
      fontSize: 17,
      color: theme.colors.textPrimary,
      fontWeight: '900',
      flexShrink: 1,
    },
    typeBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 3,
      backgroundColor: theme.mode === 'dark' ? '#33294F' : '#EDE7F6',
    },
    typeBadgeText: {
      color: theme.colors.primary,
      fontSize: 10,
      fontWeight: '800',
    },
    meaning: {
      marginTop: 6,
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    howToRow: {
      marginTop: 10,
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.mode === 'dark' ? '#221F31' : '#F7F4FC',
      borderWidth: 1,
      borderColor: theme.mode === 'dark' ? '#3A3352' : '#E6DEF6',
    },
    howToLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    howToText: {
      fontSize: 13,
      color: theme.colors.textPrimary,
      lineHeight: 19,
    },
    sourceRef: {
      marginTop: 8,
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
  });
}
