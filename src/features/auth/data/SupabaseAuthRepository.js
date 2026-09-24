import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { fail, ok, toUserMessage } from '../../../core/result';

/**
 * Repositorio de autenticación (patrón Repository) sobre Supabase Auth.
 *
 * Contrato (lo que la UI puede usar):
 *   getSession()                     → Result<session|null>
 *   onSessionChange(cb)              → unsubscribe()
 *   getCurrentUser()                 → Result<user|null>
 *   signIn(email, password)          → Result<user>  (exige correo verificado)
 *   signUp({ email, password, profile }) → Result<void>
 *   signInWithProvider(provider)     → Result<void|'cancelled'>
 *   signOut()                        → Result<void>
 *   requestPasswordReset(email)      → Result<void>
 *   resendSignupEmail(email)         → Result<void>
 *   verifyCode({ email, code, purpose }) → Result<session>
 *   updatePassword(password)         → Result<void>
 *
 * Cambiar de proveedor (Firebase, API propia) implica solo otra
 * implementación de este contrato; las pantallas no cambian.
 */
export function createAuthRepository(supabase) {
  const run = async (task, fallback) => {
    try {
      const { data, error } = await task();
      if (error) return fail(toUserMessage(error, fallback), error);
      return ok(data);
    } catch (error) {
      return fail(toUserMessage(error, fallback), error);
    }
  };

  const isEmailVerified = (user) => Boolean(user?.email_confirmed_at || user?.confirmed_at);

  return {
    async getSession() {
      const result = await run(() => supabase.auth.getSession(), 'No se pudo recuperar tu sesión.');
      return result.ok ? ok(result.value?.session ?? null) : result;
    },

    onSessionChange(callback) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => callback(session, event));
      return () => data?.subscription?.unsubscribe();
    },

    async getCurrentUser() {
      const result = await run(() => supabase.auth.getUser(), 'No se pudo cargar tu usuario.');
      return result.ok ? ok(result.value?.user ?? null) : result;
    },

    async signIn(email, password) {
      const result = await run(
        () => supabase.auth.signInWithPassword({ email: email.trim(), password }),
        'No se pudo iniciar sesión. Inténtalo de nuevo.',
      );
      if (!result.ok) return result;
      if (!isEmailVerified(result.value?.user)) {
        await supabase.auth.signOut();
        return fail('Debes verificar tu correo antes de iniciar sesión.', { code: 'email_not_verified' });
      }
      return ok(result.value.user);
    },

    async signUp({ email, password, profile = {} }) {
      const result = await run(
        () =>
          supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                full_name: profile.fullName?.trim() || null,
                phone: profile.phone?.trim() || null,
                birthdate: profile.birthdate?.trim() || null,
                gender: profile.gender || null,
              },
            },
          }),
        'No se pudo crear la cuenta.',
      );
      return result.ok ? ok() : result;
    },

    async signInWithProvider(provider) {
      try {
        const redirectTo = Linking.createURL('/auth/callback');
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error) return fail(toUserMessage(error), error);
        if (!data?.url) return fail('El proveedor no respondió.');

        const browserResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (browserResult.type !== 'success' || !browserResult.url) return ok('cancelled');

        const url = browserResult.url;
        const query = new URLSearchParams(url.split('?')[1]?.split('#')[0] || '');
        const hash = new URLSearchParams(url.split('#')[1] || '');
        // Flujo PKCE: ?code=… se intercambia por la sesión.
        const code = query.get('code');
        // Flujo implícito: los tokens llegan en el hash.
        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) return fail(toUserMessage(exchangeError), exchangeError);
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) return fail(toUserMessage(sessionError), sessionError);
        }
        return ok();
      } catch (error) {
        return fail(toUserMessage(error, 'No se pudo iniciar sesión con este proveedor.'), error);
      }
    },

    async signOut() {
      const result = await run(() => supabase.auth.signOut(), 'No se pudo cerrar la sesión.');
      return result.ok ? ok() : result;
    },

    async requestPasswordReset(email) {
      const result = await run(
        () => supabase.auth.resetPasswordForEmail(email.trim()),
        'No se pudo enviar el código de recuperación.',
      );
      return result.ok ? ok() : result;
    },

    async resendSignupEmail(email) {
      const result = await run(
        () => supabase.auth.resend({ type: 'signup', email: email.trim() }),
        'No se pudo reenviar el correo de verificación.',
      );
      return result.ok ? ok() : result;
    },

    async verifyCode({ email, code, purpose = 'signup' }) {
      const result = await run(
        () => supabase.auth.verifyOtp({ email, token: code, type: purpose === 'recovery' ? 'recovery' : 'signup' }),
        'No se pudo verificar el código.',
      );
      return result.ok ? ok(result.value?.session ?? null) : result;
    },

    async updatePassword(password) {
      const result = await run(() => supabase.auth.updateUser({ password }), 'No se pudo actualizar la contraseña.');
      return result.ok ? ok() : result;
    },
  };
}
