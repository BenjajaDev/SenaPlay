import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useMemo, useState } from 'react';
import { ScrollView, SectionList, StyleSheet, View } from 'react-native';
import useStaleWhileRevalidate from '../../../core/data/useStaleWhileRevalidate';
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
  TextField,
} from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { CLUB_INDEX } from '../../signs/data/local/clubCatalog';
import { DICTIONARY_ENTRIES } from '../../signs/data/local/dictionaryData';
import { REAL_SIGNS } from '../../signs/data/local/signsData';
import SignImage from '../../signs/presentation/SignImage';
import {
  ALL_THEMES,
  buildSearchIndex,
  filterSigns,
  groupSignsByTheme,
  groupSpellingEntries,
  signToDetail,
  spellingFilters,
  themeFilters,
} from '../domain/vocabulary';
import SignDetailModal from './SignDetailModal';

const LOCAL_DICTIONARY = { entries: DICTIONARY_ENTRIES, source: 'local' };
const LOCAL_VOCABULARY = { signs: REAL_SIGNS, source: 'local' };

const MODES = [
  { key: 'deletreo', label: 'Deletreo' },
  { key: 'senas', label: 'Señas reales' },
];

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
          {/* El tema ya es el encabezado de la sección: solo se repite el significado. */}
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

// La grilla de deletreo va en filas de dos: SectionList no tiene numColumns.
const GRID_COLUMNS = 2;
const toRows = (items) =>
  Array.from({ length: Math.ceil(items.length / GRID_COLUMNS) }, (_, row) => items.slice(row * GRID_COLUMNS, (row + 1) * GRID_COLUMNS));

const countLabel = (count) => `${count} ${count === 1 ? 'seña' : 'señas'}`;

/** Encabezado fijo de cada sección: el tema y cuántas señas tiene. */
const SectionTitle = memo(function SectionTitle({ title, count, styles }) {
  return (
    <View style={styles.sectionHeader} accessible accessibilityRole="header" accessibilityLabel={`${title}, ${countLabel(count)}`}>
      <AppText variant="heading" style={styles.shrink}>
        {title}
      </AppText>
      <AppText variant="label" tone="secondary">
        {count}
      </AppText>
    </View>
  );
});

export default function DictionaryTabScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { signs: signsRepository } = useServices();
  const [mode, setMode] = useState('deletreo');
  const [filter, setFilter] = useState(ALL_THEMES);
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState(null);
  // El contenido empaquetado se ve desde el primer frame; la caché y luego el
  // remoto lo reemplazan en silencio. Por eso aquí no hay skeleton.
  const { data: dictionary } = useStaleWhileRevalidate(
    signsRepository.getCachedDictionary,
    signsRepository.getDictionary,
    LOCAL_DICTIONARY,
  );
  const { data: vocabulary } = useStaleWhileRevalidate(
    signsRepository.getCachedVocabulary,
    signsRepository.getVocabulary,
    LOCAL_VOCABULARY,
  );
  const entries = dictionary.entries;
  const signs = vocabulary.signs;

  // Al cambiar de modo se resetea el filtro: las categorías difieren.
  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setFilter(ALL_THEMES);
  };

  // Los temas salen de los datos: si el remoto trae más (o menos) que lo guardado, los chips se ajustan.
  const themes = useMemo(() => themeFilters(signs), [signs]);
  const filters = useMemo(() => (mode === 'deletreo' ? spellingFilters(entries) : themes), [mode, entries, themes]);
  const activeFilter = filters.includes(filter) ? filter : ALL_THEMES;

  // Secciones con el número total de señas (no de filas): la grilla agrupa de a dos.
  const spellingSections = useMemo(
    () =>
      groupSpellingEntries(entries, { section: activeFilter, query }).map((section) => ({
        title: section.title,
        count: section.data.length,
        data: toRows(section.data),
      })),
    [entries, activeFilter, query],
  );

  // El texto de búsqueda se normaliza una vez por lista de señas, no en cada tecla.
  const searchIndex = useMemo(() => buildSearchIndex(signs), [signs]);
  const signSections = useMemo(
    () =>
      groupSignsByTheme(filterSigns(searchIndex, { theme: activeFilter, query }), CLUB_INDEX.positionByKey).map((section) => ({
        ...section,
        count: section.data.length,
      })),
    [searchIndex, activeFilter, query],
  );
  const signCount = useMemo(() => signSections.reduce((total, section) => total + section.count, 0), [signSections]);

  // Salida del estado vacío: vuelve a la lista completa sin borrar a mano.
  const clearSearch = useCallback(() => {
    setQuery('');
    setFilter(ALL_THEMES);
  }, []);

  const openEntryDetail = useCallback((item) => setDetail(entryToDetail(item)), []);
  const openSignDetail = useCallback((item) => setDetail(signToDetail(item)), []);

  const renderDictionaryRow = useCallback(
    ({ item }) => (
      <View style={styles.gridRow}>
        {item.map((entry) => (
          <DictionaryCard key={`${entry.letter}-${entry.sign}`} item={entry} onPress={openEntryDetail} styles={styles} theme={theme} />
        ))}
      </View>
    ),
    [openEntryDetail, styles, theme],
  );
  const renderSignItem = useCallback(
    ({ item }) => <SignListCard item={item} onPress={openSignDetail} styles={styles} theme={theme} />,
    [openSignDetail, styles, theme],
  );

  const renderSectionHeader = useCallback(
    ({ section }) => <SectionTitle title={section.title} count={section.count} styles={styles} />,
    [styles],
  );

  const header = (
    <View style={styles.header}>
      <SectionHeader
        title="Diccionario de señas"
        subtitle={
          mode === 'deletreo' ? 'Abecedario y acciones, en orden' : `Señas reales · ${countLabel(signCount)} por tema, en el orden del curso`
        }
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
      {mode === 'deletreo' ? (
        <View style={styles.filtersRow}>
          {filters.map((item) => (
            <Chip key={item} label={item} selected={item === activeFilter} onPress={() => setFilter(item)} />
          ))}
        </View>
      ) : (
        // Con una veintena de temas, un chip por fila ocuparía media pantalla: se desplazan de lado.
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.filtersScrollView}
          contentContainerStyle={styles.filtersScroll}
          accessibilityLabel="Filtrar por tema"
        >
          {filters.map((item) => (
            <Chip key={item} label={item} selected={item === activeFilter} onPress={() => setFilter(item)} />
          ))}
        </ScrollView>
      )}
    </View>
  );

  const empty = (
    <EmptyState
      icon="search"
      title="Sin resultados"
      message="Prueba con otra palabra o quita el filtro."
      actionLabel={query || activeFilter !== ALL_THEMES ? 'Ver todo' : undefined}
      onAction={clearSearch}
    />
  );

  const listProps = {
    ListHeaderComponent: header,
    ListEmptyComponent: empty,
    contentContainerStyle: styles.listContent,
    showsVerticalScrollIndicator: false,
    keyboardShouldPersistTaps: 'handled',
    // El tema queda fijo arriba mientras se recorre: se sabe siempre dónde se está.
    stickySectionHeadersEnabled: true,
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
        <SectionList
          key="grid"
          sections={spellingSections}
          keyExtractor={(row) => row.map((entry) => `${entry.letter}-${entry.sign}`).join('|')}
          renderItem={renderDictionaryRow}
          renderSectionHeader={renderSectionHeader}
          {...listProps}
        />
      ) : (
        <SectionList
          key="list"
          sections={signSections}
          keyExtractor={(item) => item.word}
          renderItem={renderSignItem}
          renderSectionHeader={renderSectionHeader}
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
    // El ScrollView mide lo que el chip (36 px) y en Android recorta su hitSlop:
    // el relleno vertical devuelve el área táctil a 44 px y el margen negativo
    // mantiene el ritmo del encabezado.
    filtersScrollView: { marginVertical: -spacing.xs },
    filtersScroll: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.md, paddingVertical: spacing.xs },
    filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    gridRow: { flexDirection: 'row', justifyContent: 'space-between' },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      // Fijo arriba: tapa lo que pasa por debajo con el mismo fondo de la pantalla.
      backgroundColor: theme.colors.background,
    },
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
