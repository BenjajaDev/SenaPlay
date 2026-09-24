import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../../shared/theme/ThemeProvider';
import SignImage from '../../../signs/presentation/SignImage';

/**
 * Fila de señas a interpretar. Mantener presionada una seña abre su pista
 * (misma interacción en todos los ejercicios).
 */
export default function SignStrip({ signs, size = 72, onHint }) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.strip,
        {
          backgroundColor: theme.colors.surfaceSunken,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      {signs.map((sign, index) => (
        <Pressable
          key={`${sign}-${index}`}
          onLongPress={() => onHint?.(sign)}
          delayLongPress={400}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Seña ${index + 1} de ${signs.length}`}
          accessibilityHint="Mantén presionado para ver una pista"
        >
          <SignImage signKey={sign} size={size} rounded={theme.radius.md} />
        </Pressable>
      ))}
    </View>
  );
}

export function SignSpotlight({ sign, caption, size = 150, onHint }) {
  const theme = useAppTheme();
  return (
    <Pressable
      onLongPress={() => onHint?.(sign)}
      delayLongPress={400}
      accessibilityRole="imagebutton"
      accessibilityHint="Mantén presionado para ver una pista"
      style={[
        styles.spotlight,
        { backgroundColor: theme.colors.surfaceSunken, borderColor: theme.colors.border, borderRadius: theme.radius.xl },
      ]}
    >
      <SignImage signKey={sign} size={size} rounded={theme.radius.xl} />
      {caption}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  spotlight: { alignItems: 'center', gap: 8, paddingVertical: 16, borderWidth: 1 },
});
