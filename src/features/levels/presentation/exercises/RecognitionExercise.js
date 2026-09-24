import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../../shared/ui';
import OptionTile from './OptionTile';
import SignStrip from './SignStrip';

const upper = (value) => String(value || '').toLocaleUpperCase('es');

/** Seleccionar varias letras que corresponden a una secuencia de señas. */
export default function RecognitionExercise({ exercise, answer, onAnswerChange, disabled, onHint }) {
  const selected = answer || [];
  const toggle = (letter) => {
    onAnswerChange(selected.includes(letter) ? selected.filter((item) => item !== letter) : [...selected, letter]);
  };

  return (
    <View style={styles.block}>
      <AppText variant="subtitle" tone="secondary">
        Selecciona las letras que representan estas señas.
      </AppText>
      <SignStrip signs={exercise.signs} onHint={onHint} />
      <View style={styles.row}>
        {exercise.options.map((letter) => (
          <OptionTile
            key={letter}
            shape="pill"
            label={upper(letter)}
            state={selected.includes(letter) ? 'selected' : 'idle'}
            disabled={disabled}
            onPress={() => toggle(letter)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
