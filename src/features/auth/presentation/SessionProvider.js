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
  // Evita que una respuesta lenta pise a una sesión más nueva.
  const sequenceRef = useRef(0);
  // Rol ya conocido del usuario actual: los refrescos de token no esperan
  // otra consulta (se revalida en segundo plano).
  const roleCacheRef = useRef({ id: null, role: 'user' });

  const applySession = useCallback(
    async (session) => {
      const ticket = ++sequenceRef.current;
      const nextUser = session?.user ?? null;
      let nextRole = 'user';
      if (nextUser) {
        const cached = roleCacheRef.current;
        // El rol se resuelve ANTES de marcar la sesión como iniciada. Antes se
        // entraba como 'user' y un instante después pasaba a 'admin': el
        // mantenimiento aparecía y desaparecía solo para los administradores.
        nextRole = cached.id === nextUser.id ? cached.role : await profile.getRole(nextUser.id);
        roleCacheRef.current = { id: nextUser.id, role: nextRole };
        if (cached.id === nextUser.id) {
          profile.getRole(nextUser.id).then((fresh) => {
            if (fresh !== roleCacheRef.current.role && roleCacheRef.current.id === nextUser.id) {
              roleCacheRef.current = { id: nextUser.id, role: fresh };
              setRole(fresh);
            }
          });
        }
      } else {
        roleCacheRef.current = { id: null, role: 'user' };
      }
      if (ticket !== sequenceRef.current) return;
      setUser(nextUser);
      setRole(nextRole);
      setStatus(nextUser ? 'signedIn' : 'signedOut');
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
