// Resultado uniforme de los repositorios: la UI nunca recibe excepciones ni
// errores crudos de Supabase, sino { ok, value } o { ok: false, error } con un
// mensaje en español listo para mostrar.

export const ok = (value = null) => ({ ok: true, value, error: null });
export const fail = (error, cause) => ({ ok: false, value: null, error, cause });

// Supabase devuelve mensajes en inglés; estos son los más frecuentes.
const ERROR_TRANSLATIONS = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/email not confirmed/i, 'Debes verificar tu correo antes de iniciar sesión.'],
  [/user already registered/i, 'Ya existe una cuenta con ese correo.'],
  [/password should be at least (\d+)/i, (m) => `La contraseña debe tener al menos ${m[1]} caracteres.`],
  [/token has expired|otp.*expired|invalid.*otp|token.*invalid/i, 'El código no es válido o ya expiró. Pide uno nuevo.'],
  [/for security purposes.*after (\d+) seconds/i, (m) => `Por seguridad, espera ${m[1]} segundos antes de reintentar.`],
  [/rate limit|too many requests/i, 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'],
  [/network request failed|failed to fetch|network/i, 'Sin conexión. Revisa tu internet e inténtalo de nuevo.'],
  [/new password should be different/i, 'La nueva contraseña debe ser distinta a la anterior.'],
  [/unable to validate email|invalid email/i, 'El correo no tiene un formato válido.'],
  [/row-level security|permission denied|not authorized/i, 'No tienes permisos para realizar esta acción.'],
];

export function toUserMessage(error, fallback = 'No se pudo completar la acción. Inténtalo de nuevo.') {
  const raw = typeof error === 'string' ? error : error?.message;
  if (!raw) return fallback;
  for (const [pattern, translation] of ERROR_TRANSLATIONS) {
    const match = raw.match(pattern);
    if (match) return typeof translation === 'function' ? translation(match) : translation;
  }
  return raw;
}

/** Ejecuta una operación async y la envuelve en un Result. */
export async function attempt(task, fallbackMessage) {
  try {
    return ok(await task());
  } catch (error) {
    return fail(toUserMessage(error, fallbackMessage), error);
  }
}
