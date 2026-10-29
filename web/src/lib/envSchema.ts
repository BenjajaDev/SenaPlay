import { z } from 'zod';

// Esquema sin dependencias de Vite: lo usan tanto el portal en runtime
// (`env.ts`, con `import.meta.env`) como `vite.config.ts` en build, para que
// un deploy sin variables falle en el CI y no publique un sitio roto.

const MISSING = 'falta o está vacía';

const blankToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const httpUrl = z.url({
  protocol: /^https?$/,
  error: (issue) => (issue.input === undefined ? MISSING : 'debe ser una URL http(s) válida'),
});

const requiredUrl = z.preprocess(blankToUndefined, httpUrl);

const requiredString = z.preprocess(blankToUndefined, z.string({ error: MISSING }).trim());

const optionalUrl = z.preprocess(blankToUndefined, httpUrl.optional());

const rawEnvSchema = z.object({
  VITE_SUPABASE_URL: requiredUrl,
  VITE_SUPABASE_ANON_KEY: requiredString,
  VITE_ANDROID_URL: optionalUrl,
  VITE_IOS_URL: optionalUrl,
});

export interface PortalEnv {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
  readonly androidUrl?: string;
  readonly iosUrl?: string;
}

export class EnvValidationError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(
      [
        'Configuración inválida del portal web:',
        ...problems.map((problem) => `  - ${problem}`),
        'Defínelas en web/.env.local (plantilla: web/.env.example) o en las variables del entorno de build.',
      ].join('\n'),
    );
    this.name = 'EnvValidationError';
  }
}

export function parseEnv(source: Readonly<Record<string, unknown>>): PortalEnv {
  const result = rawEnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
  }
  const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_ANDROID_URL, VITE_IOS_URL } = result.data;
  return Object.freeze({
    supabaseUrl: VITE_SUPABASE_URL,
    supabaseAnonKey: VITE_SUPABASE_ANON_KEY,
    androidUrl: VITE_ANDROID_URL,
    iosUrl: VITE_IOS_URL,
  });
}
