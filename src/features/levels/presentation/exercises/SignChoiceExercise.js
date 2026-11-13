import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../../shared/theme/ThemeProvider';
import { AppText } from '../../../../shared/ui';
import { CLIP_PLAYER_MIN_SIZE } from '../../../signs/presentation/SignClip';
import SignImage from '../../../signs/presentation/SignImage';
import OptionTile from './OptionTile';

/**
 * «¿Cuál es la seña de PERRO?»: la palabra se lee y las señas candidatas se
 * ven en una grilla de dos columnas. El botón «Opción N» la elige; el botón ▶ de
 * cada reproductor muestra el video (nada se reproduce solo). Las señas no se
 * nombran: la glosa de cada una es justo la respuesta.
 */
export default function SignChoiceExercise({ exercise, answer, onAnswerChange, disabled }) {
  const theme = useAppTheme();
  return (
    <View style={styles.block}>
      <AppText variant="subtitle" tone="secondary">
        Mira cada seña con calma y elige la que corresponde a la palabra.
      </AppText>
      <AppText variant="display" align="center" accessibilityRole="header">
        {String(exercise.word).toLocaleUpperCase('es')}
      </AppText>
      <View style={styles.grid} accessibilityRole="radiogroup">
        {exercise.signs.map((sign, index) => {
          const chosen = answer === sign;
          return (
            // Dos controles hermanos: el reproductor (su ▶ debe poder alcanzarse con
            // lector de pantalla, por eso no va dentro de un botón) y el de elección.
            <View key={sign} style={styles.card}>
              <SignImage signKey={sign} size={CLIP_PLAYER_MIN_SIZE} rounded={12} accessibilityName={`Seña de la opción ${index + 1}`} />
              <OptionTile
                state={chosen ? 'selected' : 'idle'}
                disabled={disabled}
                onPress={() => onAnswerChange(sign)}
                accessibilityLabel={chosen ? `Elegida: opción ${index + 1}` : `Elegir la seña de la opción ${index + 1}`}
                style={styles.choose}
              >
                <View style={styles.caption}>
                  {chosen ? <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} /> : null}
                  <AppText variant="caption" tone={chosen ? 'brand' : 'secondary'}>
                    {chosen ? `Elegida: opción ${index + 1}` : `Opción ${index + 1}`}
                  </AppText>
                </View>
              </OptionTile>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Dos columnas de ~48 %: con 360 px de pantalla cada tarjeta deja ≥ 120 px
// para el reproductor y no hay scroll horizontal.
const styles = StyleSheet.create({
  block: { gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  caption: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  card: { width: '48.5%', alignItems: 'center', gap: 6 },
  choose: { alignSelf: 'stretch', minHeight: 44, paddingVertical: 6 },
});
