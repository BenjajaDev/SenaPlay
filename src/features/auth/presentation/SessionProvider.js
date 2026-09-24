import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useServices } from '../../../core/di/ServicesProvider';
import { APP_EVENTS } from '../../../core/events/EventBus';

const SessionContext = createContext(null);

/**
 * Estado de autenticación de la app (Observer sobre Supabase Auth):
 *   status  'loading' | 'signedIn' | 'signedOut'
 *   user    usuario actual (user_metadata incluye nombre, avatar…)
 *   role    'user' | 'editor' | 'admin' (tabla profiles)
 *
 * `holdNavigation()` pausa la reacción a cambios de sesión: durante la
 * recuperación de contraseña, verificar el código crea una sesión, y sin
 * esta pausa la app saltaría al inicio antes de que el usuario defina la
 * nueva clave.
 */
export function SessionProvider({ children }) {
  const { auth, profile, events } = useServices();
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('user');
  const holdRef = useRef(false);

  const applySession = useCallback(
    async (session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setStatus(nextUser ? 'signedIn' : 'signedOut');
      setRole(nextUser ? await profile.getRole(nextUser.id) : 'user');
      events.emit(APP_EVENTS.SESSION_CHANGED, { user: nextUser });
    },
    [profile, events],
  );

  useEffect(() => {
    let mounted = true;
    auth.getSession().then((result) => {
      if (mounted) applySession(result.ok ? result.value : null);
    });
    const unsubscribe = auth.onSessionChange((session) => {
      if (!holdRef.current) applySession(session);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [auth, applySession]);

  const refreshUser = useCallback(
    async (override) => {
      if (override) {
        setUser(override);
        return;
      }
      const result = await auth.getCurrentUser();
      if (result.ok && result.value) setUser(result.value);
    },
    [auth],
  );

  const value = useMemo(
    () => ({
      status,
      user,
      role,
      isAdmin: role === 'admin',
      refreshUser,
      holdNavigation: () => {
        holdRef.current = true;
      },
      releaseNavigation: async () => {
        holdRef.current = false;
        const result = await auth.getSession();
        await applySession(result.ok ? result.value : null);
      },
    }),
    [status, user, role, refreshUser, auth, applySession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession debe usarse dentro de <SessionProvider>.');
  return context;
}
