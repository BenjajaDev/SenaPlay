import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useServices } from '../../../core/di/ServicesProvider';
import {
  AppText,
  Badge,
  Card,
  Chip,
  difficultyBadgeProps,
  EmptyState,
  SectionHeader,
  SegmentedControl,
  SkeletonList,
  TextField,
} from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { DICTIONARY_ENTRIES, DICTIONARY_FILTERS } from '../../signs/data/local/dictionaryData';
import { REAL_SIGNS, SIGN_THEMES } from '../../signs/data/local/signsData';
import SignImage from '../../signs/presentation/SignImage';
import SignDetailModal from './SignDetailModal';

const MODES = [
  { key: 'deletreo', label: 'Deletreo' },
  { key: 'senas', label: 'Señas reales' },
];

const normalizeText = (value) =>
  String(value || '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// Las entradas de deletreo y las señas léxicas vienen con formas distintas.
// Se normalizan aquí para que el modal reciba siempre el mismo objeto.
function entryToDetail(entry) {
  const badge = difficultyBadgeProps(entry.difficulty);
  return {
    signKey: entry.sign,
    title: entry.letter,
    subtitle: entry.category,
    badge: entry.difficulty,
    badgeTone: badge.tone,
    badgeIcon: badge.icon,
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

// Tarjetas memoizadas: la grilla carga fotos reales (pesadas de decodificar),
// así que evitar re-renderizarlas todas al abrir el modal mantiene el scroll
// fluido. `onPress` recibe el item para no crear un closure por tarjeta.
const DictionaryCard = memo(function DictionaryCard({ item, onPress, styles, theme }) {
  return (
    <Card
      padding="md"
      onPress={() => onPress(item)}
      accessibilityLabel={`Ver la seña de ${item.letter}, dificultad ${item.difficulty}`}
      style={styles.gridCard}
    >
      <View style={styles.cardTopRow}>
        <AppText variant="heading" style={styles.shrink}>
          {item.letter}
        </AppText>
        <Badge label={item.difficulty} {...difficultyBadgeProps(item.difficulty)} />
      </View>
      <View style={styles.signRow}>
        <SignImage signKey={item.sign} label={item.letter} size={96} />
      </View>
      <AppText variant="caption" tone="secondary" numberOfLines={3} style={styles.description}>
        {item.description}
      </AppText>
      <View style={styles.moreRow}>
        <AppText variant="label" tone="brand">
          Ver seña
        </AppText>
        <Ionicons name="chevron-forward" size={12} color={theme.colors.primary} />
      </View>
    </Card>
  );
});

const SignListCard = memo(function SignListCard({ item, onPress, styles, theme }) {
  return (
    <Card padding="md" onPress={() => onPress(item)} accessibilityLabel={`Ver la seña completa de ${item.word}`} style={styles.listCard}>
      <View style={styles.signCardInner}>
        <SignImage signKey={item.word} label={item.word.slice(0, 3)} size={84} />
        <View style={styles.signCardTexts}>
          <View style={styles.cardTopRow}>
            <AppText variant="heading" style={styles.shrink}>
              {item.word}
            </AppText>
            {item.type ? <Badge label={item.type} /> : null}
          </View>
          {item.meaning ? (
            <AppText variant="caption" tone="secondary" numberOfLines={2}>
              {item.meaning}
            </AppText>
          ) : null}
          <View style={styles.moreRow}>
            <AppText variant="label" tone="brand">
              Ver seña completa
            </AppText>
            <Ionicons name="chevron-forward" size={12} color={theme.colors.primary} />
          </View>
        </View>
      </View>
    </Card>
  );
});

export default function DictionaryTabScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { signs: signsRepository } = useServices();
  const [mode, setMode] = useState('deletreo');
  const [filter, setFilter] = useState('Todos');
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState(DICTIONARY_ENTRIES);
  const [signs, setSigns] = useState(REAL_SIGNS);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([signsRepository.getDictionary(), signsRepository.getVocabulary()]).then(([dictionary, vocabulary]) => {
      if (!mounted) return;
      setEntries(dictionary.entries);
      setSigns(vocabulary.signs);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [signsRepository]);

  // Al cambiar de modo se resetea el filtro: las categorías difieren.
  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setFilter('Todos');
  };

  const filters = mode === 'deletreo' ? DICTIONARY_FILTERS : SIGN_THEMES;
  const search = normalizeText(query.trim());

  const dictionaryItems = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (filter === 'Todos' || entry.category === filter) &&
          (!search || normalizeText(`${entry.letter} ${entry.description}`).includes(search)),
      ),
    [entries, filter, search],
  );

  const signItems = useMemo(
    () =>
      signs.filter(
        (sign) =>
          (filter === 'Todos' || sign.theme === filter) &&
          (!search || normalizeText(`${sign.word} ${sign.meaning}`).includes(search)),
      ),
    [signs, filter, search],
  );

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
      <SegmentedControl options={MODES} value={mode} onChange={handleModeChange} />
      <TextField
        icon="search"
        placeholder={mode === 'deletreo' ? 'Buscar letra o descripción…' : 'Buscar palabra…'}
        value={query}
        onChangeText={setQuery}
        accessibilityLabel="Buscar en el diccionario"
        returnKeyType="search"
        autoCorrect={false}
      />
      <View style={styles.filtersRow}>
        {filters.map((item) => (
          <Chip key={item} label={item} selected={item === filter} onPress={() => setFilter(item)} />
        ))}
      </View>
      {loading ? <SkeletonList count={3} label="Cargando diccionario" /> : null}
    </View>
  );

  const empty = loading ? null : (
    <EmptyState icon="search" title="Sin resultados" message="Prueba con otra palabra o quita el filtro." />
  );

  const listProps = {
    ListHeaderComponent: header,
    ListEmptyComponent: empty,
    contentContainerStyle: styles.listContent,
    showsVerticalScrollIndicator: false,
    keyboardShouldPersistTaps: 'handled',
    // Solo se monta/decodifica lo visible (+colchón): con fotos reales de
    // ~300KB cada una, esto evita el jank al hacer scroll.
    initialNumToRender: 8,
    maxToRenderPerBatch: 6,
    windowSize: 7,
    removeClippedSubviews: true,
  };

  return (
    <View style={styles.container}>
      {mode === 'deletreo' ? (
        <FlatList
          key="grid"
          data={loading ? [] : dictionaryItems}
          keyExtractor={(item) => `${item.letter}-${item.sign}`}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          renderItem={renderDictionaryItem}
          {...listProps}
        />
      ) : (
        <FlatList
          key="list"
          data={loading ? [] : signItems}
          keyExtractor={(item) => item.word}
          renderItem={renderSignItem}
          {...listProps}
        />
      )}

      <SignDetailModal visible={detail !== null} detail={detail} onClose={() => setDetail(null)} />
    </View>
  );
}

function createStyles(theme) {
  const { spacing } = theme;
  return StyleSheet.create({
    container: { flex: 1 },
    header: { gap: spacing.md, paddingBottom: spacing.md },
    listContent: { paddingBottom: spacing.md },
    filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    gridRow: { justifyContent: 'space-between' },
    gridCard: { width: '48.5%', marginBottom: spacing.sm + 2 },
    listCard: { marginBottom: spacing.sm + 2 },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
    shrink: { flexShrink: 1 },
    signRow: { marginTop: spacing.sm, alignItems: 'center' },
    description: { marginTop: spacing.xs + 2 },
    moreRow: { marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 2 },
    signCardInner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    signCardTexts: { flex: 1, minWidth: 0, gap: spacing.xs },
  });
}
