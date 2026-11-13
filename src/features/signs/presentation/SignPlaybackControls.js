import { StyleSheet, View } from 'react-native';
import useReducedMotion from '../../../core/a11y/useReducedMotion';
import { Chip } from '../../../shared/ui';
import useLoopPreference from './SignPlaybackContext';
import useSlowMotion from './useSlowMotion';

/**
 * «Lento» y «Repetir» en UNA fila. Con `compact` (cajas chicas) quedan solo
 * con ícono, de 44 px, y su nombre accesible sigue siendo el de la palabra:
 * así nunca se apilan. Con «reducir movimiento» no se ofrece «Repetir».
 */
export default function SignPlaybackControls({ compact = false, style }) {
  const reduceMotion = useReducedMotion();
  const [slow, setSlow] = useSlowMotion();
  const [loop, setLoop] = useLoopPreference();

  return (
    <View style={[styles.row, style]}>
      <Chip label="Lento" icon="hourglass-outline" role="switch" iconOnly={compact} selected={slow} onPress={() => setSlow(!slow)} />
      {!reduceMotion ? <Chip label="Repetir" icon="repeat" role="switch" iconOnly={compact} selected={loop} onPress={() => setLoop(!loop)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
});
