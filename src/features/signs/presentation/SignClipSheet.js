import { StyleSheet, View } from 'react-native';
import { BottomSheet } from '../../../shared/ui';
import SignClip from './SignClip';

const SHEET_CLIP_SIZE = 240;

/**
 * Hoja inferior con el reproductor de una seña. La usan las filas de señas
 * chicas (frases de varias señas): ahí la casilla solo muestra la imagen
 * fija y tocarla abre el clip a buen tamaño.
 */
export default function SignClipSheet({ clip, onClose }) {
  return (
    <BottomSheet visible={Boolean(clip)} title={clip ? `Seña ${clip.gloss}` : ''} onClose={onClose}>
      {clip ? (
        <View style={styles.body}>
          <SignClip clip={clip} label={clip.gloss} size={SHEET_CLIP_SIZE} interactive />
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', paddingBottom: 8 },
});
