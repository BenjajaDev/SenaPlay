import { StyleSheet, View } from 'react-native';
import { AppText, TextField } from '../../../../shared/ui';
import { useAppTheme } from '../../../../shared/theme/ThemeProvider';
import { SignSpotlight } from './SignStrip';

/** Escribir la letra que corresponde a la seña mostrada. */
export default function TypingExercise({ exercise, answer, onAnswerChange, disabled }) {
  const theme = useAppTheme();
  return (
    <View style={styles.block}>
      <SignSpotlight
        sign={exercise.sign}
        caption={
          <AppText variant="caption" tone="secondary" align="center">
            Escribe la letra · Mantén presionado para ver su nombre
          </AppText>
        }
      />
      <TextField
        value={answer || ''}
        onChangeText={onAnswerChange}
        placeholder="Ej: A"
        accessibilityLabel="Escribe la letra de la seña"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={3}
        disabled={disabled}
        inputStyle={[theme.typography.display, styles.input]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  input: { textAlign: 'center', fontSize: 24 },
});
