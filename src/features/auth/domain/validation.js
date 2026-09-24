// Validaciones de formularios de autenticación (puras). Devuelven un mapa
// { campo: mensaje } para mostrar el error JUNTO al campo, en vez de un modal
// por cada error (antes había que cerrar un diálogo para corregir cada dato).

export const MIN_PASSWORD_LENGTH = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email) {
  const value = String(email || '').trim();
  if (!value) return 'Ingresa tu correo.';
  if (!EMAIL_RE.test(value)) return 'El correo no tiene un formato válido.';
  return null;
}

export function validatePassword(password) {
  if (!password) return 'Ingresa una contraseña.';
  if (password.length < MIN_PASSWORD_LENGTH) return `Debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  return null;
}

export function validateBirthdate(value) {
  if (!value) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return 'Usa el formato DD/MM/AAAA.';
  const [, d, m, y] = match.map(Number);
  const date = new Date(y, m - 1, d);
  const valid = date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  if (!valid || date > new Date() || y < 1900) return 'La fecha no es válida.';
  return null;
}

const compact = (errors) => Object.fromEntries(Object.entries(errors).filter(([, message]) => message));

export function validateLogin({ email, password }) {
  return compact({ email: validateEmail(email), password: password ? null : 'Ingresa tu contraseña.' });
}

export function validateRegistration({ fullName, email, password, confirmPassword, birthdate }) {
  return compact({
    fullName: String(fullName || '').trim() ? null : 'Ingresa tu nombre completo.',
    email: validateEmail(email),
    birthdate: validateBirthdate(birthdate),
    password: validatePassword(password),
    confirmPassword: password && password !== confirmPassword ? 'Las contraseñas no coinciden.' : null,
  });
}

export function validateNewPassword({ password, confirmPassword }) {
  return compact({
    password: validatePassword(password),
    confirmPassword: password && password !== confirmPassword ? 'Las contraseñas no coinciden.' : null,
  });
}

export function formatBirthdateInput(text) {
  const digits = String(text || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
