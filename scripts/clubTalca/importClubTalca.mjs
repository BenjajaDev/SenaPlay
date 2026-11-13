// Importa el contenido del Club de Sordos de Talca a Supabase con la sesión de
// una persona del equipo (staff). NUNCA usa la service key: todo pasa por RLS,
// así que el guardián `guard_sign_clip` y las políticas de Storage siguen
// protegiendo los datos. Diseño en docs/11-contenido-club-talca.md.
//
// Uso (Windows, desde la raíz del repo):
//   node scripts/clubTalca/importClubTalca.mjs --dir <carpeta con manifest.json> --consent-ref "<código del permiso>" [--signer-alias "..."] [--dry-run] [--only clips|levels|dictionary] [--sobrescribir] [--detalle]
//
//   --only levels --sobrescribir   actualiza los niveles que ya existen con la semilla (conserva available y sort_order)
//   --only dictionary              inserta/actualiza las señas del club en `signs` (sin tocar las filas MINEDUC)
//   --dry-run                      en esos dos modos inicia sesión solo para LEER y muestra qué cambiaría; no escribe
//
// --dir y --consent-ref solo se piden para los clips.
// --consent-ref se guarda en una tabla que lee el staff: usa un código opaco
// (p. ej. «CLUB-TALCA-2026-01») que apunte al documento guardado aparte, nunca
// nombres, RUT ni el folio personal de alguien.
//
// Entorno (o .env en la raíz): EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY,
// SENAPLAY_STAFF_EMAIL. La contraseña se pide por la terminal, sin eco: nunca
// va por argumento ni se imprime.

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadDomain, readClipsSeed, readHintsSeed, readLevelsSeed } from './import/domain.mjs';
import { readDotEnv } from './import/env.mjs';
import { importClips } from './import/importClips.mjs';
import { importDictionary } from './import/importDictionary.mjs';
import { importLevels } from './import/importLevels.mjs';
import { promptHidden } from './import/prompt.mjs';

const DEFAULT_SIGNER_ALIAS = 'Club de Sordos de Talca';

const fail = (message) => {
  console.error(`Error: ${message}`);
  process.exit(1);
};

// ── Principal ────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string' },
      'consent-ref': { type: 'string' },
      'signer-alias': { type: 'string', default: DEFAULT_SIGNER_ALIAS },
      'dry-run': { type: 'boolean', default: false },
      only: { type: 'string' },
      sobrescribir: { type: 'boolean', default: false },
      detalle: { type: 'boolean', default: false },
    },
  });
  const options = {
    dryRun: values['dry-run'],
    consentRef: (values['consent-ref'] ?? '').trim(),
    signerAlias: (values['signer-alias'] ?? '').trim() || DEFAULT_SIGNER_ALIAS,
    only: values.only,
    overwrite: values.sobrescribir,
    detail: values.detalle,
  };
  if (options.only && !['clips', 'levels', 'dictionary'].includes(options.only)) fail('--only acepta "clips", "levels" o "dictionary".');
  // Sin --only se importan clips y niveles; el diccionario es opt-in (necesita la migración de `source`).
  const doClips = !options.only || options.only === 'clips';
  const doLevels = !options.only || options.only === 'levels';
  const doDictionary = options.only === 'dictionary';
  if (options.overwrite && !doLevels) fail('--sobrescribir solo aplica a los niveles (--only levels).');
  if (doClips && !options.consentRef) fail('Falta --consent-ref "<referencia del permiso>": los videos muestran la cara de una persona.');

  let dir = null;
  let manifest = null;
  if (doClips) {
    if (!values.dir) fail('Falta --dir <carpeta con manifest.json>.');
    dir = resolve(values.dir);
    const manifestFile = join(dir, 'manifest.json');
    if (!existsSync(manifestFile)) fail(`No existe ${manifestFile}.`);
    manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
    if (!Array.isArray(manifest.clips)) fail('manifest.json no tiene la lista "clips".');
  }

  const domain = await loadDomain();
  const levelsDoc = readLevelsSeed();

  // La simulación de clips no consulta la base; la de sobrescribir niveles y la del
  // diccionario sí (solo lectura) para poder decir qué cambiaría.
  const needsSession = !options.dryRun || doDictionary || (doLevels && options.overwrite);
  let supabase = null;
  if (needsSession) {
    const env = { ...readDotEnv(), ...process.env };
    const url = env.EXPO_PUBLIC_SUPABASE_URL;
    const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const email = env.SENAPLAY_STAFF_EMAIL;
    if (!url || !anonKey) fail('Faltan EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY (entorno o .env).');
    if (!email) fail('Falta SENAPLAY_STAFF_EMAIL (el correo de una cuenta del equipo).');
    const password = await promptHidden(`Contraseña de ${email}: `);
    supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) fail('No se pudo iniciar sesión. Revisa el correo y la contraseña.');
  }

  const stats = {
    clips: { inReview: 0, drafts: 0, skipped: 0, excluded: 0, failed: 0, wouldImport: 0 },
    levels: { saved: 0, updated: 0, unchanged: 0, skipped: 0, failed: 0, wouldSave: 0, wouldUpdate: 0 },
    dictionary: { inserted: 0, updated: 0, unchanged: 0, skipped: 0, failed: 0, wouldInsert: 0, wouldUpdate: 0 },
    errors: [],
  };

  try {
    if (doClips) await importClips({ supabase, dir, manifest, options, domain, stats });
    if (doLevels) await importLevels({ supabase, options, levelsDoc, domain, stats });
    if (doDictionary) {
      await importDictionary({ supabase, options, domain, clips: readClipsSeed().clips, levelsDoc, hints: readHintsSeed(), stats });
    }
  } finally {
    if (supabase) await supabase.auth.signOut();
  }

  console.log(options.dryRun ? '\nResumen (simulación, no se escribió nada):' : '\nResumen:');
  if (doClips) {
    const c = stats.clips;
    console.log(
      options.dryRun
        ? `  Clips: ${c.wouldImport} por importar (sin consultar la base), ${c.excluded} excluidos, ${c.failed} con error`
        : `  Clips: ${c.inReview} en revisión, ${c.drafts} borradores (alfabeto), ${c.skipped} ya existían, ${c.excluded} excluidos, ${c.failed} con error`,
    );
  }
  if (doLevels) {
    const l = stats.levels;
    if (options.dryRun && !supabase) {
      console.log(`  Niveles: ${l.wouldSave} válidos, ${l.failed} con error`);
    } else if (options.dryRun) {
      console.log(`  Niveles: ${l.wouldSave} por crear, ${l.wouldUpdate} por actualizar, ${l.unchanged} sin cambios, ${l.skipped} se saltan, ${l.failed} con error`);
    } else {
      console.log(
        `  Niveles: ${l.saved} guardados (no disponibles), ${l.updated} actualizados, ${l.unchanged} sin cambios, ${l.skipped} ya existían, ${l.failed} con error`,
      );
    }
  }
  if (doDictionary) {
    const d = stats.dictionary;
    console.log(
      options.dryRun
        ? `  Diccionario: ${d.wouldInsert} por agregar, ${d.wouldUpdate} por actualizar, ${d.unchanged} sin cambios, ${d.skipped} saltadas (ya existen como MINEDUC), ${d.failed} con error`
        : `  Diccionario: ${d.inserted} agregadas, ${d.updated} actualizadas, ${d.unchanged} sin cambios, ${d.skipped} saltadas (ya existen como MINEDUC), ${d.failed} con error`,
    );
  }
  stats.errors.forEach((message) => console.error(`  - ${message}`));
  if (stats.errors.length) process.exitCode = 1;
}

main().catch((error) => fail(error.message));
