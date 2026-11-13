import { readFileSync } from 'fs';
import { join } from 'path';
import clubTalcaLevels from '../../../levels/data/content/clubTalcaLevels.json';
import clubTalcaClips from '../../data/content/clubTalcaClips.json';
import hintsFile from '../../data/content/clubTalcaHints.json';
import * as clubDictionary from '../clubDictionary';
import { toSignKey } from '../signMedia';

// Pruebas de los scripts de scripts/clubTalca sin conectarse a Supabase.
// Jest no transforma .mjs; estos dos módulos no importan nada, así que se
// cargan quitando `export` (la primera prueba vigila que siga siendo así).

const ROOT = join(__dirname, '..', '..', '..', '..', '..');
function loadScript(relativePath, names) {
  const source = readFileSync(join(ROOT, relativePath), 'utf8');
  expect(source).not.toMatch(/^import\s/m);
  // eslint-disable-next-line no-new-func
  return new Function(`${source.replace(/^export (?=(async )?function |const )/gm, '')}\nreturn { ${names.join(', ')} };`)();
}

const { importDictionary } = loadScript('scripts/clubTalca/import/importDictionary.mjs', ['importDictionary']);
const { applyDistractors, serializeLevels } = loadScript('scripts/clubTalca/import/distractors.mjs', ['applyDistractors', 'serializeLevels']);

const { clips } = clubTalcaClips;
const domain = { clubDictionary, signMedia: { toSignKey } };
const seedRows = clubDictionary.buildClubSigns({ clips, levels: clubTalcaLevels.levels, hints: hintsFile, toSignKey });
const { CLUB_SOURCE, normalizeWord } = clubDictionary;

/** Supabase falso: lee `existing` por páginas y anota cada escritura. */
function fakeSupabase(existing) {
  const writes = { insert: [], update: [] };
  const table = {
    select: () => ({
      order: () => ({ range: async (from, to) => ({ data: existing.slice(from, to + 1), error: null }) }),
    }),
    insert: async (batch) => {
      writes.insert.push(...batch);
      return { error: null };
    },
    update: (row) => {
      const call = { row, filters: [] };
      writes.update.push(call);
      const chain = {
        eq: (column, value) => {
          call.filters.push([column, value]);
          return chain;
        },
        then: (resolve) => resolve({ error: null }),
      };
      return chain;
    },
  };
  return { writes, from: () => table };
}

const newStats = () => ({
  dictionary: { inserted: 0, updated: 0, unchanged: 0, skipped: 0, failed: 0, wouldInsert: 0, wouldUpdate: 0 },
  errors: [],
});

async function run(existing, { dryRun = false, clipsList = clips, hints = hintsFile } = {}) {
  const supabase = fakeSupabase(existing);
  const stats = newStats();
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await importDictionary({ supabase, options: { dryRun, detail: false }, domain, clips: clipsList, levelsDoc: clubTalcaLevels, hints, stats });
  } finally {
    log.mockRestore();
  }
  return { writes: supabase.writes, stats };
}

const mineducRow = (id, word) => ({ id, word, type: 'Sustantivo', meaning: 'x', how_to: 'y', theme: 'Animales', page: 21, source: null });
const clubRow = (id, row) => ({ id, ...row });

describe('importDictionary (Supabase falso)', () => {
  test('--dry-run solo lee: no inserta ni actualiza y cuenta lo que haría', async () => {
    const hola = seedRows.find((row) => row.word === 'Hola');
    const existing = [mineducRow(1, 'ABEJA'), clubRow(2, { ...hola, how_to: 'viejo' })];
    const { writes, stats } = await run(existing, { dryRun: true });
    expect(writes.insert).toEqual([]);
    expect(writes.update).toEqual([]);
    expect(stats.dictionary.inserted + stats.dictionary.updated).toBe(0);
    expect(stats.dictionary.wouldUpdate).toBe(1);
    expect(stats.dictionary.skipped).toBe(1);
    expect(stats.dictionary.wouldInsert).toBe(seedRows.length - 2);
  });

  test('no duplica palabras MINEDUC: compara sin mayúsculas ni tildes y nunca toca esas filas', async () => {
    // «HOLA» y «Clinica» (sin tilde) ya existen como MINEDUC; la del club se salta.
    const existing = [mineducRow(1, 'HOLA'), mineducRow(2, '  clinica '), mineducRow(3, 'ABEJA')];
    const { writes, stats } = await run(existing);
    const inserted = writes.insert.map((row) => normalizeWord(row.word));
    ['hola', 'clinica', 'abeja'].forEach((word) => expect(inserted).not.toContain(word));
    expect(writes.update).toEqual([]);
    expect(stats.dictionary.skipped).toBe(3);
    expect(new Set(inserted).size).toBe(inserted.length);
    expect(writes.insert).toHaveLength(seedRows.length - 3);
  });

  test('la ñ no se confunde con la n («Año» no choca con «Ano»)', () => {
    expect(normalizeWord('AÑO')).not.toBe(normalizeWord('Ano'));
    expect(normalizeWord(' Mañana  de\tNOCHE ')).toBe('mañana de noche');
    expect(normalizeWord('Clínica')).toBe(normalizeWord('CLINICA'));
  });

  test('una ñ descompuesta (NFD, p. ej. pegada desde otro sistema) también se conserva', () => {
    // Si no, «MAÑANA» en NFD queda «manana» y no choca con «Mañana»: se insertaría duplicada.
    const nfd = (text) => text.normalize('NFD');
    expect(normalizeWord(nfd('MAÑANA'))).toBe(normalizeWord('Mañana'));
    expect(normalizeWord(nfd('AÑO'))).not.toBe(normalizeWord('Ano'));
  });

  test('una fila del club se actualiza por id y solo si su source es el del club; sin cambios no se escribe', async () => {
    const gracias = seedRows.find((row) => row.word === 'Gracias');
    const hola = seedRows.find((row) => row.word === 'Hola');
    const existing = [clubRow(7, { ...gracias, theme: 'Viejo' }), clubRow(8, hola)];
    const { writes, stats } = await run(existing);
    expect(writes.update).toHaveLength(1);
    expect(writes.update[0].row).toEqual(gracias);
    expect(writes.update[0].filters).toEqual([
      ['id', 7],
      ['source', CLUB_SOURCE],
    ]);
    expect(stats.dictionary.unchanged).toBe(1);
    expect(writes.insert.map((row) => row.word)).not.toContain('Hola');
  });

  test('lee todas las páginas: una palabra MINEDUC después de la fila 500 también se respeta', async () => {
    const filler = Array.from({ length: 520 }, (_, index) => mineducRow(index + 1, `relleno ${index}`));
    filler.push(mineducRow(999, 'GRACIAS'));
    const { writes, stats } = await run(filler);
    expect(writes.insert.map((row) => row.word)).not.toContain('Gracias');
    expect(stats.dictionary.skipped).toBe(1);
  });

  test('how_to sale del texto de la pista observada de cada seña', async () => {
    const { writes } = await run([]);
    expect(writes.insert).toHaveLength(seedRows.length);
    writes.insert.forEach((row) => {
      expect(row.source).toBe(CLUB_SOURCE);
      expect(row.how_to).toBe(hintsFile.pistas[toSignKey(row.word)].texto);
    });
  });

  test('entradas inválidas: sin tema o palabra repetida al normalizar se rechazan con error y no se insertan', async () => {
    const bad = [
      { key: 'zz-uno', variant: 1, gloss: 'ÁRBOL ROJO', kind: 'sign', topic: 'Los_Colores' },
      { key: 'zz-dos', variant: 1, gloss: 'ARBOL ROJO', kind: 'sign', topic: 'Los_Colores' },
      { key: 'zz-tres', variant: 1, gloss: 'SIN TEMA', kind: 'sign', topic: 'Carpeta_Desconocida' },
      { key: 'zz-cuatro', variant: 1, gloss: 'UNA FRASE', kind: 'phrase', topic: 'Los_Colores' },
    ];
    const { writes, stats } = await run([], { clipsList: bad, hints: null });
    expect(writes.insert.map((row) => row.word)).toEqual(['Árbol rojo']);
    expect(stats.dictionary.failed).toBe(2);
    expect(stats.errors.join('\n')).toMatch(/repite «Árbol rojo»/);
    expect(stats.errors.join('\n')).toMatch(/sin tema/);
    expect(writes.insert[0].how_to).toBeNull();
  });
});

describe('generador de distractores', () => {
  const generate = (doc) => applyDistractors(doc, { toSignKey, clips, clubDictionary });

  test('es idempotente y el JSON del repo ya está al día (lo mismo que --check)', () => {
    const once = generate(clubTalcaLevels);
    expect(once).toEqual(clubTalcaLevels);
    expect(generate(once)).toEqual(once);
    const file = readFileSync(join(ROOT, 'src/features/levels/data/content/clubTalcaLevels.json'), 'utf8');
    expect(serializeLevels(once)).toBe(file);
  });

  test('recognition: distractores sin repetir aunque cambien tildes o mayúsculas, y nunca una respuesta', () => {
    clubTalcaLevels.levels.forEach((level) =>
      level.exercises
        .filter((exercise) => exercise.type === 'recognition')
        .forEach((exercise) => {
          const normalized = exercise.options.map(normalizeWord);
          expect(new Set(normalized).size).toBe(normalized.length);
          const answers = new Set(exercise.correct.map(normalizeWord));
          const distractors = exercise.options.filter((option) => !exercise.correct.includes(option));
          distractors.forEach((word) => expect(answers.has(normalizeWord(word))).toBe(false));
          expect(distractors.length).toBe(exercise.correct.length <= 2 ? 3 : 2);
        }),
    );
  });

  test('falla con un error claro si un nivel no tiene palabras suficientes para 2 distractores', () => {
    const level = clubTalcaLevels.levels.find((item) => item.exercises.some((exercise) => exercise.type === 'recognition'));
    const recognition = level.exercises.find((exercise) => exercise.type === 'recognition');
    const tiny = { ...clubTalcaLevels, levels: [{ ...level, exercises: [recognition] }] };
    const shown = recognition.signs.length;
    // Solo quedan las señas mostradas: no hay candidatos que no sean respuesta.
    expect(shown).toBeGreaterThan(0);
    expect(() => generate(tiny)).toThrow(/no hay 2 palabras del mismo tema/);
  });
});
