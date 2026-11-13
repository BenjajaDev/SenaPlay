// Regenera los distractores y el orden de las respuestas de los niveles del
// Club de Sordos de Talca (src/features/levels/data/content/clubTalcaLevels.json).
// Es determinista e idempotente: el mismo JSON de entrada da siempre la misma
// salida, así que se puede correr cuantas veces haga falta.
//
// Uso (Windows, desde la raíz del repo):
//   node scripts\clubTalca\generarDistractores.mjs            reescribe el JSON
//   node scripts\clubTalca\generarDistractores.mjs --check    no escribe; sale con error si el JSON no está al día
//
// Después, para llevar los cambios a Supabase:
//   node scripts\clubTalca\importClubTalca.mjs --only levels --sobrescribir --dry-run
// Diseño en docs/11-contenido-club-talca.md.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { applyDistractors, serializeLevels } from './import/distractors.mjs';
import { loadDomain, readClipsSeed, readLevelsSeed, ROOT } from './import/domain.mjs';

const LEVELS_FILE = join(ROOT, 'src/features/levels/data/content/clubTalcaLevels.json');

async function main() {
  const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });
  const domain = await loadDomain();
  const doc = readLevelsSeed();
  const next = applyDistractors(doc, {
    toSignKey: domain.signMedia.toSignKey,
    clips: readClipsSeed().clips,
    clubDictionary: domain.clubDictionary,
  });

  const invalid = [];
  next.levels.forEach((level) =>
    level.exercises.forEach((exercise, index) => {
      const { valid, error } = domain.ExerciseFactory.validate(exercise);
      if (!valid) invalid.push(`nivel ${level.id} #${index + 1}: ${error}`);
    }),
  );
  if (invalid.length) {
    invalid.forEach((message) => console.error(`  - ${message}`));
    throw new Error('El resultado no pasa ExerciseFactory.validate; no se escribió nada.');
  }

  const text = serializeLevels(next);
  const current = readFileSync(LEVELS_FILE, 'utf8');
  if (text === current) {
    console.log('Los niveles ya están al día.');
    return;
  }
  if (values.check) {
    console.error('El JSON de niveles no está al día: corre node scripts\\clubTalca\\generarDistractores.mjs');
    process.exitCode = 1;
    return;
  }
  writeFileSync(LEVELS_FILE, text, 'utf8');
  console.log(`Niveles regenerados (${next.levels.length}).`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
