import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// `@domain` apunta a la capa de dominio de la app móvil (JS puro, sin React
// Native): tipos de ejercicio, ExerciseFactory, LevelBuilder y reglas de
// configuración remota. Web y móvil validan con EXACTAMENTE el mismo código.
export default defineConfig({
  plugins: [react()],
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
