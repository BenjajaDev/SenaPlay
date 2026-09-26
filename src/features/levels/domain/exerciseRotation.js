import ExerciseFactory from './ExerciseFactory';

/**
 * Rotación de ejercicios (JS puro, sin React).
 *
 * Cada nivel trae sus ejercicios escritos a mano; a partir de las señas que
 * usa se GENERAN variantes (elegir la letra, escribirla, verdadero/falso con
 * la seña, ordenar, elegir el significado). En cada sesión se sortea un
 * subconjunto del mismo largo que el nivel original, cuidando que haya
 * variedad de tipos: repetir un nivel ya no es memorizar el mismo orden.
 *
 * `random` se inyecta (por defecto Math.random) para poder testear con una
 * secuencia fija.
 */

const ALPHABET = 'abcdefghijklmnñopqrstuvwxyz'.split('');
const isLetter = (key) => typeof key === 'string' && key.length === 1 && ALPHABET.includes(key.toLocaleLowerCase('es'));
const isWord = (key) => typeof key === 'string' && key.trim().length > 1;
const upper = (value) => String(value).toLocaleUpperCase('es');
const capitalize = (value) => upper(value.charAt(0)) + value.slice(1);

/** Clave estable de un ejercicio (no depende de su posición en el nivel). */
export function exerciseKey(exercise) {
  if (!exercise) return '';
  const content =
    exercise.sign ||
    (exercise.signs || exercise.letters || []).join(',') ||
    exercise.word ||
    exercise.statement ||
    exercise.title ||
    '';
  const suffix = exercise.type === 'true-false' && exercise.sign ? `:${exercise.statement}` : '';
  return `${exercise.type}:${String(content).toLocaleLowerCase('es')}${suffix}`.slice(0, 200);
}

export function shuffle(list, random = Math.random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Señas que usa el nivel, separadas en letras y palabras (claves en minúscula). */
export function collectSigns(level) {
  const letters = new Set();
  const words = new Set();
  (level?.exercises || []).forEach((exercise) => {
    const keys = [exercise.sign, ...(exercise.signs || []), ...(exercise.letters || [])].filter(Boolean);
    keys.forEach((raw) => {
      const key = String(raw).trim().toLocaleLowerCase('es');
      if (isLetter(key)) letters.add(key);
      else if (isWord(key)) words.add(key);
    });
  });
  return { letters: [...letters], words: [...words] };
}

function pickDistractors(target, candidates, count, random) {
  const own = shuffle(candidates.filter((item) => item !== target), random);
  if (own.length >= count) return own.slice(0, count);
  // Si el nivel tiene pocas letras, se completan con letras vecinas del alfabeto.
  const index = ALPHABET.indexOf(target);
  const neighbours = [ALPHABET[index - 1], ALPHABET[index + 1], ALPHABET[index + 2], ALPHABET[index - 2]].filter(
    (item) => item && item !== target && !own.includes(item),
  );
  return [...own, ...neighbours].slice(0, count);
}

/** Variantes generadas a partir de las señas del nivel (ya validadas por ExerciseFactory). */
export function generateVariants(level, random = Math.random) {
  const { letters, words } = collectSigns(level);
  const raw = [];

  if (letters.length >= 2) {
    letters.forEach((letter) => {
      const options = shuffle([letter, ...pickDistractors(letter, letters, 2, random)], random).map(upper);
      raw.push({ type: 'multiple-choice', title: '¿Qué letra representa esta SEÑA?', sign: letter, options, correct: upper(letter) });
      raw.push({ type: 'typing', title: 'Escribe la letra correcta para esta SEÑA', sign: letter, answer: upper(letter) });
      const truthful = random() < 0.5;
      const shown = truthful ? letter : pickDistractors(letter, letters, 1, random)[0];
      raw.push({
        type: 'true-false',
        title: '¿Es correcta esta afirmación?',
        sign: letter,
        statement: `Esta SEÑA corresponde a la letra ${upper(shown)}.`,
        answer: shown === letter,
      });
    });
    if (letters.length >= 4) {
      const sample = shuffle(letters, random).slice(0, 4).sort((a, b) => a.localeCompare(b, 'es'));
      raw.push({ type: 'ordering', title: 'Ordena las letras en secuencia alfabética', letters: sample.map(upper) });
    }
  }

  if (words.length >= 2) {
    words.forEach((word) => {
      const options = shuffle([word, ...shuffle(words.filter((item) => item !== word), random).slice(0, 2)], random).map(capitalize);
      raw.push({ type: 'word-meaning', title: '¿Qué significa esta SEÑA?', signs: [word], options, correct: capitalize(word) });
      const truthful = random() < 0.5;
      const shown = truthful ? word : shuffle(words.filter((item) => item !== word), random)[0];
      raw.push({
        type: 'true-false',
        title: '¿Es correcta esta afirmación?',
        sign: word,
        statement: `Esta SEÑA significa «${shown}».`,
        answer: shown === word,
      });
    });
  }

  return ExerciseFactory.createMany(raw).exercises;
}

/**
 * Elige los ejercicios de una sesión.
 *
 *   size       cuántos (por defecto, los mismos que tiene el nivel)
 *   focusKeys  ejercicios que el usuario ha fallado antes: entran primero
 *              (hasta `maxFocus`) para practicar justo lo que más cuesta
 *
 * Reparte los cupos por tipo (uno de cada tipo por vuelta) para que no toquen
 * seis ejercicios iguales, y evita dos del mismo tipo seguidos cuando se puede.
 */
export function pickSessionExercises(level, { size, random = Math.random, focusKeys = [], maxFocus = 2 } = {}) {
  const authored = level?.exercises || [];
  if (!authored.length) return [];
  const target = Math.max(1, Math.min(size || authored.length, 12));

  const seen = new Set();
  const pool = [];
  [...authored, ...generateVariants(level, random)].forEach((exercise) => {
    const key = exerciseKey(exercise);
    if (seen.has(key)) return;
    seen.add(key);
    pool.push(exercise);
  });

  const chosen = [];
  const taken = new Set();
  const take = (exercise) => {
    chosen.push(exercise);
    taken.add(exercise);
  };

  // 1. Lo que el usuario falla más, si existe en este nivel.
  focusKeys
    .map((key) => pool.find((exercise) => exerciseKey(exercise) === key))
    .filter(Boolean)
    .slice(0, maxFocus)
    .forEach(take);

  // 2. Una vuelta por tipo hasta completar el cupo.
  const byType = new Map();
  shuffle(pool, random).forEach((exercise) => {
    if (taken.has(exercise)) return;
    if (!byType.has(exercise.type)) byType.set(exercise.type, []);
    byType.get(exercise.type).push(exercise);
  });
  const types = shuffle([...byType.keys()], random);
  while (chosen.length < target && types.some((type) => byType.get(type).length)) {
    types.forEach((type) => {
      const next = byType.get(type).shift();
      if (next && chosen.length < target) take(next);
    });
  }

  return arrangeForVariety(shuffle(chosen, random));
}

/** Reordena para no repetir tipo seguido; «emparejar» (el más guiado) va primero si está. */
function arrangeForVariety(list) {
  const remaining = [...list];
  const ordered = [];
  const matching = remaining.findIndex((exercise) => exercise.type === 'matching');
  if (matching >= 0) ordered.push(...remaining.splice(matching, 1));
  while (remaining.length) {
    const lastType = ordered[ordered.length - 1]?.type;
    const index = remaining.findIndex((exercise) => exercise.type !== lastType);
    ordered.push(...remaining.splice(index >= 0 ? index : 0, 1));
  }
  return ordered;
}
