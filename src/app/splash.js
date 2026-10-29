import * as SplashScreen from 'expo-splash-screen';

// El splash nativo cubre el arranque (almacenamiento, fuentes y sesión) para
// que la persona vea UNA sola pantalla de carga en vez de tres distintas.
// Si la sesión tarda más de SPLASH_MAX_MS (red lenta), RootNavigator lo
// oculta igual y muestra el Spinner con texto: un splash eterno parece colgado.
export const SPLASH_MAX_MS = 1500;

let hidden = false;

export function keepSplashVisible() {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

export function hideSplash() {
  if (hidden) return;
  hidden = true;
  SplashScreen.hideAsync().catch(() => {});
}
