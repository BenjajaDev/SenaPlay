import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import haptics from '../../../../core/feedback/haptics';
import { useAppTheme } from '../../../../shared/theme/ThemeProvider';
import { AppText } from '../../../../shared/ui';
import SignImage from '../../../signs/presentation/SignImage';
import { useSignNameHint } from '../../../signs/presentation/SignNameHint';

/** Borde fijo (también en reposo) para que elegir no mueva el contenido. */
export const CARD_BORDER = 3;

/**
 * Tarjeta de elección de una seña. Sus tres capas son HERMANAS (no anidadas),
 * para que el lector de pantalla alcance el radio y el video por separado:
 *   1. el radio (fondo): un hueco del tamaño del video y, debajo, la franja
 *      «Elegir» / «Elegida» de 44 px; también elige tocar el borde;
 *   2. el video, que toma su propio toque: tocarlo lo reproduce o lo detiene;
 *   3. la insignia con el número (y ✓ si es la elegida), solo visual.
 * El feedback de presión y de deshabilitado se aplica a la tarjeta entera.
 */
export default function SignChoiceCard({ sign, number, chosen, disabled, onChoose, videoSize, width }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [pressed, setPressed] = useState(false);
  const { showSignName } = useSignNameHint();
  const dim = disabled && !chosen ? styles.dimDisabled : pressed ? styles.dimPressed : null;

  return (
    <View style={[styles.card, width ? { width } : styles.cardFallback, dim]}>
      <Pressable
        disabled={disabled}
        onPress={() => {
          haptics.selection();
          onChoose(sign);
        }}
        // Las fotos fijas dejan pasar el toque a la tarjeta; el video lo resuelve SignImage.
        onLongPress={() => showSignName(sign)}
        delayLongPress={400}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="radio"
        accessibilityLabel={`Opción ${number}`}
        accessibilityHint="Toca para elegir esta seña. Mantén presionado para ver su nombre"
        accessibilityState={{ checked: chosen, selected: chosen, disabled: Boolean(disabled) }}
        style={[styles.tile, chosen && styles.tileChosen]}
      >
        <View style={{ width: videoSize, height: videoSize }} />
        {/* Zona clara para elegir: el video se reserva para verlo (tocarlo lo reproduce). */}
        <View style={styles.choose}>
          <Ionicons
            name={chosen ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={chosen ? theme.colors.primary : theme.colors.textSecondary}
          />
          <AppText variant="label" tone={chosen ? 'brand' : 'secondary'} maxFontSizeMultiplier={1.3}>
            {chosen ? 'Elegida' : 'Elegir'}
          </AppText>
        </View>
      </Pressable>

      <View pointerEvents="box-none" style={styles.media}>
        <SignImage
          signKey={sign}
          size={videoSize}
          rounded={theme.radius.md}
          variant="card"
          accessibilityName={`Seña de la opción ${number}`}
        />
      </View>

      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.badge, chosen && styles.badgeChosen]}
      >
        {chosen ? <Ionicons name="checkmark-circle" size={16} color={theme.colors.primaryContrast} /> : null}
        <Text maxFontSizeMultiplier={1.2} style={[styles.badgeText, chosen && styles.badgeTextChosen]}>
          {number}
        </Text>
      </View>
    </View>
  );
}

function createStyles(theme) {
  const { colors, spacing, radius, typography } = theme;
  const inset = CARD_BORDER + spacing.xs;
  return StyleSheet.create({
    card: { position: 'relative' },
    cardFallback: { width: '48.5%' },
    dimPressed: { opacity: 0.9 },
    dimDisabled: { opacity: 0.6 },
    tile: {
      alignItems: 'center',
      padding: spacing.xs,
      borderRadius: radius.lg,
      borderWidth: CARD_BORDER,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
    },
    tileChosen: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    choose: {
      minHeight: theme.minTouch,
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    // Centrado: no se desalinea cuando el ancho de la tarjeta no es exacto.
    media: { position: 'absolute', top: inset, left: 0, right: 0, alignItems: 'center' },
    badge: {
      position: 'absolute',
      top: inset + spacing.xs,
      left: inset + spacing.xs,
      minWidth: 24,
      minHeight: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xxs,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
    },
    badgeChosen: { backgroundColor: colors.primary, borderColor: colors.primary },
    badgeText: { ...typography.label, color: colors.textPrimary },
    badgeTextChosen: { color: colors.primaryContrast },
  });
}
