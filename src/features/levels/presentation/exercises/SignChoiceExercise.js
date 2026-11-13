import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../../shared/theme/ThemeProvider';
import { AppText } from '../../../../shared/ui';
import { CLIP_PLAYER_MIN_SIZE } from '../../../signs/presentation/SignClip';
import { useSignClips } from '../../../signs/presentation/SignClipsProvider';
import SignPlaybackControls from '../../../signs/presentation/SignPlaybackControls';
import { SignPlaybackProvider } from '../../../signs/presentation/SignPlaybackContext';
import SignChoiceCard, { CARD_BORDER } from './SignChoiceCard';

/**
 * «¿Cuál es la seña de PERRO?»: la palabra se lee y las señas candidatas se
 * ven en una grilla de dos columnas.
 *
 * Cada TARJETA es la opción (radio): un toque en cualquier parte la elige,
 * incluido el video (en reposo o corriendo). El número va como insignia; la
 * elegida suma borde de marca de 3 px y ✓. El único control de reproducción es
 * el botón ▶/■ de la esquina del video, hermano de la tarjeta; reproducir uno
 * detiene los demás. «Lento» y «Repetir» son una sola barra sobre la grilla.
 * Nada se reproduce solo. Las señas no se nombran: la glosa es la respuesta.
 */
export default function SignChoiceExercise({ exercise, answer, onAnswerChange, disabled }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { clipFor } = useSignClips();
  const [gridWidth, setGridWidth] = useState(0);

  // Dos columnas: con 320 px de pantalla el video sigue ≥ 120 y no hay scroll horizontal.
  const cardWidth = gridWidth ? (gridWidth - theme.spacing.sm) / 2 : 0;
  const inset = (CARD_BORDER + theme.spacing.xs) * 2;
  const videoSize = Math.max(CLIP_PLAYER_MIN_SIZE, Math.floor(cardWidth - inset));
  const hasClips = exercise.signs.some((sign) => Boolean(clipFor(sign)));

  return (
    <SignPlaybackProvider>
      <View style={styles.block}>
        <AppText variant="subtitle" tone="secondary">
          Mira cada seña con calma y elige la que corresponde a la palabra.
        </AppText>
        <AppText variant="display" align="center" accessibilityRole="header">
          {String(exercise.word).toLocaleUpperCase('es')}
        </AppText>
        {hasClips ? <SignPlaybackControls /> : null}
        <View
          style={styles.grid}
          accessibilityRole="radiogroup"
          accessibilityLabel={`Señas posibles para ${exercise.word}`}
          onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
        >
          {exercise.signs.map((sign, index) => (
            <SignChoiceCard
              key={sign}
              sign={sign}
              number={index + 1}
              chosen={answer === sign}
              disabled={disabled}
              onChoose={onAnswerChange}
              videoSize={videoSize}
              width={cardWidth || undefined}
            />
          ))}
        </View>
      </View>
    </SignPlaybackProvider>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    block: { gap: theme.spacing.md },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, justifyContent: 'space-between' },
  });
}
