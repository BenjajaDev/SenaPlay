/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_ANDROID_URL?: string;
  readonly VITE_IOS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Módulos JS del dominio compartido con la app móvil (tipados en lib/domain.ts).
declare module '@domain/*';
declare module '@core/*';
