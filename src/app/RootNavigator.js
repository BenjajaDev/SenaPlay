import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import LoginScreen from '../features/auth/presentation/LoginScreen';
import RegisterScreen from '../features/auth/presentation/RegisterScreen';
import ResetPasswordScreen from '../features/auth/presentation/ResetPasswordScreen';
import { useSession } from '../features/auth/presentation/SessionProvider';
import VerifyCodeScreen from '../features/auth/presentation/VerifyCodeScreen';
import AppGateScreen from '../features/remoteConfig/presentation/AppGateScreen';
import { useRemoteConfig } from '../features/remoteConfig/presentation/RemoteConfigProvider';
import { Spinner } from '../shared/ui';
import FadeInView from '../shared/ui/motion/FadeInView';
import { useAppTheme } from '../shared/theme/ThemeProvider';
import MainAppScreen from './MainAppScreen';

/**
 * Navegación de nivel superior como máquina de estados explícita:
 *
 *   loading ─▶ login ⇄ register ─▶ verify ─▶ main
 *                 └──▶ verify(recovery) ─▶ resetPassword ─▶ login
 *
 * Además, la configuración remota puede bloquear toda la app
 * (mantenimiento / versión mínima) antes de cualquier pantalla.
 *
 * Cada cambio de ruta monta la pantalla dentro de FadeInView con una key
 * distinta: transición suave y consistente entre rutas.
 */
export default function RootNavigator() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const session = useSession();
  const { remoteState } = useRemoteConfig();
  const [route, setRoute] = useState({ name: 'login' });

  // La sesión manda: si hay usuario se entra a la app; si se cierra, al login.
  useEffect(() => {
    if (session.status === 'signedIn') setRoute((prev) => (prev.name === 'resetPassword' ? prev : { name: 'main' }));
    if (session.status === 'signedOut') setRoute((prev) => (prev.name === 'main' ? { name: 'login' } : prev));
  }, [session.status]);

  if (remoteState.gate) return <AppGateScreen gate={remoteState.gate} />;

  if (session.status === 'loading') {
    return (
      <View style={styles.loader}>
        <Spinner size={64} label="Preparando SeñaPlay…" />
      </View>
    );
  }

  const go = (name, params = {}) => setRoute({ name, ...params });

  const renderRoute = () => {
    switch (route.name) {
      case 'register':
        return (
          <RegisterScreen
            onGoToLogin={() => go('login')}
            onNeedVerification={(email) => go('verify', { email, purpose: 'signup' })}
          />
        );
      case 'verify':
        return (
          <VerifyCodeScreen
            email={route.email}
            purpose={route.purpose}
            onBack={() => {
              if (route.purpose === 'recovery') session.releaseNavigation();
              go('login');
            }}
            onVerified={() => go(route.purpose === 'recovery' ? 'resetPassword' : 'main')}
          />
        );
      case 'resetPassword':
        return (
          <ResetPasswordScreen
            onDone={() => {
              session.releaseNavigation();
              go('login');
            }}
          />
        );
      case 'main':
        return session.user ? <MainAppScreen /> : null;
      default:
        return (
          <LoginScreen
            onGoToRegister={() => go('register')}
            onLoginSuccess={() => go('main')}
            onNeedPasswordReset={(email) => {
              session.holdNavigation();
              go('verify', { email, purpose: 'recovery' });
            }}
          />
        );
    }
  };

  return (
    <FadeInView key={route.name} style={styles.flex} distance={16}>
      {renderRoute()}
    </FadeInView>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.colors.background },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  });
}
