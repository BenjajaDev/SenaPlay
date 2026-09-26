import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

// Capa fina sobre expo-haptics con un vocabulario de intención (acierto,
// error, selección…) en vez de patrones sueltos por pantalla.
//
// La vibración SIEMPRE acompaña a un feedback visual (borde luminoso, icono,
// texto); nunca es el único canal. Es especialmente útil para personas Sordas,
// para quienes el sonido no es opción: sienten el acierto/error sin tener que
// mirar un detalle chico de la pantalla.
//
// Se puede desactivar desde Perfil (setUserHapticsPreference) o remotamente
// con el flag `feedback.haptics` (setHapticsEnabled).

// Dos interruptores independientes: el remoto (flag del panel) y la
// preferencia del usuario (Perfil). Vibra solo si ambos lo permiten.
let remoteEnabled = true;
let userEnabled = true;

export function setHapticsEnabled(value) {
  remoteEnabled = Boolean(value);
}

export function setUserHapticsPreference(value) {
  userEnabled = Boolean(value);
}

export function isHapticsEnabled() {
  return remoteEnabled && userEnabled;
}

// En Android, expo-haptics usa la «respuesta táctil» del sistema, que muchos
// teléfonos traen desactivada o muy suave: la app parecía no vibrar nunca.
// Ahí se usan patrones del vibrador (ms: [espera, vibra, espera, vibra…]),
// que respetan el modo silencio pero no dependen de ese ajuste. En iOS se
// mantiene el Taptic Engine vía expo-haptics.
export const ANDROID_PATTERNS = Object.freeze({
  success: [0, 45],
  error: [0, 70, 60, 70],
  warning: [0, 110],
  selection: [0, 15],
  tap: [0, 20],
  impact: [0, 35],
  celebrate: [0, 50, 90, 50, 90, 140],
});

function run(intent, effect) {
  if (!isHapticsEnabled() || Platform.OS === 'web') return;
  // Puede fallar en dispositivos sin motor de vibración (o en un dev client
  // sin el módulo nativo): se ignora, el feedback visual ya está.
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate(ANDROID_PATTERNS[intent]);
      return;
    }
    effect()?.catch?.(() => {});
  } catch {
    /* sin háptica disponible */
  }
}

export const haptics = {
  success: () => run('success', () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => run('error', () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  warning: () => run('warning', () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  selection: () => run('selection', () => Haptics.selectionAsync()),
  tap: () => run('tap', () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  impact: () => run('impact', () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  celebrate: () =>
    run('celebrate', async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await new Promise((resolve) => setTimeout(resolve, 140));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }),
};

export default haptics;
