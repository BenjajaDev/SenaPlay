import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../../shared/theme/ThemeProvider';
import { useSignClips } from '../../../signs/presentation/SignClipsProvider';
import SignClipSheet from '../../../signs/presentation/SignClipSheet';
import SignImage from '../../../signs/presentation/SignImage';
import { CLIP_PLAYER_MIN_SIZE } from '../../../signs/presentation/SignClip';

// Con clips, una o dos señas se muestran grandes para que el reproductor
// quepa en la casilla. Sin clips se mantiene el tamaño de siempre.
const CLIP_SIZES = { 1: 150, 2: CLIP_PLAYER_MIN_SIZE };
const DEFAULT_SIZE = 72;

const neutralStripName = (index, total) => (total === 1 ? 'Seña a interpretar' : `Seña ${index + 1} de ${total}`);

/**
 * Fila de señas a interpretar. Mantener presionada una seña abre su pista
 * (misma interacción en todos los ejercicios). Si una seña tiene clip y su
 * casilla es chica (frases de tres o más señas), tocarla abre el clip en
 * una hoja inferior: la fila nunca reproduce varios videos a la vez.
 *
 * Con `concealGloss` (la glosa es la respuesta: «¿Qué significa esta seña?») ni
 * el nombre accesible, ni la hoja, ni la pista al mantener presionado nombran
 * la seña: la pista pasa a ser la general del ejercicio.
 */
export default function SignStrip({ signs, size, onHint, concealGloss = false }) {
  const theme = useAppTheme();
  const { clipFor } = useSignClips();
  const [openClip, setOpenClip] = useState(null);
  const clips = signs.map(clipFor);
  const resolvedSize = size ?? (clips.some(Boolean) ? CLIP_SIZES[signs.length] ?? DEFAULT_SIZE : DEFAULT_SIZE);
  const opensSheet = resolvedSize < CLIP_PLAYER_MIN_SIZE;

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
      {signs.map((sign, index) => {
        const clip = opensSheet ? clips[index] : null;
        return (
          <Pressable
            key={`${sign}-${index}`}
            onPress={clip ? () => setOpenClip(clip) : undefined}
            onLongPress={() => onHint?.(concealGloss ? undefined : sign)}
            delayLongPress={400}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Seña ${index + 1} de ${signs.length}`}
            accessibilityHint={
              clip ? 'Toca para verla en movimiento. Mantén presionado para ver una pista' : 'Mantén presionado para ver una pista'
            }
          >
            <SignImage
              signKey={sign}
              size={resolvedSize}
              rounded={theme.radius.md}
              accessibilityName={concealGloss ? neutralStripName(index, signs.length) : undefined}
              onLongPress={() => onHint?.(concealGloss ? undefined : sign)}
            />
          </Pressable>
        );
      })}
      <SignClipSheet clip={openClip} onClose={() => setOpenClip(null)} concealGloss={concealGloss} />
    </View>
  );
}

export function SignSpotlight({ sign, caption, size = 150, onHint, concealGloss = false }) {
  const theme = useAppTheme();
  return (
    <Pressable
      onLongPress={() => onHint?.(concealGloss ? undefined : sign)}
      delayLongPress={400}
      accessibilityRole="imagebutton"
      accessibilityHint="Mantén presionado para ver una pista"
      style={[
        styles.spotlight,
        { backgroundColor: theme.colors.surfaceSunken, borderColor: theme.colors.border, borderRadius: theme.radius.xl },
      ]}
    >
      <SignImage
        signKey={sign}
        size={size}
        rounded={theme.radius.xl}
        accessibilityName={concealGloss ? 'Seña a interpretar' : undefined}
        onLongPress={() => onHint?.(concealGloss ? undefined : sign)}
      />
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
