import clubTalcaClips from '../../../signs/data/content/clubTalcaClips.json';
import { OBSERVED_HINTS } from '../../../signs/data/local/clubHintsData';
import { collectLabels } from '../../../signs/domain/clubDictionary';
import { OBSERVED_NOTE } from '../../../signs/domain/observedHints';
import { normalizeHint } from '../../../signs/domain/signDescription';
import { toSignKey } from '../../../signs/domain/signMedia';
import clubTalcaLevels from '../../data/content/clubTalcaLevels.json';
import { hintSignKeys, resolveHint } from '../exerciseHint';

// Todas las pistas que puede pedir una persona en los niveles del club, con el
// archivo REAL de pistas observadas: ninguna debe nombrar la respuesta.

const { levels } = clubTalcaLevels;
const glossOf = new Map(clubTalcaClips.clips.map((clip) => [clip.key, clip.gloss]));
const labels = collectLabels(levels, toSignKey);

const plain = (text) =>
  String(text ?? '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/ñ/g, 'ñ')
    .replace(/[̀-ͯ]/g, '');
const wordsOf = (text) => plain(text).split(/[^a-z0-9ñ]+/).filter(Boolean);
const STOP = new Set(['a', 'al', 'de', 'del', 'el', 'la', 'las', 'los', 'y', 'en', 'con', 'un', 'una', 'se', 'mi', 'es', 'o', 'que', 'no']);

const shownKeys = (exercise) =>
  [exercise.sign, ...(exercise.signs || []), ...(exercise.type === 'matching' ? exercise.letters : [])].filter(Boolean);
const namesOfKey = (key) => [key.replace(/-/g, ' '), glossOf.get(key), labels.get(key)];

/** Palabras que, si aparecen en la pista, delatan la respuesta del ejercicio. */
function answerWords(exercise) {
  const statementWord = /significa (.+)$/.exec(exercise.statement || '')?.[1];
  const texts = [
    ...[].concat(exercise.correct ?? []).filter((value) => typeof value === 'string'),
    ...(exercise.labels || []),
    statementWord,
    ...shownKeys(exercise).flatMap(namesOfKey),
    ...(exercise.type === 'sign-choice' ? namesOfKey(exercise.correct) : []),
  ];
  return new Set(texts.flatMap(wordsOf).filter((word) => !STOP.has(word)));
}

/** Palabras que ve la persona en el popover (título, texto y parámetros; la nota es fija). */
// «Seña 2:» es la posición en la tira, no un número que se pregunte.
const withoutPositions = (text) => String(text ?? '').replace(/^Seña \d+: /gm, '');
const hintWords = (hint) =>
  new Set([hint.title, withoutPositions(hint.texto), ...(hint.parametros || []).map((param) => param.valor)].flatMap(wordsOf));

/** Todas las pistas de la ampolleta en un ejercicio: al empezar y tras cada emparejamiento. */
function requestsOf(exercise) {
  const requests = [{ label: 'botón', options: {} }];
  if (exercise.type === 'matching') {
    exercise.letters.forEach((_, index) => {
      const matched = exercise.letters.slice(0, index + 1).flatMap((__, done) => [`s-${done}`, `l-${done}`]);
      requests.push({ label: `botón con ${index + 1} parejas`, options: { matched } });
    });
  }
  return requests;
}

const cases = levels.flatMap((level) =>
  level.exercises.map((exercise, index) => [`nivel ${level.id} #${index + 1} (${exercise.type})`, exercise]),
);

describe('pistas de los niveles del club con el archivo real', () => {
  test.each(cases)('%s: ninguna pista nombra la respuesta', (_name, exercise) => {
    const forbidden = answerWords(exercise);
    const leaks = [];
    requestsOf(exercise).forEach(({ label, options }) => {
      const hint = resolveHint(exercise, options);
      if (!hint) return;
      expect(hint.title).toBe('Pista');
      const said = hintWords(hint);
      [...forbidden].filter((word) => said.has(word)).forEach((word) => leaks.push(`${label}: «${word}» en «${hint.texto}»`));
    });
    expect(leaks).toEqual([]);
  });

  test('una seña sola con pista observada usa esa pista, con la nota', () => {
    const singles = levels.flatMap((level) =>
      level.exercises.filter(
        (exercise) =>
          ['word-meaning', 'true-false', 'recognition'].includes(exercise.type) &&
          shownKeys(exercise).length === 1 &&
          OBSERVED_HINTS.forSign(shownKeys(exercise)[0]),
      ),
    );
    expect(singles.length).toBeGreaterThan(0);
    singles.forEach((exercise) => {
      const seen = OBSERVED_HINTS.forSign(shownKeys(exercise)[0]);
      const hint = resolveHint(exercise);
      expect(hint.nota).toBe(OBSERVED_NOTE);
      // «trabajar» suma además la configuración del diccionario local.
      expect(hint.parametros.map((param) => param.valor)).toEqual(expect.arrayContaining([seen.ubicacion, seen.movimiento]));
      expect(hint.texto).toMatch(/^Se hace con (una|dos) manos?\.$/);
    });
  });

  test('sin ninguna pista observada (frases) cae a la pista general del ejercicio', () => {
    const phrases = levels.flatMap((level) =>
      level.exercises.filter(
        (exercise) =>
          ['word-meaning', 'true-false', 'recognition'].includes(exercise.type) &&
          shownKeys(exercise).length > 0 &&
          shownKeys(exercise).every((key) => !OBSERVED_HINTS.forSign(key)),
      ),
    );
    phrases.forEach((exercise) => {
      const general = normalizeHint(exercise.hint, exercise.sign);
      const hint = resolveHint(exercise);
      if (general) expect(hint).toEqual({ ...general, title: 'Pista' });
      else expect(hint).toBeNull();
    });
  });

  test('emparejar con todo emparejado: no quedan señas y no se habla de «las que faltan»', () => {
    const matchings = levels.flatMap((level) => level.exercises.filter((exercise) => exercise.type === 'matching'));
    expect(matchings.length).toBeGreaterThan(0);
    matchings.forEach((exercise) => {
      const all = exercise.letters.flatMap((_, index) => [`s-${index}`, `l-${index}`]);
      expect(hintSignKeys(exercise, all)).toEqual([]);
      const hint = resolveHint(exercise, { matched: all });
      const general = normalizeHint(exercise.hint, exercise.sign);
      expect(hint).toEqual(general ? { ...general, title: 'Pista' } : null);
    });
  });

  test('emparejar con respuesta nula (antes de tocar nada) pide la primera seña', () => {
    const exercise = levels.flatMap((level) => level.exercises).find((item) => item.type === 'matching');
    expect(hintSignKeys(exercise, null)).toEqual([exercise.letters[0]]);
    expect(resolveHint(exercise, { matched: null }).texto).toMatch(/^Una de las señas que faltan\. Se hace con (una|dos) manos?\.$/);
  });
});
