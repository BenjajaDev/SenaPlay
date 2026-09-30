import ExerciseFactory from './ExerciseFactory';

/**
 * Rotación de ejercicios (JS puro, sin React).
 *
 * Cada nivel trae sus ejercicios escritos a mano; a partir de su contenido se
 * GENERAN variantes del mismo tema, y en cada sesión se sortea un conjunto del
 * mismo largo que el nivel original:
 *
 *   alfabeto       variantes con las letras PROPIAS del nivel (no las de sus
 *                  palabras de ejemplo): elegir la letra, escribirla,
 *                  verdadero/falso con la seña, ordenar y reconocer varias.
 *   vocabulario,   las palabras van deletreadas; las variantes son de
 *   números…       PALABRA: su significado, formarla y «¿estas señas forman
 *                  X?». Nunca letras sueltas fuera de tema.
 *
 * Al menos el 60 % de cada sesión son ejercicios escritos a mano (también
 * sorteados), para que el nivel conserve su intención.
 *
 * `random` se inyecta (por defecto Math.random) para testear con semilla.
 */

const ALPHABET = 'abcdefghijklmnñopqrstuvwxyz'.split('');
export const MIN_AUTHORED_SHARE = 0.6;

/** Clave canónica de una letra ('N~', 'n~' y 'ñ' → 'ñ'), o null si no es una letra. */
export function canonicalLetter(raw) {
  const key = String(raw ?? '').trim().toLocaleLowerCase('es');
  if (key === 'n~') return 'ñ';
  return ALPHABET.includes(key) ? key : null;
}

/** Texto a mostrar para una letra ('n~' → 'Ñ'). */
export function letterLabel(raw) {
  const letter = canonicalLetter(raw);
  return (letter ?? String(raw ?? '')).toLocaleUpperCase('es');
}

const upper = (value) => String(value).toLocaleUpperCase('es');
const plain = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('es')
    .trim();
const capitalize = (value) => {
  const lower = String(value).toLocaleLowerCase('es');
  return upper(lower.charAt(0)) + lower.slice(1);
};
const alphabetical = (a, b) => ALPHABET.indexOf(a) - ALPHABET.indexOf(b);

/** Clave estable de un ejercicio (no depende de su posición ni del título). */
export function exerciseKey(exercise) {
  if (!exercise) return '';
  const sign = exercise.sign ? canonicalLetter(exercise.sign) || exercise.sign : null;
  const content =
    sign ||
    (exercise.signs || exercise.letters || []).map((item) => canonicalLetter(item) || item).join(',') ||
    exercise.word ||
    exercise.statement ||
    exercise.title ||
    '';
  const suffix = exercise.type === 'true-false' && (exercise.sign || exercise.signs) ? `:${exercise.statement}` : '';
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

const isAlphabetLevel = (level) => (level?.category || 'alfabeto') === 'alfabeto';

/**
 * Contenido del nivel:
 *   letters  letras propias (de ejercicios SIN palabra), en clave canónica
 *   words    [{ word, signs, meaning, types }] palabras deletreadas del nivel
 */
export function collectSigns(level) {
  const letters = new Set();
  const words = new Map();
  const options = new Set();
  const exercises = level?.exercises || [];

  exercises.forEach((exercise) => {
    (exercise.options || []).forEach((option) => options.add(option));
    if (exercise.word) {
      const word = upper(exercise.word).trim();
      const entry = words.get(word) || { word, signs: null, meaning: null, types: new Set() };
      entry.types.add(exercise.type);
      if (exercise.signs?.length) entry.signs = exercise.signs.map((sign) => canonicalLetter(sign) || sign);
      if (exercise.type === 'word-meaning' && exercise.correct) entry.meaning = exercise.correct;
      words.set(word, entry);
      return;
    }
    [exercise.sign, ...(exercise.signs || []), ...(exercise.letters || [])].forEach((raw) => {
      const letter = canonicalLetter(raw);
      if (letter) letters.add(letter);
    });
  });

  // Significado de palabras sin «word-meaning»: se busca entre las opciones
  // del nivel (así «CAFE» se muestra «Café»); si no aparece, la palabra.
  const findMeaning = (word) =>
    [...options].find((option) =>
      plain(option)
        .split(/[/(]/)
        .map((part) => part.trim())
        .includes(plain(word)),
    ) || capitalize(word);

  return {
    letters: [...letters].sort(alphabetical),
    words: [...words.values()].map((entry) => ({
      ...entry,
      signs: entry.signs || [...entry.word.toLocaleLowerCase('es')].map((char) => canonicalLetter(char) || char),
      meaning: entry.meaning || findMeaning(entry.word),
    })),
  };
}

function pickOthers(target, candidates, count, random) {
  return shuffle(candidates.filter((item) => item !== target), random).slice(0, count);
}

/** Letras de relleno: primero las del nivel, luego vecinas del alfabeto. */
function distractorLetters(target, levelLetters, count, random, exclude = []) {
  const blocked = new Set([target, ...exclude]);
  const own = shuffle(levelLetters.filter((item) => !blocked.has(item)), random);
  const index = ALPHABET.indexOf(target);
  const neighbours = [1, -1, 2, -2, 3, -3]
    .map((offset) => ALPHABET[index + offset])
    .filter((item) => item && !blocked.has(item) && !own.includes(item));
  return [...own, ...neighbours].slice(0, count);
}

function letterVariants(letters, random) {
  if (letters.length < 2) return [];
  const raw = [];
  letters.forEach((letter) => {
    const options = shuffle([letter, ...distractorLetters(letter, letters, 2, random)], random).map(letterLabel);
    raw.push({ type: 'multiple-choice', title: '¿Qué letra representa esta SEÑA?', sign: letter, options, correct: letterLabel(letter) });
    raw.push({ type: 'typing', title: 'Escribe la letra correcta para esta SEÑA', sign: letter, answer: letterLabel(letter) });
    const truthful = random() < 0.5;
    const shown = truthful ? letter : distractorLetters(letter, letters, 1, random)[0];
    raw.push({
      type: 'true-false',
      title: '¿Es correcta esta afirmación?',
      sign: letter,
      statement: `Esta SEÑA corresponde a la letra ${letterLabel(shown)}.`,
      answer: shown === letter,
    });
  });
  if (letters.length >= 4) {
    const sample = shuffle(letters, random).slice(0, 4).sort(alphabetical);
    raw.push({ type: 'ordering', title: 'Ordena las SEÑAS en orden alfabético', letters: sample.map(letterLabel) });
    const shown = shuffle(letters, random).slice(0, letters.length >= 5 ? 3 : 2);
    const extra = shuffle(letters.filter((item) => !shown.includes(item)), random).slice(0, 3);
    raw.push({
      type: 'recognition',
      title: 'Selecciona las letras de estas SEÑAS',
      signs: shown,
      options: shuffle([...shown, ...extra], random).map(letterLabel),
      correct: shown.map(letterLabel),
    });
  }
  return raw;
}

function wordVariants(words, random) {
  if (words.length < 2) return [];
  const raw = [];
  const meanings = words.map((entry) => entry.meaning);
  words.forEach((entry) => {
    if (!entry.types.has('word-meaning')) {
      const options = shuffle([entry.meaning, ...pickOthers(entry.meaning, meanings, 2, random)], random);
      raw.push({ type: 'word-meaning', title: '¿Qué significa esta palabra en SEÑAS?', signs: entry.signs, word: entry.word, options, correct: entry.meaning });
    }
    if (!entry.types.has('interpret-signs')) {
      const own = [...entry.word].map((char) => canonicalLetter(char)).filter(Boolean);
      const pool = [...new Set(words.flatMap((other) => [...other.word].map(canonicalLetter)).filter(Boolean))];
      const extra = distractorLetters(own[0], pool, 3, random, own);
      raw.push({
        type: 'interpret-signs',
        title: 'Interpreta las SEÑAS y forma la palabra',
        signs: entry.signs,
        word: entry.word,
        letters: shuffle([...own, ...extra], random).map(letterLabel),
      });
    }
    const truthful = random() < 0.5;
    const shown = truthful ? entry : pickOthers(entry, words, 1, random)[0];
    raw.push({
      type: 'true-false',
      title: '¿Es correcta esta afirmación?',
      signs: entry.signs,
      statement: `Estas SEÑAS forman la palabra «${shown.meaning}».`,
      answer: shown === entry,
    });
  });
  return raw;
}

/** Variantes generadas según el tipo de nivel (ya validadas por ExerciseFactory). */
export function generateVariants(level, random = Math.random) {
  const { letters, words } = collectSigns(level);
  const raw = isAlphabetLevel(level) ? letterVariants(letters, random) : wordVariants(words, random);
  return ExerciseFactory.createMany(raw).exercises;
}

/** Toma uno de cada tipo por vuelta (orden de tipos al azar) hasta llegar a `count`. */
function roundRobin(list, count, random) {
  const byType = new Map();
  shuffle(list, random).forEach((exercise) => {
    if (!byType.has(exercise.type)) byType.set(exercise.type, []);
    byType.get(exercise.type).push(exercise);
  });
  const types = shuffle([...byType.keys()], random);
  const picked = [];
  while (picked.length < count && types.some((type) => byType.get(type).length)) {
    types.forEach((type) => {
      const next = byType.get(type).shift();
      if (next && picked.length < count) picked.push(next);
    });
  }
  return picked;
}

/**
 * Elige los ejercicios de una sesión.
 *
 *   size       cuántos (por defecto, los mismos que tiene el nivel)
 *   focusKeys  ejercicios que el usuario ha fallado antes: entran primero
 *              (hasta `maxFocus`) para practicar justo lo que más cuesta
 *
 * Garantiza la cuota de ejercicios escritos a mano, reparte los cupos por
 * tipo y evita dos del mismo tipo seguidos cuando se puede.
 */
export function pickSessionExercises(level, { size, random = Math.random, focusKeys = [], maxFocus = 2 } = {}) {
  const authored = level?.exercises || [];
  if (!authored.length) return [];
  const target = Math.max(1, Math.min(size || authored.length, 12));

  const authoredKeys = new Set();
  const authoredPool = authored.filter((exercise) => {
    const key = exerciseKey(exercise);
    if (authoredKeys.has(key)) return false;
    authoredKeys.add(key);
    return true;
  });
  const generated = generateVariants(level, random).filter((exercise) => {
    const key = exerciseKey(exercise);
    if (authoredKeys.has(key)) return false;
    authoredKeys.add(key);
    return true;
  });
  const pool = [...authoredPool, ...generated];

  const chosen = [];
  const taken = new Set();
  const takeAll = (list) =>
    list.forEach((exercise) => {
      if (!taken.has(exercise) && chosen.length < target) {
        chosen.push(exercise);
        taken.add(exercise);
      }
    });

  // 1. Lo que el usuario falla más, si existe en este nivel.
  takeAll(
    focusKeys
      .map((key) => pool.find((exercise) => exerciseKey(exercise) === key))
      .filter(Boolean)
      .slice(0, maxFocus),
  );

  // 2. Cuota mínima de ejercicios escritos a mano.
  const authoredChosen = chosen.filter((exercise) => authoredPool.includes(exercise)).length;
  const minAuthored = Math.min(authoredPool.length, Math.ceil(target * MIN_AUTHORED_SHARE));
  takeAll(roundRobin(authoredPool.filter((exercise) => !taken.has(exercise)), minAuthored - authoredChosen, random));

  // 3. El resto, del pool completo, con variedad de tipos.
  takeAll(roundRobin(pool.filter((exercise) => !taken.has(exercise)), target - chosen.length, random));

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
