import { createCachedResource } from '../../../core/data/cachedResource';
import { withTimeout } from '../../../core/net/withTimeout';
import { storageKey } from '../../../core/storage/jsonStorage';
import ExerciseFactory from '../domain/ExerciseFactory';
import LevelBuilder from '../domain/LevelBuilder';

const CACHE_KEY = storageKey('catalog', 'v2');

/**
 * Repositorio del catálogo de niveles (patrón Repository) con tres fuentes,
 * en orden de preferencia:
 *
 *   1. remote  Supabase (tablas levels + exercises), editable desde el panel web
 *   2. cache   último catálogo remoto válido guardado en el dispositivo
 *   3. local   catálogo empaquetado con la app (levelsCatalog.js)
 *
 * Así la app nunca se queda sin niveles: sin conexión usa lo último que vio
 * y, en una instalación nueva sin red, el catálogo local. Cada nivel pasa por
 * LevelBuilder en modo tolerante: un ejercicio mal cargado desde el admin se
 * omite (y se reporta en `warnings`) en vez de romper la pantalla.
 *
 *   getLocalLevels()   → levels                                     (empaquetado, instantáneo)
 *   getCachedLevels()  → { levels, source: 'cache', warnings } | null (dispositivo, sin red)
 *   getLevels()        → { levels, source: 'remote' | 'cache' | 'local', warnings }
 */
export function createCatalogRepository({ supabase, storage, localLevels }) {
  const buildLevels = (rawLevels) => {
    const warnings = [];
    const levels = rawLevels
      .map((raw) => {
        try {
          const level = LevelBuilder.fromObject(raw).lenient().build();
          level.warnings.forEach((w) => warnings.push({ levelId: level.id, ...w }));
          return level;
        } catch (error) {
          warnings.push({ levelId: raw?.id, message: error.message });
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    return { levels, warnings };
  };

  const fetchRemote = async () => {
    const { data, error } = await withTimeout(
      supabase
        .from('levels')
        .select('id, title, description, category, available, sort_order, exercises(position, type, title, hint, payload)')
        .order('sort_order', { ascending: true }),
    );
    if (error) throw error;
    return (data || []).map((row) => ({
      ...row,
      exercises: (row.exercises || [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((exerciseRow) => ({ type: exerciseRow.type, title: exerciseRow.title, hint: exerciseRow.hint, ...(exerciseRow.payload || {}) })),
    }));
  };

  // Un catálogo solo vale si al menos un nivel sobrevive a LevelBuilder.
  const resource = createCachedResource({
    storage,
    cacheKey: CACHE_KEY,
    fetchRemote,
    local: localLevels,
    isValid: (rows) => Array.isArray(rows) && rows.length > 0 && buildLevels(rows).levels.length > 0,
  });

  return {
    async getLevels() {
      const { value, source } = await resource.read();
      return { ...buildLevels(value), source };
    },

    async getCachedLevels() {
      const cached = await resource.readCached();
      return cached ? { ...buildLevels(cached), source: 'cache' } : null;
    },

    getLocalLevels() {
      return buildLevels(localLevels).levels;
    },

    toExerciseRows(level) {
      return level.exercises.map((exercise, index) => ExerciseFactory.toRow(exercise, index));
    },
  };
}
