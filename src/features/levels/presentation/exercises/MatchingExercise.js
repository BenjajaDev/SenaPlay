import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../../shared/ui';
import SignImage from '../../../signs/presentation/SignImage';
import { isWordMatching } from '../../domain/exerciseTypes';
import { CLIP_PLAYER_MIN_SIZE } from '../../../signs/presentation/SignClip';
import OptionTile from './OptionTile';
import usePairSelection from './usePairSelection';
import { shuffle } from './useSlots';
import { letterLabel } from '../../domain/exerciseRotation';

// letterLabel: 'n~' se muestra «Ñ» (las claves de seña usan n~).
const upper = (value) => letterLabel(value || '');

function buildCards(letters) {
  const cards = [];
  letters.forEach((sign, index) => {
    cards.push({ id: `l-${index}`, type: 'letter', pair: sign });
    cards.push({ id: `s-${index}`, type: 'sign', pair: sign });
  });
  return shuffle(cards);
}

/**
 * Emparejar señas. Elige el modo según el ejercicio (`isWordMatching`): letras
 * (cartas en grilla) o palabras (señas en video a la izquierda, texto a la derecha).
 */
export default function MatchingExercise(props) {
  return isWordMatching(props.exercise) ? <WordMatching {...props} /> : <LetterMatching {...props} />;
}

/** Señas con letras: se evalúa pareja por pareja (ver usePairSelection). */
function LetterMatching({ exercise, answer, onAnswerChange, onPairResult, disabled, onHint }) {
  const [cards] = useState(() => buildCards(exercise.letters));
  const matched = answer || [];
  const dense = exercise.letters.length > 5;
  const { handlePress, stateOf } = usePairSelection({ matched, total: cards.length, disabled, onAnswerChange, onPairResult });

  return (
    <View style={styles.block}>
      <AppText variant="subtitle" tone="secondary">
        Toca una seña y luego su letra. Mantén presionada una seña para ver su pista.
      </AppText>
      <View style={styles.grid}>
        {cards.map((card) => {
          const isSign = card.type === 'sign';
          const isMatched = matched.includes(card.id);
          const state = stateOf(card);
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

/**
 * Señas con palabras: cada seña es un reproductor (≥ 120 px). Las señas no se
 * nombran (ni en pantalla ni para el lector): la palabra correcta está al lado.
 */
function WordMatching({ exercise, answer, onAnswerChange, onPairResult, disabled }) {
  const [layout] = useState(() => ({
    signs: shuffle(exercise.letters.map((pair, index) => ({ id: `s-${index}`, type: 'sign', pair, index }))),
    words: shuffle(
      exercise.letters.map((pair, index) => ({
        id: `l-${index}`,
        type: 'letter',
        pair,
        text: exercise.labels?.[index] ?? upper(pair),
      })),
    ),
  }));
  const matched = answer || [];
  const { handlePress, stateOf } = usePairSelection({ matched, total: exercise.letters.length * 2, disabled, onAnswerChange, onPairResult });

  return (
    <View style={styles.block}>
      <AppText variant="subtitle" tone="secondary">
        Toca una seña y luego su palabra.
      </AppText>
      {layout.signs.map((sign, row) => {
        const word = layout.words[row];
        return (
          <View key={sign.id} style={styles.pairRow}>
            {/* Reproductor y botón de elección son hermanos: el ▶ no va dentro de un botón. */}
            <View style={styles.signCell}>
              <SignImage
                signKey={sign.pair}
                size={CLIP_PLAYER_MIN_SIZE}
                rounded={12}
                accessibilityName={`Seña ${row + 1}`}
              />
              <OptionTile
                label={`Seña ${row + 1}`}
                state={stateOf(sign)}
                disabled={disabled || matched.includes(sign.id)}
                onPress={() => handlePress(sign)}
                accessibilityLabel={matched.includes(sign.id) ? `Seña ${row + 1}, emparejada` : `Elegir la seña ${row + 1}`}
                style={styles.chooseSign}
              />
            </View>
            <OptionTile
              label={word.text}
              state={stateOf(word)}
              disabled={disabled || matched.includes(word.id)}
              onPress={() => handlePress(word)}
              accessibilityLabel={`Palabra ${word.text}`}
              style={styles.pairTile}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pairRow: { flexDirection: 'row', gap: 8 },
  pairTile: { flex: 1, paddingHorizontal: 4 },
  signCell: { flex: 1, alignItems: 'center', gap: 6 },
  chooseSign: { alignSelf: 'stretch', minHeight: 44, paddingVertical: 6 },
  block: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  card: { width: '31%', minHeight: 108, paddingHorizontal: 4 },
  cardDense: { width: '23%', minHeight: 88 },
  letterDense: { fontSize: 20, lineHeight: 26 },
  type: { fontSize: 10, marginTop: 2 },
  typeDense: { fontSize: 8, lineHeight: 10 },
});
