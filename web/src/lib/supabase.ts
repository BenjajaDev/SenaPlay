import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

// Cliente único del portal. La seguridad del panel NO depende de ocultar
// pantallas: todas las escrituras están protegidas por RLS en Supabase
// (ver supabase/migrations), así que un usuario sin rol staff no puede
// modificar nada aunque manipule el front.
export const supabase: SupabaseClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
