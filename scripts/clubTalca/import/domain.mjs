// Carga las reglas del dominio de la app (JS puro con sintaxis ESM) para que el
// importador valide con exactamente las mismas reglas, sin copiarlas. Node no
// resuelve los imports sin extensión de `src/`, así que cada módulo se importa
// como data: URL y, en ExerciseFactory, su único import relativo se reemplaza
// por la URL de exerciseTypes.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const toDataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const read = (relativePath) => readFileSync(join(ROOT, relativePath), 'utf8');

export async function loadDomain() {
  const signMedia = await import(toDataUrl(read('src/features/signs/domain/signMedia.js')));
  const typesSource = read('src/features/levels/domain/exerciseTypes.js');
  const exerciseTypes = await import(toDataUrl(typesSource));
  const factorySource = read('src/features/levels/domain/ExerciseFactory.js').replace(
    /from '\.\/exerciseTypes';/,
    `from '${toDataUrl(typesSource)}';`,
  );
  const { ExerciseFactory } = await import(toDataUrl(factorySource));
  // Sin imports propios: se cargan tal cual (ver el encabezado de cada archivo).
  const clubDictionary = await import(toDataUrl(read('src/features/signs/domain/clubDictionary.js')));
  return { signMedia, exerciseTypes, ExerciseFactory, clubDictionary };
}

export function readClipsSeed() {
  return JSON.parse(read('src/features/signs/data/content/clubTalcaClips.json'));
}

/** Pistas observadas (las genera otra herramienta); null si todavía no existe el archivo. */
export function readHintsSeed() {
  const file = join(ROOT, 'src/features/signs/data/content/clubTalcaHints.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

export function readLevelsSeed() {
  return JSON.parse(read('src/features/levels/data/content/clubTalcaLevels.json'));
}
