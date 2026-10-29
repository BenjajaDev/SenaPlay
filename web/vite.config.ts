import react from '@vitejs/plugin-react';
import path from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { parseEnv } from './src/lib/envSchema';

// Valida las VITE_* al arrancar `vite` / `vite build` (no en Vitest, que usa
// valores de prueba en src/test/setup.ts): un build sin variables falla en el
// CI en vez de publicar un portal que no arranca.
const validateEnv = (): Plugin => ({
  name: 'senaplay:validate-env',
  apply: (_config, { command }) => command === 'build' || !process.env.VITEST,
  configResolved(config) {
    parseEnv(config.env);
  },
});

// `@domain` apunta a la capa de dominio de la app móvil (JS puro, sin React
// Native): tipos de ejercicio, ExerciseFactory, LevelBuilder y reglas de
// configuración remota. Web y móvil validan con EXACTAMENTE el mismo código.
export default defineConfig({
  plugins: [react(), validateEnv()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@domain': path.resolve(import.meta.dirname, '../src/features'),
      '@core': path.resolve(import.meta.dirname, '../src/core'),
    },
  },
  server: {
    port: 5173,
    fs: { allow: ['..'] },
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
