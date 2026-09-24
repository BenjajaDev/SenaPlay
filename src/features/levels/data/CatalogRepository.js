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
 *   getLevels() → { levels, source: 'remote' | 'cache' | 'local', warnings }
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
    const { data, error } = await supabase
      .from('levels')
      .select('id, title, description, category, available, sort_order, exercises(position, type, title, hint, payload)')
      .order('sort_order', { ascending: true });
    if (error || !data?.length) return null;
    return data.map((row) => ({
      ...row,
      exercises: (row.exercises || [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((exerciseRow) => ({ type: exerciseRow.type, title: exerciseRow.title, hint: exerciseRow.hint, ...(exerciseRow.payload || {}) })),
    }));
  };

  return {
    async getLevels() {
      try {
        const remote = await fetchRemote();
        if (remote) {
          const built = buildLevels(remote);
          if (built.levels.length) {
            await storage.set(CACHE_KEY, remote);
            return { ...built, source: 'remote' };
          }
        }
      } catch {
        /* sin red: se intenta la caché */
      }

      const cached = await storage.get(CACHE_KEY, null);
      if (Array.isArray(cached) && cached.length) {
        const built = buildLevels(cached);
        if (built.levels.length) return { ...built, source: 'cache' };
      }

      return { ...buildLevels(localLevels), source: 'local' };
    },

    /** Solo para el catálogo local empaquetado (arranque instantáneo). */
    getLocalLevels() {
      return buildLevels(localLevels).levels;
    },

    toExerciseRows(level) {
      return level.exercises.map((exercise, index) => ExerciseFactory.toRow(exercise, index));
    },
  };
}
