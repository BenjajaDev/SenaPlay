import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
} from '@expo-google-fonts/poppins';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from './src/core/supabase/client';
import LoginScreen from './src/features/auth/presentation/LoginScreen';
import RegisterScreen from './src/features/auth/presentation/RegisterScreen';
import VerifyCodeScreen from './src/features/auth/presentation/VerifyCodeScreen';
import ResetPasswordScreen from './src/features/auth/presentation/ResetPasswordScreen';
import MainAppScreen from './src/app/MainAppScreen';
import { APP_FONTS } from './src/shared/theme/fonts';
import { AppThemeProvider, useAppTheme } from './src/shared/theme/ThemeProvider';
import { CatalogProvider } from './src/features/levels/presentation/CatalogContext';

function AppContent() {
  const [screen, setScreen] = useState('login');
  const [pendingEmail, setPendingEmail] = useState('');
  const [verifyPurpose, setVerifyPurpose] = useState('signup');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  // Durante la recuperacion de contrasena verifyOtp crea una sesion; esta bandera
  // evita que el listener nos lleve a 'main' antes de definir la nueva clave.
  const recoveringRef = useRef(false);
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [fontsLoaded] = useFonts({
    [APP_FONTS.sign]: require('./assets/fonts/LenguaDeSenasChilenaHef-Regular.ttf'),
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });

  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) {
        return;
      }

      setScreen(data?.session ? 'main' : 'login');
      setIsBootstrapping(false);
    };

    hydrateSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (recoveringRef.current) return;
      setScreen(session ? 'main' : 'login');
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  if (isBootstrapping || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <LinearGradient colors={theme.gradient} style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.colors.primaryContrast} />
        </LinearGradient>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      {screen === 'login' && (
        <LoginScreen
          onGoToRegister={() => setScreen('register')}
          onLoginSuccess={() => setScreen('main')}
          onNeedPasswordReset={(email) => {
            recoveringRef.current = true;
            setPendingEmail(email);
            setVerifyPurpose('recovery');
            setScreen('verify');
          }}
        />
      )}

      {screen === 'register' && (
        <RegisterScreen
          onGoToLogin={() => setScreen('login')}
          onNeedVerification={(email) => {
            setVerifyPurpose('signup');
            setPendingEmail(email);
            setScreen('verify');
          }}
        />
      )}

      {screen === 'verify' && (
        <VerifyCodeScreen
          email={pendingEmail}
          purpose={verifyPurpose}
          onBack={() => {
            recoveringRef.current = false;
            setScreen('login');
          }}
          onVerified={() => setScreen(verifyPurpose === 'recovery' ? 'resetPassword' : 'main')}
        />
      )}

      {screen === 'resetPassword' && (
        <ResetPasswordScreen
          onDone={() => {
            recoveringRef.current = false;
            setScreen('login');
          }}
        />
      )}

      {screen === 'main' && (
        <MainAppScreen onLogout={() => setScreen('login')} />
      )}
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <AppThemeProvider>
      <CatalogProvider>
        <AppContent />
      </CatalogProvider>
    </AppThemeProvider>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    loaderContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}