import { parseEnv, type PortalEnv } from './envSchema';

// Se valida al importar: sin VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY el
// portal no arranca (no hay respaldos embebidos que apunten al proyecto real).
export const env: PortalEnv = parseEnv(import.meta.env);
