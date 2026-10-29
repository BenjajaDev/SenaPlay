import { describe, expect, test } from 'vitest';
import { env } from '@/lib/env';
import { EnvValidationError, parseEnv } from '@/lib/envSchema';

const VALID = {
  VITE_SUPABASE_URL: 'https://demo.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_demo',
};

function problemsOf(source: Record<string, unknown>): readonly string[] {
  try {
    parseEnv(source);
  } catch (error) {
    if (error instanceof EnvValidationError) return error.problems;
    throw error;
  }
  throw new Error('parseEnv debió fallar');
}

describe('variables de entorno del portal', () => {
  test('las pruebas usan los valores ficticios de setup.ts', () => {
    expect(env.supabaseUrl).toBe('https://senaplay-test.supabase.invalid');
    expect(env.supabaseAnonKey).toBe('sb_publishable_test');
  });

  test('acepta la configuración mínima y deja opcionales los enlaces de tiendas', () => {
    expect(parseEnv(VALID)).toEqual({
      supabaseUrl: 'https://demo.supabase.co',
      supabaseAnonKey: 'sb_publishable_demo',
      androidUrl: undefined,
      iosUrl: undefined,
    });
  });

  test('normaliza enlaces vacíos y espacios', () => {
    const parsed = parseEnv({
      ...VALID,
      VITE_SUPABASE_ANON_KEY: '  sb_publishable_demo  ',
      VITE_ANDROID_URL: 'https://play.google.com/store/apps/details?id=cl.senaplay',
      VITE_IOS_URL: '   ',
    });
    expect(parsed.supabaseAnonKey).toBe('sb_publishable_demo');
    expect(parsed.androidUrl).toMatch(/^https:\/\/play\.google\.com/);
    expect(parsed.iosUrl).toBeUndefined();
  });

  test('falla nombrando cada variable obligatoria que falta o está vacía', () => {
    expect(problemsOf({ VITE_SUPABASE_ANON_KEY: ' ' })).toEqual([
      'VITE_SUPABASE_URL: falta o está vacía',
      'VITE_SUPABASE_ANON_KEY: falta o está vacía',
    ]);
  });

  test('rechaza URLs inválidas o con protocolo no http(s)', () => {
    expect(problemsOf({ ...VALID, VITE_SUPABASE_URL: 'no-es-url' })).toEqual([
      'VITE_SUPABASE_URL: debe ser una URL http(s) válida',
    ]);
    expect(problemsOf({ ...VALID, VITE_IOS_URL: 'javascript:alert(1)' })).toEqual([
      'VITE_IOS_URL: debe ser una URL http(s) válida',
    ]);
  });

  test('el mensaje indica dónde definir las variables', () => {
    expect(() => parseEnv({})).toThrow(/web\/\.env\.example/);
  });
});
