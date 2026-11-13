import clubTalcaLevels from '../../../levels/data/content/clubTalcaLevels.json';
import clubTalcaClips from '../../data/content/clubTalcaClips.json';
import hintsFile from '../../data/content/clubTalcaHints.json';
import { collectLabels } from '../clubDictionary';
import { createObservedHints, fullSentence } from '../observedHints';
import { toSignKey } from '../signMedia';

// Pruebas sobre el archivo REAL de pistas observadas (lo genera otra
// herramienta y aquí no se edita). Si se regenera, estas pruebas lo validan.

const entries = Object.entries(hintsFile.pistas);
const { clips } = clubTalcaClips;
const glossOf = new Map(clips.map((clip) => [clip.key, clip.gloss]));
const labels = collectLabels(clubTalcaLevels.levels, toSignKey);

const plain = (text) =>
  String(text ?? '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/ñ/g, 'ñ')
    .replace(/[̀-ͯ]/g, '');
const wordsOf = (text) => plain(text).split(/[^a-z0-9ñ]+/).filter(Boolean);
// Palabras de relleno que aparecen en cualquier frase de pista («cerca DE LA mejilla»).
const STOP = new Set(['a', 'al', 'de', 'del', 'el', 'la', 'las', 'los', 'y', 'en', 'con', 'un', 'una', 'se', 'mi', 'es', 'o']);

describe('clubTalcaHints.json (archivo real)', () => {
  test('317 entradas, una por cada clave de seña del club, y ninguna se descarta al cargar', () => {
    expect(entries).toHaveLength(317);
    const signKeys = new Set(clips.filter((clip) => clip.kind === 'sign').map((clip) => clip.key));
    expect(new Set(Object.keys(hintsFile.pistas))).toEqual(signKeys);
    expect(createObservedHints(hintsFile).size).toBe(317);
  });

  test('las claves están en la forma canónica de toSignKey (minúsculas, sin tildes, NFC)', () => {
    const odd = entries.map(([key]) => key).filter((key) => key !== key.normalize('NFC') || toSignKey(key) !== key);
    expect(odd).toEqual([]);
  });

  test('cada texto es una frase bien formada y coherente con manos, ubicación y movimiento', () => {
    const problems = [];
    entries.forEach(([key, hint]) => {
      const { texto, manos, ubicacion, movimiento } = hint;
      const shape = /^Se hace con (una mano|dos manos|las dos manos), [a-záéíóúñ ]+, [a-záéíóúñ ]+\.$/;
      if (!shape.test(texto)) problems.push(`${key}: forma «${texto}»`);
      if (/\s{2}|\s[,.]|[,.]{2}/.test(texto)) problems.push(`${key}: puntuación «${texto}»`);
      if (manos === 1 ? !texto.includes('una mano') : !texto.includes('dos manos')) problems.push(`${key}: manos=${manos}`);
      if (![1, 2].includes(manos)) problems.push(`${key}: manos inválido ${manos}`);
      if (!texto.includes(`, ${ubicacion},`)) problems.push(`${key}: ubicación «${ubicacion}» no está en el texto`);
      if (!texto.endsWith(`${movimiento}.`)) problems.push(`${key}: movimiento «${movimiento}» no cierra el texto`);
    });
    expect(problems).toEqual([]);
  });

  test('ningún texto, ubicación ni movimiento contiene la palabra de su seña (clave, glosa o etiqueta del nivel)', () => {
    const leaks = [];
    entries.forEach(([key, hint]) => {
      const said = new Set([hint.texto, hint.ubicacion, hint.movimiento].flatMap(wordsOf));
      const names = [key.replace(/-/g, ' '), glossOf.get(key), labels.get(key)].flatMap(wordsOf).filter((word) => !STOP.has(word));
      names.filter((word) => said.has(word)).forEach((word) => leaks.push(`${key}: «${word}» en «${hint.texto}»`));
    });
    expect(leaks).toEqual([]);
  });

  test('fullSentence devuelve el texto del archivo tal cual', () => {
    const observed = createObservedHints(hintsFile);
    entries.forEach(([key, hint]) => expect(fullSentence(observed.forSign(key))).toBe(hint.texto));
  });
});

describe('forSign: claves con mayúsculas, ñ y espacios', () => {
  const observed = createObservedHints(hintsFile);

  test.each([['MAÑANA'], [' Mañana '], ['VIÑA-DEL-MAR'], ['Lengua-De-Señas'], [10]])('%p encuentra su pista', (key) => {
    expect(observed.forSign(key)).not.toBeNull();
  });

  test('una clave con tildes (glosa sin pasar por toSignKey) no inventa una pista ajena', () => {
    // Las claves canónicas no llevan tildes; con tilde no hay coincidencia, y nunca otra seña.
    expect(observed.forSign('Clínica')).toBeNull();
    expect(observed.forSign(toSignKey('Clínica'))).toBe(observed.forSign('clinica'));
    expect(observed.forSign(toSignKey('MAÑANA'))).toBe(observed.forSign('mañana'));
  });

  test('entradas vacías o raras no rompen', () => {
    [undefined, null, '', '   ', {}, []].forEach((key) => expect(observed.forSign(key)).toBeNull());
  });
});
