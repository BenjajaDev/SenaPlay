import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { supabase } from './backend/supabase';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import MainAppScreen from './src/screens/MainAppScreen';
import { APP_FONTS } from './src/constants/fonts';

export default function App() {
  const [screen, setScreen] = useState('login');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [fontsLoaded] = useFonts({
    [APP_FONTS.sign]: require('./assets/fonts/LenguaDeSenasChilenaHef-Regular.ttf'),
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
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#7E57C2" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      {screen === 'login' && (
        <LoginScreen
          onGoToRegister={() => setScreen('register')}
          onLoginSuccess={() => setScreen('main')}
        />
      )}

      {screen === 'register' && (
        <RegisterScreen onGoToLogin={() => setScreen('login')} />
      )}

      {screen === 'main' && (
        <MainAppScreen onLogout={() => setScreen('login')} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    backgroundColor: '#EDE7F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});