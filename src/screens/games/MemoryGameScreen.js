import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AdaptiveModal from '../../components/AdaptiveModal';
import ActionButton from '../../components/ui/ActionButton';
import GameScreenHeader from '../../components/ui/GameScreenHeader';
import SignImage from '../../components/ui/SignImage';
import SurfaceCard from '../../components/ui/SurfaceCard';
import { useAppTheme } from '../../theme/ThemeProvider';

const BASE_PAIRS = [
  ['A', 'a'],
  ['B', 'b'],
  ['C', 'c'],
  ['D', 'd'],
  ['E', 'e'],
  ['F', 'f'],
];

function shuffle(items) {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = clone[i];
    clone[i] = clone[j];
    clone[j] = temp;
  }
  return clone;
}

function createCards() {
  const cards = [];
  BASE_PAIRS.forEach(([letter, sign], index) => {
    cards.push({ id: `l-${index}`, group: sign, type: 'letter', value: letter });
    cards.push({ id: `s-${index}`, group: sign, type: 'sign', value: sign });
  });
  return shuffle(cards);
}

export default function MemoryGameScreen({ onBack }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [cards, setCards] = useState(createCards);
  const [flipped, setFlipped] = useState([]);
  const [matchedIds, setMatchedIds] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(1000);
  const [showWinModal, setShowWinModal] = useState(false);

  const pairsFound = matchedIds.length / 2;

  const completed = useMemo(() => matchedIds.length === cards.length && cards.length > 0, [matchedIds, cards]);

  const resetGame = () => {
    setCards(createCards());
    setFlipped([]);
    setMatchedIds([]);
    setIsLocked(false);
    setMoves(0);
    setScore(1000);
    setShowWinModal(false);
  };

  const checkPair = (firstId, secondId, nextCards) => {
    const first = nextCards.find((item) => item.id === firstId);
    const second = nextCards.find((item) => item.id === secondId);

    const isPair =
      first &&
      second &&
      first.group === second.group &&
      first.type !== second.type;

    if (isPair) {
      const nextMatched = [...matchedIds, firstId, secondId];
      setMatchedIds(nextMatched);
      setFlipped([]);
      setIsLocked(false);
      setScore((prev) => prev + 100);

      if (nextMatched.length === nextCards.length) {
        setShowWinModal(true);
      }
      return;
    }

    setTimeout(() => {
      setFlipped([]);
      setIsLocked(false);
    }, 700);
  };

  const handlePressCard = (cardId) => {
    if (isLocked || flipped.includes(cardId) || matchedIds.includes(cardId) || completed) {
      return;
    }

    const nextFlipped = [...flipped, cardId];
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      setMoves((prev) => prev + 1);
      setScore((prev) => Math.max(0, prev - 50));
      setIsLocked(true);
      checkPair(nextFlipped[0], nextFlipped[1], cards);
    }
  };

  const renderCard = ({ item }) => {
    const isFaceUp = flipped.includes(item.id) || matchedIds.includes(item.id);
    const isMatched = matchedIds.includes(item.id);
    const isSign = item.type === 'sign';
    const displayValue = isSign ? item.value : item.value.toUpperCase();

    return (
      <Pressable
        style={[
          styles.card,
          isFaceUp && styles.cardFaceUp,
          isMatched && styles.cardMatched,
        ]}
        onPress={() => handlePressCard(item.id)}
      >
        {isFaceUp ? (
          <>
            {isSign ? (
              <SignImage
                signKey={item.value}
                label={item.value.toUpperCase()}
                size={46}
                rounded={10}
              />
            ) : (
              <Text style={styles.cardValue}>{displayValue}</Text>
            )}
            <Text style={styles.cardType}>{item.type === 'sign' ? 'SEÑA' : 'LETRA'}</Text>
          </>
        ) : (
          <Ionicons name="help" size={26} color={theme.colors.primaryContrast} />
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <GameScreenHeader
        title="Memoria de SEÑAS"
        onBack={onBack}
        rightNode={(
          <Pressable onPress={resetGame} hitSlop={8}>
            <Ionicons name="refresh" size={24} color={theme.colors.textPrimary} />
          </Pressable>
        )}
      />

      <SurfaceCard style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{pairsFound}/6</Text>
          <Text style={styles.statLabel}>Parejas</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{moves}</Text>
          <Text style={styles.statLabel}>Movimientos</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{score}</Text>
          <Text style={styles.statLabel}>Puntos</Text>
        </View>
      </SurfaceCard>

      <FlatList
        data={cards}
        numColumns={3}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={styles.grid}
      />

      <View style={styles.footer}>
        <ActionButton label="Reiniciar" variant="secondary" onPress={resetGame} style={styles.actionBtn} />
        <ActionButton label="Salir" onPress={onBack} style={[styles.actionBtn, styles.exitBtn]} />
      </View>

      <AdaptiveModal
        visible={showWinModal}
        context="level-complete"
        title="Juego completado"
        message={`Terminaste con ${score} puntos en ${moves} movimientos.`}
        primaryText="Jugar otra vez"
        secondaryText="Volver"
        onPrimaryPress={resetGame}
        onSecondaryPress={onBack}
        onRequestClose={() => setShowWinModal(false)}
      />
    </View>
  );
}

function createStyles(theme) {
  const isDark = theme.mode === 'dark';

  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    statsCard: {
      paddingVertical: 12,
      paddingHorizontal: 10,
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 12,
      backgroundColor: isDark ? '#231D37' : theme.colors.surface,
      borderColor: isDark ? '#4B3B73' : theme.colors.border,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 19,
      fontWeight: '900',
      color: theme.colors.textPrimary,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    grid: {
      gap: 10,
    },
    card: {
      flex: 1,
      minHeight: 96,
      margin: 5,
      borderRadius: 14,
      backgroundColor: isDark ? '#3B2F58' : '#7E57C2',
      borderWidth: 1,
      borderColor: isDark ? '#5D4A85' : '#7E57C2',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardFaceUp: {
      backgroundColor: isDark ? '#2B2341' : '#F8FAFC',
      borderWidth: 2,
      borderColor: isDark ? '#F2C94C' : '#60A5FA',
    },
    cardMatched: {
      backgroundColor: isDark ? '#2D5A31' : '#58CC02',
      borderColor: isDark ? '#7EDB43' : '#58CC02',
    },
    cardValue: {
      color: isDark ? '#FFF8E6' : '#0F172A',
      fontSize: 28,
      fontWeight: '800',
    },
    cardType: {
      marginTop: 4,
      fontSize: 10,
      fontWeight: '700',
      color: isDark ? '#E6DDBB' : '#334155',
    },
    footer: {
      marginTop: 8,
      flexDirection: 'row',
      gap: 10,
    },
    actionBtn: {
      flex: 1,
      borderColor: theme.colors.primary,
    },
    exitBtn: {
      backgroundColor: theme.colors.success,
      borderColor: theme.colors.success,
    },
  });
}
