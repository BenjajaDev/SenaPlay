import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import announce from '../../../core/a11y/announce';
import haptics from '../../../core/feedback/haptics';
import { AppText, Button, Card, IconButton, MessageDialog, ScreenHeader, useFeedback } from '../../../shared/ui';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { shuffle } from '../../levels/presentation/exercises/useSlots';
import SignImage from '../../signs/presentation/SignImage';

const BASE_PAIRS = ['a', 'b', 'c', 'd', 'e', 'f'];
const MISMATCH_MS = 750;

function createCards() {
  const cards = [];
  BASE_PAIRS.forEach((sign, index) => {
    cards.push({ id: `l-${index}`, group: sign, type: 'letter' });
    cards.push({ id: `s-${index}`, group: sign, type: 'sign' });
  });
  return shuffle(cards);
}

/** Memoria: encontrar parejas seña ↔ letra. */
export default function MemoryGameScreen({ onBack }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { confirm } = useFeedback();
  const [cards, setCards] = useState(createCards);
  const [flipped, setFlipped] = useState([]);
  const [matchedIds, setMatchedIds] = useState([]);
  const [mismatch, setMismatch] = useState([]);
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(1000);
  const [won, setWon] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const locked = flipped.length === 2;
  const started = moves > 0 && !won;

  const resetGame = () => {
    clearTimeout(timer.current);
    setCards(createCards());
    setFlipped([]);
    setMatchedIds([]);
    setMismatch([]);
    setMoves(0);
    setScore(1000);
    setWon(false);
  };

  const requestReset = async () => {
    if (!started || (await confirm({ title: '¿Reiniciar la partida?', message: 'Perderás las parejas encontradas.', confirmLabel: 'Reiniciar', tone: 'warning', icon: 'refresh' }))) {
      resetGame();
    }
  };

  const requestExit = async () => {
    if (!started || (await confirm({ title: '¿Salir del juego?', message: 'La partida en curso no se guarda.', confirmLabel: 'Salir', tone: 'warning', icon: 'exit-outline' }))) {
      onBack();
    }
  };

  const handlePress = (card) => {
    if (locked || flipped.includes(card.id) || matchedIds.includes(card.id) || won) return;
    haptics.selection();
    const next = [...flipped, card.id];
    setFlipped(next);
    if (next.length < 2) return;

    setMoves((prev) => prev + 1);
    const [first, second] = next.map((id) => cards.find((item) => item.id === id));
    const isPair = first.group === second.group && first.type !== second.type;

    if (isPair) {
      const nextMatched = [...matchedIds, first.id, second.id];
      setMatchedIds(nextMatched);
      setFlipped([]);
      setScore((prev) => prev + 100);
      haptics.success();
      announce(`Pareja encontrada: ${first.group.toUpperCase()}`);
      if (nextMatched.length === cards.length) setWon(true);
      return;
    }

    setScore((prev) => Math.max(0, prev - 50));
    setMismatch(next);
    haptics.error();
    timer.current = setTimeout(() => {
      setFlipped([]);
      setMismatch([]);
    }, MISMATCH_MS);
  };

  const renderCard = ({ item }) => {
    const faceUp = flipped.includes(item.id) || matchedIds.includes(item.id);
    const matched = matchedIds.includes(item.id);
    const wrong = mismatch.includes(item.id);
    const isSign = item.type === 'sign';
    const label = faceUp ? (isSign ? `Seña ${item.group.toUpperCase()}` : `Letra ${item.group.toUpperCase()}`) : 'Carta boca abajo';

    return (
      <Pressable
        onPress={() => handlePress(item)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ checked: matched }}
        style={({ pressed }) => [styles.cardWrap, pressed && !faceUp && styles.pressed]}
      >
        {faceUp ? (
          <View style={[styles.card, styles.cardFaceUp, matched && styles.cardMatched, wrong && styles.cardWrong]}>
            {isSign ? (
              <SignImage signKey={item.group} label={item.group.toUpperCase()} size={48} rounded={10} />
            ) : (
              <AppText variant="display" tone={matched ? 'success' : 'primary'}>
                {item.group.toUpperCase()}
              </AppText>
            )}
            <AppText variant="caption" tone="muted" style={styles.cardType}>
              {isSign ? 'SEÑA' : 'LETRA'}
            </AppText>
            {matched ? <Ionicons name="checkmark-circle" size={16} color={theme.colors.successText} style={styles.corner} /> : null}
            {wrong ? <Ionicons name="close-circle" size={16} color={theme.colors.dangerText} style={styles.corner} /> : null}
          </View>
        ) : (
          <LinearGradient {...theme.gradients.brand} style={styles.card}>
            <Ionicons name="hand-left" size={26} color={theme.colors.primaryContrast} />
          </LinearGradient>
        )}
      </Pressable>
    );
  };

  const stats = [
    { label: 'Parejas', value: `${matchedIds.length / 2}/${BASE_PAIRS.length}` },
    { label: 'Movimientos', value: String(moves) },
    { label: 'Puntos', value: String(score) },
  ];

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Memoria de señas"
        onBack={requestExit}
        rightNode={<IconButton icon="refresh" label="Reiniciar partida" onPress={requestReset} />}
      />

      <Card padding="md" style={styles.stats}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat} accessible accessibilityLabel={`${stat.label}: ${stat.value}`}>
            <AppText variant="stat">{stat.value}</AppText>
            <AppText variant="caption" tone="secondary">
              {stat.label}
            </AppText>
          </View>
        ))}
      </Card>

      <FlatList data={cards} numColumns={3} keyExtractor={(item) => item.id} renderItem={renderCard} contentContainerStyle={styles.grid} />

      <Button label="Salir" variant="secondary" icon="exit-outline" onPress={requestExit} />

      <MessageDialog
        visible={won}
        variant="celebration"
        title="¡Juego completado!"
        message={`Encontraste todas las parejas en ${moves} movimientos. Puntaje: ${score}.`}
        primaryText="Jugar otra vez"
        secondaryText="Salir"
        onPrimaryPress={resetGame}
        onSecondaryPress={onBack}
        onRequestClose={() => setWon(false)}
      />
    </View>
  );
}

function createStyles(theme) {
  const { colors, radius, spacing } = theme;
  return StyleSheet.create({
    screen: { flex: 1, gap: spacing.md },
    stats: { flexDirection: 'row', justifyContent: 'space-around' },
    stat: { alignItems: 'center' },
    grid: { gap: spacing.sm, paddingBottom: spacing.sm },
    cardWrap: { flex: 1, margin: spacing.xs },
    card: {
      height: 104,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    cardFaceUp: { backgroundColor: colors.surfaceRaised, borderColor: colors.primary },
    cardMatched: { backgroundColor: colors.successSoft, borderColor: colors.success },
    cardWrong: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
    cardType: { fontSize: 10, lineHeight: 12, marginTop: 2 },
    corner: { position: 'absolute', top: 4, right: 4 },
    pressed: { transform: [{ scale: 0.95 }] },
  });
}
