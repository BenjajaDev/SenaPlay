import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Capa fina sobre expo-haptics con un vocabulario de intención (acierto,
// error, selección…) en vez de patrones sueltos por pantalla.
//
// La vibración SIEMPRE acompaña a un feedback visual (borde luminoso, icono,
// texto); nunca es el único canal. Es especialmente útil para personas Sordas,
// para quienes el sonido no es opción: sienten el acierto/error sin tener que
// mirar un detalle chico de la pantalla.
//
// Se puede desactivar desde Perfil (preferencia del usuario) o remotamente
// (flag `haptics_enabled`); ambos llaman a setHapticsEnabled.

let enabled = true;

export function setHapticsEnabled(value) {
  enabled = Boolean(value);
}

export function isHapticsEnabled() {
  return enabled;
}

function run(effect) {
  if (!enabled || Platform.OS === 'web') return;
  // expo-haptics puede fallar en dispositivos sin motor de vibración (o en un
  // dev client sin el módulo nativo): se ignora, el feedback visual ya está.
  try {
    effect()?.catch?.(() => {});
  } catch {
    /* sin háptica disponible */
  }
}

export const haptics = {
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  selection: () => run(() => Haptics.selectionAsync()),
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  impact: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  celebrate: () =>
    run(async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await new Promise((resolve) => setTimeout(resolve, 140));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }),
};

export default haptics;
