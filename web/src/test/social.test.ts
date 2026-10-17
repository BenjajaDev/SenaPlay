import { describe, expect, test } from 'vitest';
import { validatePassword } from '@/features/admin/account/ProfilePage';
import { cleanSocials, MAX_SOCIALS, socialError, socialHref } from '@/lib/social';

describe('redes sociales del equipo', () => {
  test('solo genera enlaces http(s) o mailto', () => {
    expect(socialHref({ network: 'github', url: 'github.com/senaplay' })).toBe('https://github.com/senaplay');
    expect(socialHref({ network: 'linkedin', url: 'https://linkedin.com/in/ana' })).toBe('https://linkedin.com/in/ana');
    expect(socialHref({ network: 'website', url: 'javascript:alert(1)' })).toBeNull();
    expect(socialHref({ network: 'website', url: 'data:text/html,hola' })).toBeNull();
    expect(socialHref({ network: 'email', url: 'ana@senaplay.cl' })).toBe('mailto:ana@senaplay.cl');
    expect(socialHref({ network: 'email', url: 'no-es-correo' })).toBeNull();
  });

  test('valida cada red con un mensaje en español', () => {
    expect(socialError({ network: 'x', url: '', animation: 'pop' })).toMatch(/enlace/);
    expect(socialError({ network: 'email', url: 'ana@', animation: 'pop' })).toMatch(/correo/);
    expect(socialError({ network: 'x', url: 'https://x.com/ana', animation: 'spin' })).toBeNull();
  });

  test('normaliza lo que viene de la base', () => {
    const raw = [
      { network: 'github', url: ' https://github.com/a ', animation: 'nope' },
      { network: 'myspace', url: 'https://x' },
      { network: 'x', url: '' },
      null,
      ...Array.from({ length: 10 }, () => ({ network: 'website', url: 'https://a.cl', animation: 'pop' })),
    ];
    const clean = cleanSocials(raw);
    expect(clean[0]).toEqual({ network: 'github', url: 'https://github.com/a', animation: 'pop' });
    expect(clean).toHaveLength(MAX_SOCIALS);
    expect(cleanSocials('no es lista')).toEqual([]);
  });
});

describe('cambio de contraseña', () => {
  test('exige actual, largo mínimo, letras y números y confirmación', () => {
    expect(validatePassword({ current: '', next: 'corta', confirm: '' })).toMatchObject({ current: expect.any(String), next: expect.stringMatching(/8/) });
    expect(validatePassword({ current: 'vieja123', next: 'soloLetras', confirm: 'soloLetras' }).next).toMatch(/letras y números/);
    expect(validatePassword({ current: 'clave1234', next: 'clave1234', confirm: 'clave1234' }).next).toMatch(/distinta/);
    expect(validatePassword({ current: 'vieja123', next: 'nueva1234', confirm: 'otra1234' }).confirm).toMatch(/no coinciden/);
    expect(validatePassword({ current: 'vieja123', next: 'nueva1234', confirm: 'nueva1234' })).toEqual({});
  });
});
