import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../../shared/ui';
import SignImage from '../../../signs/presentation/SignImage';
import OptionTile from './OptionTile';
import useSlots from './useSlots';

const lower = (value) => String(value || '').toLocaleLowerCase('es');

/** Ordenar señas alfabéticamente: se muestran señas, no letras. */
export default function OrderingExercise({ exercise, onAnswerChange, disabled, onHint }) {
  const { pool, slots, place, remove } = useSlots(exercise.letters, exercise.letters.length, onAnswerChange);

  return (
    <View style={styles.block}>
      <AppText variant="subtitle" tone="secondary">
        Toca las señas en orden alfabético. Toca un casillero para devolverla.
      </AppText>
      <View style={styles.row}>
        {slots.map((token, index) => (
          <OptionTile
            key={`slot-${index}`}
            state={token ? 'selected' : 'empty'}
            disabled={disabled || !token}
            onPress={() => remove(index)}
            accessibilityLabel={token ? `Casillero ${index + 1} ocupado, toca para quitar` : `Casillero ${index + 1} vacío`}
            style={styles.tile}
          >
            {token ? (
              <SignImage signKey={lower(token.value)} size={56} rounded={8} />
            ) : (
              <AppText variant="title" tone="muted">
                {index + 1}
              </AppText>
            )}
          </OptionTile>
        ))}
      </View>
      <View style={[styles.row, styles.pool]}>
        {pool.map((token) => (
          <OptionTile
            key={`pool-${token.id}`}
            disabled={disabled}
            onPress={() => place(token)}
            onLongPress={() => onHint?.(lower(token.value))}
            accessibilityLabel="Seña disponible"
            accessibilityHint="Toca para colocarla; mantén presionado para ver una pista"
            style={styles.tile}
          >
            <SignImage signKey={lower(token.value)} size={48} rounded={8} />
          </OptionTile>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  pool: { marginTop: 4 },
  tile: { width: 72, height: 84, paddingHorizontal: 4, paddingVertical: 4 },
});
