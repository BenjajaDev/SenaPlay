import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useState } from 'react';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  const [screen, setScreen] = useState('login');

  return (
    <SafeAreaProvider>
      {screen === 'login' && (
        <LoginScreen
          onGoToRegister={() => setScreen('register')}
          onLoginSuccess={() => setScreen('home')}
        />
      )}

      {screen === 'register' && (
        <RegisterScreen onGoToLogin={() => setScreen('login')} />
      )}

      {screen === 'home' && (
        <HomeScreen onLogout={() => setScreen('login')} />
      )}
    </SafeAreaProvider>
  );
}