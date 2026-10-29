import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
} from '@expo-google-fonts/poppins';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ServicesProvider } from '../core/di/ServicesProvider';
import migrateLegacyStorage from '../core/storage/migrateLegacyStorage';
import { SessionProvider, useSession } from '../features/auth/presentation/SessionProvider';
import { CatalogProvider } from '../features/levels/presentation/CatalogContext';
import { hydratePreferences } from '../features/profile/presentation/usePreferences';
import { RemoteConfigProvider } from '../features/remoteConfig/presentation/RemoteConfigProvider';
import { APP_FONTS } from '../shared/theme/fonts';
import { AppThemeProvider } from '../shared/theme/ThemeProvider';
import { FeedbackProvider } from '../shared/ui';
import RootNavigator from './RootNavigator';
import { keepSplashVisible } from './splash';

keepSplashVisible();

// La config remota depende del usuario (rollouts por usuario, bypass de
// mantenimiento para administradores), por eso va debajo de la sesión.
function SessionAwareProviders({ children }) {
  const { user, isAdmin } = useSession();
  return (
    <RemoteConfigProvider userId={user?.id} isAdmin={isAdmin}>
      <CatalogProvider>{children}</CatalogProvider>
    </RemoteConfigProvider>
  );
}

/**
 * Raíz de la app: compone los providers en orden de dependencia.
 *
 *   SafeArea → Tema → Servicios (DI) → Feedback global →
 *   Sesión → Config remota → Catálogo → Navegación
 *
 * Mientras se prepara el almacenamiento y cargan las fuentes se ve el splash
 * nativo (RootNavigator lo oculta cuando la sesión está lista).
 */
export default function AppRoot() {
  // En paralelo con las fuentes, antes de montar cualquier provider que lea
  // el almacenamiento local: 1) migra las claves antiguas oratiolingo.* →
  // senaplay.* (conserva el progreso de quienes ya usaban la app), 2) carga
  // preferencias.
  const [storageReady, setStorageReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    [APP_FONTS.sign]: require('../../assets/fonts/LenguaDeSenasChilenaHef-Regular.ttf'),
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });

  useEffect(() => {
    migrateLegacyStorage()
      .then(hydratePreferences)
      .finally(() => setStorageReady(true));
  }, []);

  // Si una fuente falla se sigue con la del sistema: quedarse en el splash
  // para siempre sería peor que una tipografía distinta.
  if (!storageReady || !(fontsLoaded || fontError)) return null;

  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <ServicesProvider>
          <FeedbackProvider>
            <SessionProvider>
              <SessionAwareProviders>
                <RootNavigator />
              </SessionAwareProviders>
            </SessionProvider>
          </FeedbackProvider>
        </ServicesProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
