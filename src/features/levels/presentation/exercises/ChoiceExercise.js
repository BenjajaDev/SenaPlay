import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../../shared/ui';
import OptionTile from './OptionTile';
import SignStrip, { SignSpotlight } from './SignStrip';

const upper = (value) => String(value || '').toLocaleUpperCase('es');

/**
 * Elegir una opción: `multiple-choice` (una seña → su letra) y
 * `word-meaning` (varias señas → su significado).
 */
export default function ChoiceExercise({ exercise, answer, onAnswerChange, disabled, onHint }) {
  const isMeaning = exercise.type === 'word-meaning';

  return (
    <View style={styles.block}>
      {isMeaning ? (
        <>
          <AppText variant="subtitle" tone="secondary">
            Lee las señas y elige el significado correcto.
          </AppText>
          <SignStrip signs={exercise.signs} onHint={onHint} />
        </>
      ) : (
        <SignSpotlight
          sign={exercise.sign}
          onHint={onHint}
          caption={
            <AppText variant="caption" tone="secondary" align="center">
              ¿Qué letra es? · Mantén presionado para ver una pista
            </AppText>
          }
        />
      )}

      <View style={isMeaning ? styles.column : styles.row} accessibilityRole="radiogroup">
        {exercise.options.map((option) => (
          <OptionTile
            key={option}
            label={isMeaning ? option : upper(option)}
            state={answer === option ? 'selected' : 'idle'}
            disabled={disabled}
            onPress={() => onAnswerChange(option)}
            style={isMeaning ? null : styles.letterOption}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  column: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  letterOption: { flexGrow: 1, flexBasis: '28%' },
});
