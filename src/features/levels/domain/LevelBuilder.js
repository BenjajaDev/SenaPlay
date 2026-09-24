import ExerciseFactory from './ExerciseFactory';

export const LEVEL_CATEGORIES = ['alfabeto', 'numeros', 'vocabulario', 'frases'];

/**
 * Builder de niveles (patrón Builder).
 *
 * Un nivel tiene varios campos opcionales y una lista de ejercicios que
 * deben validarse uno a uno; el builder permite armarlo paso a paso (desde el
 * catálogo remoto, el panel de administración o los tests) y valida todo en
 * `build()`, que devuelve un objeto inmutable.
 *
 *   const level = new LevelBuilder(1)
 *     .title('Letras A-E')
 *     .category('alfabeto')
 *     .addExercise({ type: 'matching', letters: ['a', 'b'] })
 *     .build();
 */
export class LevelBuilder {
  constructor(id) {
    this.data = { id: Number(id), title: '', description: '', category: 'alfabeto', available: true, sortOrder: 0 };
    this.rawExercises = [];
    this.strict = true;
  }

  static fromObject(raw) {
    const builder = new LevelBuilder(raw.id)
      .title(raw.title)
      .description(raw.description)
      .category(raw.category)
      .available(raw.available !== false)
      .sortOrder(raw.sort_order ?? raw.sortOrder ?? 0);
    (raw.exercises || []).forEach((exercise) => builder.addExercise(exercise));
    return builder;
  }

  title(value) {
    this.data.title = String(value || '').trim();
    return this;
  }

  description(value) {
    this.data.description = String(value || '').trim();
    return this;
  }

  category(value) {
    this.data.category = String(value || 'alfabeto').trim();
    return this;
  }

  available(value = true) {
    this.data.available = Boolean(value);
    return this;
  }

  sortOrder(value) {
    this.data.sortOrder = Number(value) || 0;
    return this;
  }

  addExercise(rawExercise) {
    this.rawExercises.push(rawExercise);
    return this;
  }

  /**
   * En modo tolerante los ejercicios inválidos se omiten (el nivel se sigue
   * pudiendo jugar); en modo estricto (default, usado por el admin) fallan.
   */
  lenient() {
    this.strict = false;
    return this;
  }

  build() {
    if (!Number.isInteger(this.data.id) || this.data.id <= 0) {
      throw new Error('El nivel necesita un id entero positivo');
    }
    if (!this.data.title) throw new Error(`El nivel ${this.data.id} necesita un título`);

    let exercises;
    let warnings = [];
    if (this.strict) {
      exercises = this.rawExercises.map((raw) => ExerciseFactory.create(raw));
    } else {
      const result = ExerciseFactory.createMany(this.rawExercises);
      exercises = result.exercises;
      warnings = result.errors;
    }

    return Object.freeze({
      ...this.data,
      // Un nivel sin ejercicios válidos no se puede jugar aunque esté marcado disponible.
      available: this.data.available && exercises.length > 0,
      exercises: Object.freeze(exercises),
      warnings: Object.freeze(warnings),
    });
  }
}

export default LevelBuilder;
