import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { AppText, Card } from '../../../../shared/ui';
import { useAppTheme } from '../../../../shared/theme/ThemeProvider';
import OptionTile from './OptionTile';

/** Verdadero o falso sobre una afirmación. */
export default function TrueFalseExercise({ exercise, answer, onAnswerChange, disabled }) {
  const theme = useAppTheme();
  const options = [
    { value: 'true', label: 'Verdadero', icon: 'checkmark-circle', color: theme.colors.successText },
    { value: 'false', label: 'Falso', icon: 'close-circle', color: theme.colors.dangerText },
  ];

  return (
    <View style={styles.block}>
      <Card variant="gradient" padding="lg">
        <AppText variant="bodyStrong" align="center" style={styles.statement}>
          “{exercise.statement}”
        </AppText>
      </Card>
      <View style={styles.row} accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = answer === option.value;
          return (
            <OptionTile
              key={option.value}
              label={option.label}
              state={selected ? 'selected' : 'idle'}
              disabled={disabled}
              onPress={() => onAnswerChange(option.value)}
              style={styles.option}
            >
              <View style={styles.optionInner}>
                <Ionicons name={option.icon} size={26} color={option.color} />
                <AppText variant="button" tone={selected ? 'brand' : 'primary'}>
                  {option.label}
                </AppText>
              </View>
            </OptionTile>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  statement: { fontStyle: 'italic' },
  row: { flexDirection: 'row', gap: 10 },
  option: { flex: 1, paddingVertical: 14 },
  optionInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
