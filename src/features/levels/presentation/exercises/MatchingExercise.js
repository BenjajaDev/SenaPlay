import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../../shared/ui';
import SignImage from '../../../signs/presentation/SignImage';
import { evaluateMatchingPair } from '../../domain/evaluateAnswer';
import OptionTile from './OptionTile';
import { shuffle } from './useSlots';

const upper = (value) => String(value || '').toLocaleUpperCase('es');

function buildCards(letters) {
  const cards = [];
  letters.forEach((sign, index) => {
    cards.push({ id: `l-${index}`, type: 'letter', pair: sign });
    cards.push({ id: `s-${index}`, type: 'sign', pair: sign });
  });
  return shuffle(cards);
}

/**
 * Emparejar señas con letras. Se evalúa pareja por pareja: una pareja
 * incorrecta se informa con `onPairResult` (la sesión descuenta la vida y
 * muestra feedback); al completar todas se envía la respuesta automáticamente.
 */
export default function MatchingExercise({ exercise, answer, onAnswerChange, onPairResult, disabled, onHint }) {
  const [cards] = useState(() => buildCards(exercise.letters));
  const [selected, setSelected] = useState(null);
  const matched = answer || [];
  const dense = exercise.letters.length > 5;

  const handlePress = (card) => {
    if (disabled || matched.includes(card.id)) return;
    if (!selected || selected.type === card.type) {
      setSelected(card);
      return;
    }
    const result = evaluateMatchingPair(selected, card);
    setSelected(null);
    if (!result) return;
    if (result.status === 'correct') {
      const next = [...matched, selected.id, card.id];
      onAnswerChange(next, { autoSubmit: next.length === cards.length });
    } else {
      onPairResult?.(result);
    }
  };

  return (
    <View style={styles.block}>
      <AppText variant="subtitle" tone="secondary">
        Toca una seña y luego su letra. Mantén presionada una seña para ver su pista.
      </AppText>
      <View style={styles.grid}>
        {cards.map((card) => {
          const isSign = card.type === 'sign';
          const isMatched = matched.includes(card.id);
          const state = isMatched ? 'matched' : selected?.id === card.id ? 'selected' : 'idle';
          return (
            <OptionTile
              key={card.id}
              state={state}
              disabled={disabled || isMatched}
              onPress={() => handlePress(card)}
              onLongPress={isSign ? () => onHint?.(card.pair) : undefined}
              accessibilityLabel={isSign ? 'Carta de seña' : `Carta de letra ${upper(card.pair)}`}
              style={[styles.card, dense && styles.cardDense]}
            >
              {isSign ? (
                <SignImage signKey={card.pair} label={upper(card.pair)} size={dense ? 52 : 66} rounded={10} />
              ) : (
                <AppText variant="display" tone={isMatched ? 'success' : 'primary'} style={dense && styles.letterDense}>
                  {upper(card.pair)}
                </AppText>
              )}
              <AppText variant="caption" tone="muted" style={dense ? styles.typeDense : styles.type}>
                {isSign ? 'SEÑA' : 'LETRA'}
              </AppText>
            </OptionTile>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  card: { width: '31%', minHeight: 108, paddingHorizontal: 4 },
  cardDense: { width: '23%', minHeight: 88 },
  letterDense: { fontSize: 20, lineHeight: 26 },
  type: { fontSize: 10, marginTop: 2 },
  typeDense: { fontSize: 8, lineHeight: 10 },
});
