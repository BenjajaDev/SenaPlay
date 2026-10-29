import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Valores ficticios: las pruebas nunca dependen de un .env real ni apuntan al
// proyecto de Supabase de producción (stubEnv pisa lo que venga de .env.local).
vi.stubEnv('VITE_SUPABASE_URL', 'https://senaplay-test.supabase.invalid');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_test');
vi.stubEnv('VITE_ANDROID_URL', '');
vi.stubEnv('VITE_IOS_URL', '');
