// Señas del Club de Sordos de Talca como filas de la tabla `signs` del
// diccionario, y etiquetas legibles de cada seña. Diseño en
// docs/11-contenido-club-talca.md.
//
// JS puro y SIN imports: lo cargan tanto Jest como los scripts de
// scripts/clubTalca (que importan los módulos como data: URL). Por eso la
// función `toSignKey` llega por parámetro en vez de importarse.

export const CLUB_SOURCE = 'Club de Sordos de Talca';
export const CLUB_SIGN_TYPE = 'Seña';

// Clips de más de 10 s que no se suben (por clave y variante). Debe coincidir
// con el conversor; una prueba compara contra el manifiesto de duraciones.
export const CLUB_EXCLUDED_VARIANTS = Object.freeze([
  ['conversar', 1],
  ['19', 1],
  ['nosotros', 1],
  ['datos-personales', 1],
  ['avion', 1],
  ['furgon', 1],
  ['puerto-montt', 1],
  ['t', 1],
]);

export const isClubExcluded = (clip) =>
  CLUB_EXCLUDED_VARIANTS.some(([key, variant]) => key === clip.key && variant === clip.variant);

/** Carpeta de origen del club → nombre del tema que ve la persona. */
export const TOPIC_THEMES = Object.freeze({
  Saludos_y_Presentaciones: 'Saludos',
  Primeras_Senas: 'Primeras señas',
  Numeros_1_al_10: 'Números',
  Numeros_11_al_19: 'Números',
  Numeros_20_al_99: 'Números',
  Los_Colores: 'Colores',
  Los_Animales: 'Animales',
  Los_Alimentos: 'Alimentos',
  Los_Verbos: 'Verbos',
  Dias_de_la_Semana: 'Días de la semana',
  El_Tiempo: 'Tiempo',
  Los_Pronombres: 'Pronombres',
  Estado_Civil: 'Estado civil',
  Datos_Personales: 'Datos personales',
  Caracteristicas_y_Sentimientos: 'Características y sentimientos',
  Lugares: 'Lugares',
  Medios_de_Transporte: 'Transporte',
  Ciudades_de_Chile: 'Ciudades',
});

// Glosas mal escritas en el origen (sin tilde) que ningún nivel corrige.
const GLOSS_FIXES = Object.freeze({ 'buenos-dias': 'Buenos días', clinica: 'Clínica' });

const CITY_TOPIC = 'Ciudades_de_Chile';
const LOWER_WORDS = new Set(['de', 'del', 'y']);

const capitalize = (text) => text.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase('es'));

/**
 * «BUENOS DÍAS» → «Buenos días»; «CABALLO / YEGUA» → «Caballo / Yegua»;
 * «¿CÓMO ESTÁS?» → «¿Cómo estás?». Con `proper` (ciudades) cada palabra va con
 * mayúscula inicial salvo «de», «del» y «y».
 */
export function formatGloss(gloss, { proper = false } = {}) {
  const lower = String(gloss ?? '').trim().toLocaleLowerCase('es');
  if (proper) {
    return capitalize(
      lower
        .split(/\s+/)
        .map((word) => (LOWER_WORDS.has(word) ? word : capitalize(word)))
        .join(' '),
    );
  }
  return lower
    .split('/')
    .map((part) => capitalize(part.trim()))
    .join(' / ');
}

const isMixedCase = (text) => text !== text.toLocaleUpperCase('es');
const statementWord = (statement) => /significa (.+)$/.exec(statement || '')?.[1] ?? null;

/**
 * Etiqueta legible de cada clave según los niveles (clave → texto). Primero
 * las que dicen explícitamente a qué seña pertenece una palabra (emparejar,
 * una sola seña), y después las que se deducen porque `toSignKey(texto)` es la
 * clave. Los textos en MAYÚSCULAS (la palabra pedida) no sirven de etiqueta.
 */
export function collectLabels(levels, toSignKey) {
  const labels = new Map();
  const set = (key, text) => {
    if (key && typeof text === 'string' && text.trim() && isMixedCase(text) && !labels.has(key)) labels.set(key, text.trim());
  };
  const exercises = levels.flatMap((level) => level.exercises || []);
  exercises.forEach((exercise) => {
    if (exercise.type === 'matching') exercise.letters.forEach((key, index) => set(key, exercise.labels?.[index]));
    if (exercise.type === 'word-meaning' && exercise.signs?.length === 1) set(exercise.signs[0], exercise.correct);
  });
  const texts = (exercise) => {
    if (exercise.type === 'word-meaning') return exercise.options || [];
    if (exercise.type === 'recognition') return exercise.correct || [];
    if (exercise.type === 'true-false') return [statementWord(exercise.statement)].filter(Boolean);
    return [];
  };
  exercises.forEach((exercise) => texts(exercise).forEach((text) => set(toSignKey(text), text)));
  return labels;
}

/** Claves de seña únicas del club con al menos un clip usable (sin letras, frases ni excluidos). */
export function usableSignClips(clips) {
  const byKey = new Map();
  clips
    .filter((clip) => clip.kind === 'sign' && !isClubExcluded(clip))
    .forEach((clip) => {
      if (!byKey.has(clip.key)) byKey.set(clip.key, clip);
    });
  return [...byKey.values()];
}

/** Glosa del clip lista para mostrar, sin mirar los niveles: corrige tildes y respeta los nombres propios. */
export function clipWord(clip) {
  return GLOSS_FIXES[clip.key] ?? formatGloss(clip.gloss, { proper: clip.topic === CITY_TOPIC });
}

/** Palabra que ve la persona para un clip: etiqueta del nivel si existe, si no la glosa formateada. */
export function wordFor(clip, labels, toSignKey) {
  if (GLOSS_FIXES[clip.key]) return GLOSS_FIXES[clip.key];
  const label = labels.get(clip.key);
  const hasAlternatives = clip.gloss.includes('/');
  // El texto debe llevar de vuelta al mismo clip: «Café» (el color) llevaría a «cafe».
  if (label && !hasAlternatives && toSignKey(label) === clip.key) return label;
  return clipWord(clip);
}

/** Temas del club en el orden del curso (Saludos → … → Ciudades), sin repetir. */
export const CLUB_THEME_ORDER = Object.freeze([...new Set(Object.values(TOPIC_THEMES))]);

/**
 * Índice del curso del club: posición de cada clave en el orden en que el club
 * las enseña (así los números quedan 1, 2, 3… y la seña del tema va primero) y
 * su palabra legible. Lo usan el diccionario (orden) y la pista del nombre.
 */
export function buildClubIndex(clips) {
  const positionByKey = new Map();
  const wordByKey = new Map();
  usableSignClips(clips).forEach((clip, position) => {
    positionByKey.set(clip.key, position);
    wordByKey.set(clip.key, clipWord(clip));
  });
  return { positionByKey, wordByKey };
}

/**
 * Filas para `public.signs` (sin id): word, type, meaning, how_to, theme, source, page.
 * `meaning` queda vacío: el club no entregó definiciones y no se inventan.
 * `how_to` es el texto de la pista observada, si existe.
 */
export function buildClubSigns({ clips, levels, hints, toSignKey }) {
  const labels = collectLabels(levels, toSignKey);
  const pistas = hints?.pistas ?? {};
  return usableSignClips(clips).map((clip) => {
    const texto = pistas[clip.key]?.texto;
    return {
      word: wordFor(clip, labels, toSignKey),
      type: CLUB_SIGN_TYPE,
      meaning: null,
      how_to: typeof texto === 'string' && texto.trim() ? texto.trim() : null,
      theme: TOPIC_THEMES[clip.topic] ?? null,
      source: CLUB_SOURCE,
      page: null,
    };
  });
}

/** Clave de comparación de palabras: minúsculas y sin tildes (la ñ se conserva). */
export function normalizeWord(word) {
  return String(word ?? '')
    .normalize('NFC')
    .toLocaleLowerCase('es')
    .replace(/ñ/g, '\u0001')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'ñ')
    .replace(/\s+/g, ' ')
    .trim();
}
