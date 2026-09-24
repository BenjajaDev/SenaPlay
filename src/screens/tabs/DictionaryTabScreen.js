import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import SignDetailModal from '../../components/SignDetailModal';
import FilterChip from '../../components/ui/FilterChip';
import SectionHeader from '../../components/ui/SectionHeader';
import SignImage from '../../components/ui/SignImage';
import SurfaceCard from '../../components/ui/SurfaceCard';
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

// Las entradas de deletreo y las señas léxicas vienen con formas distintas.
// Se normalizan aquí para que el modal reciba siempre el mismo objeto.
function entryToDetail(entry) {
  return {
    signKey: entry.sign,
    title: entry.letter,
    subtitle: entry.category,
    badge: entry.difficulty,
    badgeColor: getBadgeColor(entry.difficulty),
    howTo: entry.description,
  };
}

function signToDetail(sign) {
  return {
    signKey: sign.word,
    title: sign.word,
    subtitle: sign.theme,
    badge: sign.type,
    description: sign.meaning,
    howTo: sign.howTo,
    source: sign.page ? `Diccionario MINEDUC · pág. ${sign.page}` : null,
  };
}

// Tarjetas memoizadas: la grilla del diccionario carga fotos reales (pesadas
// de decodificar), así que evitar que TODAS se vuelvan a renderizar cada vez
// que se abre el modal de detalle (o cualquier otro cambio de estado ajeno a
// ellas) es lo que mantiene el scroll fluido. `onPress` recibe el `item`
// para no crear un closure nuevo por tarjeta en cada render del padre.
const DictionaryCard = memo(function DictionaryCard({ item, onPress, styles, theme }) {
  return (
    <SurfaceCard style={styles.card}>
      <Pressable
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`Ver la seña completa de ${item.letter}`}
      >
        <View style={styles.cardTopRow}>
          <Text style={styles.letter}>{item.letter}</Text>
          <View style={[styles.badge, { backgroundColor: getBadgeColor(item.difficulty) }]}>
            <Text style={styles.badgeText}>{item.difficulty}</Text>
          </View>
        </View>
        <View style={styles.signRow}>
          <SignImage signKey={item.sign} label={item.letter} size={96} />
        </View>
        <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
        <View style={styles.verMasRow}>
          <Text style={styles.verMasTexto}>Ver seña</Text>
          <Ionicons name="chevron-forward" size={12} color={theme.colors.primary} />
        </View>
      </Pressable>
    </SurfaceCard>
  );
});

const SignListCard = memo(function SignListCard({ item, onPress, styles, theme }) {
  return (
    <SurfaceCard style={styles.signCard}>
      <Pressable
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`Ver la seña completa de ${item.word}`}
        style={styles.signCardInner}
      >
        <SignImage signKey={item.word} label={item.word.slice(0, 3)} size={84} />
        <View style={styles.signCardTexts}>
          <View style={styles.cardTopRow}>
            <Text style={styles.word}>{item.word}</Text>
            {item.type ? (
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{item.type}</Text>
              </View>
            ) : null}
          </View>
          {item.meaning ? (
            <Text style={styles.meaning} numberOfLines={2}>{item.meaning}</Text>
          ) : null}
          <View style={styles.verMasRow}>
            <Text style={styles.verMasTexto}>Ver seña completa</Text>
            <Ionicons name="chevron-forward" size={12} color={theme.colors.primary} />
          </View>
        </View>
      </Pressable>
    </SurfaceCard>
  );
});

export default function DictionaryTabScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [mode, setMode] = useState('deletreo');
  const [filter, setFilter] = useState('Todos');
  const [entries, setEntries] = useState(DICTIONARY_ENTRIES);
  const [signs, setSigns] = useState(REAL_SIGNS);
  const [detail, setDetail] = useState(null);

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

  // Referencias estables: así React.memo evita re-renderizar cada tarjeta
  // cuando lo único que cambió fue, por ejemplo, el modal de detalle.
  const openEntryDetail = useCallback((item) => setDetail(entryToDetail(item)), []);
  const openSignDetail = useCallback((item) => setDetail(signToDetail(item)), []);

  const renderDictionaryItem = useCallback(
    ({ item }) => <DictionaryCard item={item} onPress={openEntryDetail} styles={styles} theme={theme} />,
    [openEntryDetail, styles, theme],
  );
  const renderSignItem = useCallback(
    ({ item }) => <SignListCard item={item} onPress={openSignDetail} styles={styles} theme={theme} />,
    [openSignDetail, styles, theme],
  );

  const header = (
    <View style={styles.header}>
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
    </View>
  );

  return (
    <View style={styles.container}>
      {mode === 'deletreo' ? (
        <FlatList
          key="grid"
          data={dictionaryItems}
          keyExtractor={(item) => `${item.letter}-${item.sign}`}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          renderItem={renderDictionaryItem}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          // Solo se monta/decodifica lo visible (+colchón): con fotos reales
          // de ~300KB cada una, esto es lo que evita el jank al scrollear.
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews
        />
      ) : (
        <FlatList
          key="list"
          data={signItems}
          keyExtractor={(item) => item.word}
          renderItem={renderSignItem}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews
        />
      )}

      <SignDetailModal
        visible={detail !== null}
        detail={detail}
        onClose={() => setDetail(null)}
      />
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: { gap: 12, paddingBottom: 12 },
    listContent: { paddingBottom: 12 },
    modeRow: {
      flexDirection: 'row',
      backgroundColor: theme.mode === 'dark' ? '#251E3B' : '#F3DFFB',
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
    gridRow: {
      justifyContent: 'space-between',
    },
    card: { width: '48.5%', padding: 10, marginBottom: 10 },
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
      marginTop: 8,
      alignItems: 'center',
    },
    verMasRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    verMasTexto: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.primary,
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
    signCard: { padding: 14, marginBottom: 10 },
    signCardInner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    signCardTexts: { flex: 1, minWidth: 0 },
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
      backgroundColor: theme.mode === 'dark' ? '#33294F' : '#F3DFFB',
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
  });
}
