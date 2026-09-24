import AsyncStorage from '@react-native-async-storage/async-storage';
import env from '../config/env';

// Prefijo que usaba la app antes de renombrarse a SeñaPlay.
export const LEGACY_PREFIX = 'oratiolingo.';

/**
 * Migración única de claves locales: `oratiolingo.*` → `senaplay.*`.
 *
 * Al cambiar el nombre interno de la app, el progreso, la racha, las vidas y
 * las preferencias de quienes ya la usaban seguían guardados con el prefijo
 * antiguo. Esta función los copia al prefijo nuevo (sin pisar datos nuevos si
 * ya existieran) y borra los antiguos. Es idempotente: si no hay claves
 * antiguas no hace nada. Nunca lanza: si falla, la app arranca igual.
 */
export default async function migrateLegacyStorage(backend = AsyncStorage) {
  try {
    const keys = await backend.getAllKeys();
    const legacyKeys = keys.filter((key) => key.startsWith(LEGACY_PREFIX));
    if (!legacyKeys.length) return { migrated: 0 };

    const newPrefix = `${env.storagePrefix}.`;
    const existing = new Set(keys);
    const entries = await backend.multiGet(legacyKeys);
    const toWrite = entries
      .map(([key, value]) => [newPrefix + key.slice(LEGACY_PREFIX.length), value])
      .filter(([key, value]) => value !== null && !existing.has(key));

    if (toWrite.length) await backend.multiSet(toWrite);
    await backend.multiRemove(legacyKeys);
    return { migrated: toWrite.length };
  } catch {
    return { migrated: 0, failed: true };
  }
}
