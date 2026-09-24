import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
} from '@expo-google-fonts/poppins';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ServicesProvider } from '../core/di/ServicesProvider';
import { SessionProvider, useSession } from '../features/auth/presentation/SessionProvider';
import { CatalogProvider } from '../features/levels/presentation/CatalogContext';
import { RemoteConfigProvider } from '../features/remoteConfig/presentation/RemoteConfigProvider';
import { APP_FONTS } from '../shared/theme/fonts';
import { AppThemeProvider, useAppTheme } from '../shared/theme/ThemeProvider';
import { FeedbackProvider } from '../shared/ui';
import RootNavigator from './RootNavigator';

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

function FontGate({ children }) {
  const theme = useAppTheme();
  const [fontsLoaded] = useFonts({
    [APP_FONTS.sign]: require('../../assets/fonts/LenguaDeSenasChilenaHef-Regular.ttf'),
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });

  if (!fontsLoaded) {
    // Sin fuentes aún no se puede usar el Spinner temático (usa texto con Poppins).
    return (
      <LinearGradient {...theme.gradients.header} style={styles.loader}>
        <ActivityIndicator size="large" color="#FFFFFF" accessibilityLabel="Cargando" />
      </LinearGradient>
    );
  }
  return children;
}

/**
 * Raíz de la app: compone los providers en orden de dependencia.
 *
 *   SafeArea → Tema → Fuentes → Servicios (DI) → Feedback global →
 *   Sesión → Config remota → Catálogo → Navegación
 */
export default function AppRoot() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <FontGate>
          <ServicesProvider>
            <FeedbackProvider>
              <SessionProvider>
                <SessionAwareProviders>
                  <RootNavigator />
                </SessionAwareProviders>
              </SessionProvider>
            </FeedbackProvider>
          </ServicesProvider>
        </FontGate>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
