import { EXERCISE_TYPES } from './exerciseTypes';

export class InvalidExerciseError extends Error {
  constructor(message, raw) {
    super(message);
    this.name = 'InvalidExerciseError';
    this.raw = raw;
  }
}

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isStringList = (value) => Array.isArray(value) && value.every(isNonEmptyString);

function validateField(name, spec, value, exercise) {
  if (value === undefined || value === null || value === '') {
    return spec.required ? `falta el campo "${name}"` : null;
  }
  switch (spec.type) {
    case 'sign':
    case 'text':
      return isNonEmptyString(value) ? null : `"${name}" debe ser texto`;
    case 'boolean':
      return typeof value === 'boolean' ? null : `"${name}" debe ser verdadero/falso`;
    case 'signs':
    case 'letters':
    case 'options':
      if (!isStringList(value)) return `"${name}" debe ser una lista de textos`;
      if (spec.min && value.length < spec.min) return `"${name}" necesita al menos ${spec.min} elementos`;
      return null;
    case 'choice':
      return exercise[spec.of]?.includes(value) ? null : `"${name}" debe ser una de las opciones`;
    case 'subset':
      if (!isStringList(value)) return `"${name}" debe ser una lista`;
      return value.every((item) => exercise[spec.of]?.includes(item))
        ? null
        : `"${name}" contiene valores que no están en las opciones`;
    default:
      return null;
  }
}

/**
 * Factory de ejercicios (patrón Factory).
 *
 * Toma un ejercicio "crudo" — del catálogo local, de una fila de Supabase o
 * del formulario del panel web — y devuelve un objeto normalizado e inmutable,
 * o lanza InvalidExerciseError con un mensaje legible. Así la UI nunca recibe
 * un ejercicio a medio definir (antes, un payload mal cargado en Supabase
 * rompía la pantalla del nivel en tiempo de ejecución).
 */
export const ExerciseFactory = {
  create(raw) {
    if (!raw || typeof raw !== 'object') {
      throw new InvalidExerciseError('El ejercicio está vacío', raw);
    }
    const definition = EXERCISE_TYPES[raw.type];
    if (!definition) {
      throw new InvalidExerciseError(`Tipo de ejercicio desconocido: "${raw.type}"`, raw);
    }

    const exercise = { type: raw.type, title: isNonEmptyString(raw.title) ? raw.title.trim() : definition.label };
    Object.keys(definition.fields).forEach((name) => {
      if (raw[name] !== undefined) exercise[name] = raw[name];
    });
    if (isNonEmptyString(raw.hint)) exercise.hint = raw.hint.trim();

    const errors = Object.entries(definition.fields)
      .map(([name, spec]) => validateField(name, spec, exercise[name], exercise))
      .filter(Boolean);
    if (errors.length) {
      throw new InvalidExerciseError(`Ejercicio "${exercise.title}" inválido: ${errors.join('; ')}`, raw);
    }

    return Object.freeze(exercise);
  },

  /** Fila de la tabla `exercises` de Supabase → ejercicio. */
  fromRow(row) {
    return ExerciseFactory.create({ type: row.type, title: row.title, hint: row.hint, ...(row.payload || {}) });
  },

  /** Ejercicio → { type, title, hint, payload } para guardar en Supabase. */
  toRow(exercise, position) {
    const { type, title, hint, ...payload } = exercise;
    return { position, type, title, hint: hint || null, payload };
  },

  /**
   * Crea varios y descarta los inválidos en vez de fallar todo el nivel.
   * Devuelve también los errores para registrarlos o mostrarlos en el admin.
   */
  createMany(rawList = []) {
    const exercises = [];
    const errors = [];
    rawList.forEach((raw, index) => {
      try {
        exercises.push(ExerciseFactory.create(raw));
      } catch (error) {
        errors.push({ index, message: error.message });
      }
    });
    return { exercises, errors };
  },

  validate(raw) {
    try {
      ExerciseFactory.create(raw);
      return { valid: true, error: null };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  },
};

export default ExerciseFactory;
