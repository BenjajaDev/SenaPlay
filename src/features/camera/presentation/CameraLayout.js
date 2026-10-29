import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MIN_TOUCH, radius, spacing } from '../../../shared/theme/tokens/scales';
import { cameraAlpha, cameraColors } from '../../../shared/theme/tokens/colors';
import { poppins } from '../../../shared/theme/fonts';
import { CameraStage } from './signCamera';

/**
 * Estructura común de las pantallas con cámara, en tres franjas que NO se
 * superponen:
 *
 *   cabecera   botón de salir (con borde) + título, bajo la barra de estado
 *   visor      el video con la mano, recortado en una tarjeta con borde; lo
 *              que la pantalla ponga en `overlay` (guía, letra en curso) y los
 *              textos del propio visor quedan dentro de esta tarjeta
 *   controles  resultado de la IA, avisos y botones, sobre la barra de gestos
 *
 * Antes el video ocupaba toda la pantalla por detrás de la cabecera y de los
 * controles, y tapaban el panel de práctica y el estado del visor.
 */
export default function CameraLayout({ title, onBack, recog, overlay, rightNode, children }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <CameraIconButton icon="arrow-back" label="Salir" onPress={onBack} />
        <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
          {title}
        </Text>
        <View style={styles.side}>{rightNode}</View>
      </View>

      <View style={styles.stage}>
        <CameraStage recog={recog} />
        {overlay}
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.md }]}>
        {recog.errorCamara ? (
          <View style={styles.errorBox} accessibilityLiveRegion="polite">
            <Ionicons name="warning" size={16} color={cameraColors.dangerLight} />
            <Text style={styles.errorText}>{recog.errorCamara}</Text>
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const VARIANTS = {
  primary: { box: { backgroundColor: cameraColors.primary, borderColor: cameraColors.accent }, text: cameraColors.text },
  secondary: { box: { backgroundColor: cameraColors.surface, borderColor: cameraAlpha('accent', 0.55) }, text: cameraColors.textStrong },
  danger: { box: { backgroundColor: cameraColors.dangerFill, borderColor: cameraColors.dangerLight }, text: cameraColors.text },
  warning: { box: { backgroundColor: cameraAlpha('warning', 0.16), borderColor: cameraColors.warning }, text: cameraColors.warning },
};

/**
 * Botón del escenario de cámara: relleno de la paleta de marca, borde
 * visible sobre el video, icono + texto y alto ≥ 48 px.
 */
export function CameraButton({ label, icon, onPress, variant = 'secondary', disabled = false, busy = false, accessibilityLabel, style }) {
  const palette = VARIANTS[variant] || VARIANTS.secondary;
  const inactive = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: inactive, busy }}
      style={({ pressed }) => [styles.button, palette.box, pressed && styles.pressed, inactive && styles.inactive, style]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={palette.text} />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={palette.text} />
      ) : null}
      {label ? (
        <Text style={[styles.buttonText, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Botón solo con icono (salir, anterior/siguiente): 44 px, con borde. */
export function CameraIconButton({ icon, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={22} color={cameraColors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: cameraColors.stage },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { flex: 1, textAlign: 'center', color: cameraColors.textStrong, fontFamily: poppins(800), fontSize: 18, lineHeight: 24 },
  side: { minWidth: MIN_TOUCH, alignItems: 'flex-end' },
  stage: {
    flex: 1,
    marginHorizontal: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: cameraAlpha('accent', 0.45),
    overflow: 'hidden',
    backgroundColor: cameraColors.stage,
  },
  controls: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm + 2 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: cameraAlpha('danger', 0.6),
    backgroundColor: cameraAlpha('danger', 0.14),
  },
  errorText: { flexShrink: 1, color: cameraColors.dangerLight, fontSize: 13, fontFamily: poppins(600), textAlign: 'center' },
  button: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm - 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  buttonText: { flexShrink: 1, fontFamily: poppins(700), fontSize: 14 },
  iconButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cameraColors.surface,
    borderWidth: 1.5,
    borderColor: cameraColors.accent,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  inactive: { opacity: 0.55 },
});
