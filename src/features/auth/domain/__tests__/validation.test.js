import {
  formatBirthdateInput,
  validateBirthdate,
  validateEmail,
  validateLogin,
  validateNewPassword,
  validateRegistration,
} from '../validation';

describe('validaciones de autenticación', () => {
  test('correo', () => {
    expect(validateEmail('')).toMatch(/Ingresa/);
    expect(validateEmail('hola@')).toMatch(/formato/);
    expect(validateEmail(' persona@correo.cl ')).toBeNull();
  });

  test('fecha de nacimiento', () => {
    expect(formatBirthdateInput('17092001')).toBe('17/09/2001');
    expect(validateBirthdate('')).toBeNull();
    expect(validateBirthdate('31/02/2001')).toMatch(/no es válida/);
    expect(validateBirthdate('17/09/2001')).toBeNull();
    expect(validateBirthdate('1709')).toMatch(/formato/);
  });

  test('login y registro devuelven errores por campo', () => {
    expect(validateLogin({ email: 'a@b.cl', password: '' })).toEqual({ password: 'Ingresa tu contraseña.' });
    const errors = validateRegistration({ fullName: '', email: 'x', password: '123', confirmPassword: '124' });
    expect(Object.keys(errors).sort()).toEqual(['confirmPassword', 'email', 'fullName', 'password']);
    expect(validateNewPassword({ password: 'secreto1', confirmPassword: 'secreto1' })).toEqual({});
  });
});
