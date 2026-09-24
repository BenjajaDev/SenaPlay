import AsyncStorage from '@react-native-async-storage/async-storage';
import env from '../config/env';

// Envoltorio JSON sobre AsyncStorage con claves versionadas:
//   storageKey('level.progress', 'v1', userId) → 'oratiolingo.level.progress.v1.<userId>'
// Nunca lanza: si el dato está corrupto o el almacenamiento falla devuelve
// el valor por defecto, para que la app siga funcionando offline.

export function storageKey(area, version = 'v1', scope) {
  return [env.storagePrefix, area, version, scope].filter(Boolean).join('.');
}

export function createJsonStorage(backend = AsyncStorage) {
  return {
    async get(key, fallback = null) {
      try {
        const raw = await backend.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    async set(key, value) {
      try {
        await backend.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    async remove(key) {
      try {
        await backend.removeItem(key);
      } catch {
        /* nada que limpiar */
      }
    },
  };
}

export const jsonStorage = createJsonStorage();
