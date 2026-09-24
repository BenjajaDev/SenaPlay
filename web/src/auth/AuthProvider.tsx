import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRepositories } from '@/data/RepositoriesProvider';
import type { Role } from '@/data/types';
import { supabase } from '@/lib/supabase';
import { toUserMessage } from '@/lib/domain';

type AuthState = {
  status: 'loading' | 'signedIn' | 'signedOut';
  session: Session | null;
  role: Role;
  isStaff: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * Sesión del panel. El rol se lee de la tabla `profiles` (no de
 * user_metadata, que el usuario podría editar). Ocultar pantallas es solo
 * comodidad: la protección real son las políticas RLS en Supabase.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { users } = useRepositories();
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>('user');
  const [status, setStatus] = useState<AuthState['status']>('loading');

  const apply = useCallback(
    async (next: Session | null) => {
      setSession(next);
      setRole(next?.user ? await users.getRole(next.user.id) : 'user');
      setStatus(next ? 'signedIn' : 'signedOut');
    },
    [users],
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      apply(next);
    });
    return () => data.subscription.unsubscribe();
  }, [apply]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      session,
      role,
      isStaff: role === 'editor' || role === 'admin',
      isAdmin: role === 'admin',
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        return error ? toUserMessage(error) : null;
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [status, session, role],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return context;
}
