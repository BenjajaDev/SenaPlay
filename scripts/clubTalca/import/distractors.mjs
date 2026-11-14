// Lógica pura del generador de distractores de los niveles del club
// (ver scripts/clubTalca/generarDistractores.mjs). Todo es determinista: la
// aleatoriedad sale de una semilla por nivel y ejercicio, y los datos se
// ordenan antes de mezclarlos, así que correrlo dos veces da el mismo JSON.

export const RECOGNITION_TITLE = 'Marca todas las palabras que corresponden a estas señas';
const MIN_DISTRACTORS = 2;
const MAX_DISTRACTORS = 3;

// ── Aleatoriedad reproducible ────────────────────────────────

function hashSeed(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

// mulberry32: generador pequeño y estable entre versiones de Node.
function rngFor(seedText) {
  let a = hashSeed(seedText);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rng) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const byText = (a, b) => String(a).localeCompare(String(b), 'es');

// ── Palabras del nivel ───────────────────────────────────────

/** Claves de seña que muestra un ejercicio (no las palabras de las opciones). */
function signKeysOf(exercise) {
  const keys = [exercise.sign, ...(exercise.signs || [])];
  if (exercise.type === 'matching') keys.push(...exercise.letters);
  return keys.filter(Boolean);
}

/**
 * Palabras del nivel candidatas a distractor: { key, label } de cada seña que
 * aparece en algún ejercicio y es una seña suelta del club (no frase ni letra).
 * Solo depende de las señas del nivel, que este generador nunca cambia.
 */
function levelWords(level, { singleKeys, labels, clubDictionary, clipsByKey }) {
  const keys = [...new Set(level.exercises.flatMap(signKeysOf))].filter((key) => singleKeys.has(key)).sort(byText);
  // Sin etiqueta del nivel se usa la primera alternativa de la glosa («OVEJA / CORDERO» → «Oveja»).
  const fallback = (clip) => clubDictionary.formatGloss(clip.gloss.split('/')[0], { proper: clip.topic === 'Ciudades_de_Chile' });
  return keys.map((key) => ({ key, label: labels.get(key) ?? fallback(clipsByKey.get(key)) }));
}

// ── Reconocimiento ───────────────────────────────────────────

/** Mezcla opciones hasta que los distractores no queden todos al final ni en el mismo orden que antes. */
function mixOptions(correct, distractors, rng) {
  const all = [...correct, ...distractors].sort(byText);
  let options = shuffled(all, rng);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const tailIsAllDistractors = options.slice(-distractors.length).every((item) => distractors.includes(item));
    const headIsAllCorrect = options.slice(0, correct.length).every((item) => correct.includes(item));
    if (!tailIsAllDistractors && !headIsAllCorrect) break;
    options = shuffled(all, rng);
  }
  return options;
}

function withDistractors(level, index, exercise, context) {
  const correct = exercise.correct;
  const shown = new Set(exercise.signs);
  const normalize = context.clubDictionary.normalizeWord;
  const taken = new Set(correct.map(normalize));
  const candidates = levelWords(level, context).filter(
    (word) => !shown.has(word.key) && !taken.has(normalize(word.label)),
  );
  const wanted = Math.min(correct.length <= 2 ? MAX_DISTRACTORS : MIN_DISTRACTORS, candidates.length);
  if (wanted < MIN_DISTRACTORS) {
    throw new Error(`nivel ${level.id} #${index + 1}: no hay ${MIN_DISTRACTORS} palabras del mismo tema para usar de distractor`);
  }
  const rng = rngFor(`recognition:${level.id}:${index}`);
  const distractors = shuffled(candidates, rng).slice(0, wanted).map((word) => word.label);
  return {
    ...exercise,
    title: RECOGNITION_TITLE,
    options: mixOptions(correct, distractors, rng),
  };
}

// ── Posición de la respuesta ─────────────────────────────────

/** Posiciones de la respuesta repartidas por igual y en orden mezclado (determinista). */
function balancedPositions(count, size, seed) {
  const cycle = Array.from({ length: count }, (_, index) => index % size);
  return shuffled(cycle, rngFor(seed));
}

function placeCorrect(list, correct, position, rng) {
  const others = list.filter((item) => item !== correct).sort(byText);
  const mixed = shuffled(others, rng);
  mixed.splice(position, 0, correct);
  return mixed;
}

// ── Principal ────────────────────────────────────────────────

/**
 * Devuelve un documento nuevo con:
 *  - recognition: 2-3 distractores del mismo nivel, mezclados, y título nuevo;
 *  - word-meaning y sign-choice: la respuesta repartida por todas las posiciones.
 * No toca matching ni true-false (se validan en las pruebas).
 */
export function applyDistractors(doc, { toSignKey, clips, clubDictionary }) {
  const singleClips = clubDictionary.usableSignClips(clips);
  const singleKeys = new Set(singleClips.map((clip) => clip.key));
  const clipsByKey = new Map(singleClips.map((clip) => [clip.key, clip]));
  const labels = clubDictionary.collectLabels(doc.levels, toSignKey);
  const context = { singleKeys, labels, clubDictionary, clipsByKey };

  const totals = { 'word-meaning': 0, 'sign-choice': 0 };
  doc.levels.forEach((level) => level.exercises.forEach((exercise) => {
    if (exercise.type in totals) totals[exercise.type] += 1;
  }));
  const positions = {
    'word-meaning': balancedPositions(totals['word-meaning'], 3, 'posiciones:word-meaning'),
    'sign-choice': balancedPositions(totals['sign-choice'], 3, 'posiciones:sign-choice'),
  };
  const used = { 'word-meaning': 0, 'sign-choice': 0 };

  const levels = doc.levels.map((level) => ({
    ...level,
    exercises: level.exercises.map((exercise, index) => {
      const rng = rngFor(`${exercise.type}:${level.id}:${index}`);
      if (exercise.type === 'recognition') return withDistractors(level, index, exercise, context);
      if (exercise.type === 'word-meaning' || exercise.type === 'sign-choice') {
        const field = exercise.type === 'word-meaning' ? 'options' : 'signs';
        const list = exercise[field];
        const position = positions[exercise.type][used[exercise.type]++] % list.length;
        return { ...exercise, [field]: placeCorrect(list, exercise.correct, position, rng) };
      }
      return exercise;
    }),
  }));
  return { ...doc, levels };
}

/** Mismo formato que el archivo del repo: 2 espacios, LF y sin salto final. */
export const serializeLevels = (doc) => JSON.stringify(doc, null, 2);

/** Pasa CRLF a LF para comparar sin depender de cómo git hizo el checkout. */
export const normalizeLineEndings = (text) => text.replace(/\r\n/g, '\n');
