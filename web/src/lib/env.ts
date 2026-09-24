// Configuración pública del portal (Vite inyecta VITE_* en build).
// Si faltan, se usan los del proyecto actual de Supabase (valores públicos).
export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'https://zjpsvtufseqbpfavepap.supabase.co',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_XU2l9g-EZf9qNN3AI_gBQQ_FGVJu2n_',
  androidUrl: import.meta.env.VITE_ANDROID_URL || '',
  iosUrl: import.meta.env.VITE_IOS_URL || '',
};
