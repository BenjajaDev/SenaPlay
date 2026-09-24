import appJson from '../../../app.json';

// Configuración de entorno. Los valores `EXPO_PUBLIC_*` se inyectan en build
// (archivo .env o variables de EAS) y permiten apuntar a otro proyecto de
// Supabase o a otro servidor de IA sin tocar código. Si no están definidos
// se usan los del proyecto actual para no romper el flujo de desarrollo.
//
// Solo van aquí valores PÚBLICOS: la clave de Supabase es "publishable" y la
// seguridad real está en las políticas RLS. Nunca pongas una service key.

export const env = Object.freeze({
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zjpsvtufseqbpfavepap.supabase.co',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_XU2l9g-EZf9qNN3AI_gBQQ_FGVJu2n_',
  // Servidor de IA (ai_module/server.py). En desarrollo es la IP LAN del PC.
  aiServerUrl: process.env.EXPO_PUBLIC_AI_SERVER_URL || 'http://192.168.1.5:8000',
  appVersion: appJson.expo.version,
  storagePrefix: 'senaplay',
});

export default env;
