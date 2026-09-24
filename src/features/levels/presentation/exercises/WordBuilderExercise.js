import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../../shared/ui';
import OptionTile from './OptionTile';
import SignStrip from './SignStrip';
import useSlots from './useSlots';

const upper = (value) => String(value || '').toLocaleUpperCase('es');

/**
 * Armar una palabra con letras: `build-word` (la palabra es visible) e
 * `interpret-signs` (hay que deducirla de las señas).
 */
export default function WordBuilderExercise({ exercise, onAnswerChange, disabled, onHint }) {
  const { pool, slots, place, remove } = useSlots(exercise.letters, exercise.word.length, onAnswerChange);
  const interpret = exercise.type === 'interpret-signs';

  return (
    <View style={styles.block}>
      {interpret ? (
        <>
          <AppText variant="subtitle" tone="secondary">
            Interpreta las señas y forma la palabra.
          </AppText>
          <SignStrip signs={exercise.signs} onHint={onHint} />
        </>
      ) : (
        <AppText variant="subtitle" tone="secondary">
          Palabra objetivo: <AppText variant="bodyStrong" tone="brand">{upper(exercise.word)}</AppText>
        </AppText>
      )}

      <View style={styles.row} accessibilityLabel={`Palabra de ${exercise.word.length} letras`}>
        {slots.map((token, index) => (
          <OptionTile
            key={`slot-${index}`}
            label={token ? upper(token.value) : ' '}
            state={token ? 'selected' : 'empty'}
            disabled={disabled || !token}
            onPress={() => remove(index)}
            accessibilityLabel={token ? `Letra ${upper(token.value)}, toca para quitar` : `Espacio ${index + 1} vacío`}
            style={styles.slot}
          />
        ))}
      </View>

      <View style={styles.row}>
        {pool.map((token) => (
          <OptionTile
            key={`pool-${token.id}`}
            shape="pill"
            label={upper(token.value)}
            disabled={disabled}
            onPress={() => place(token)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { minWidth: 46, paddingHorizontal: 8 },
});
