// Valida y publica de una vez los clips del Club de Sordos de Talca que quedaron
// «en revisión» tras importClubTalca.mjs, y activa sus niveles. Usa la sesión de
// una cuenta ADMIN: el guardián `guard_sign_clip` rechaza validar o publicar con
// otro rol, y nunca se usa la service key.
//
// Uso (Windows, desde la raíz del repo):
//   node scripts/clubTalca/publicarClubTalca.mjs --consent-ref "<código del permiso>" [--dry-run] [--only clips|levels]
//
// Solo toca clips con ese --consent-ref y con el alias del Club, y solo los que
// están en `in_review` (el alfabeto entra como `draft` y no lo usa ningún nivel).
// Entorno (o .env en la raíz): EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY,
// SENAPLAY_STAFF_EMAIL. La contraseña se pide por la terminal, sin eco.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { readLevelsSeed, ROOT } from './import/domain.mjs';
import { readDotEnv } from './import/env.mjs';
import { promptHidden } from './import/prompt.mjs';

const SIGNER_ALIAS = 'Club de Sordos de Talca';

const fail = (message) => {
  console.error(`Error: ${message}`);
  process.exit(1);
};

// Claves que trae el contenido del Club (src/features/signs/data/content/clubTalcaClips.json):
// el lote solo publica esas, aunque alguien haya insertado otro clip con el mismo alias.
function clavesDelClub() {
  const { clips } = JSON.parse(readFileSync(join(ROOT, 'src/features/signs/data/content/clubTalcaClips.json'), 'utf8'));
  return [...new Set(clips.filter((clip) => clip.kind === 'sign').map((clip) => clip.key))];
}

async function publicarClips(supabase, consentRef, dryRun) {
  const claves = clavesDelClub();
  const filtro = (query) => query
    .eq('signer_alias', SIGNER_ALIAS)
    .eq('consent_ref', consentRef)
    .eq('validation_status', 'in_review')
    .in('sign_key', claves);

  const { data: pendientes, error } = await filtro(
    supabase.from('sign_clips').select('id, sign_key, variant, created_by, updated_at'),
  );
  if (error) throw new Error(`No se pudieron leer los clips: ${error.message}`);
  if (dryRun) {
    pendientes.forEach((clip) => console.log(`    ${clip.sign_key} v${clip.variant} · subido por ${clip.created_by ?? '?'} · ${clip.updated_at}`));
  }
  if (dryRun || !pendientes.length) return { pendientes: pendientes.length, publicados: 0 };

  // Se publica exactamente la lista que se leyó (no lo que cambie entre la
  // lectura y la escritura). Validar y publicar en la misma fila cumple
  // sign_clips_published_validated; el guardián completa validated_by/validated_at.
  const { data, error: errorUpdate } = await filtro(
    supabase.from('sign_clips').update({ validation_status: 'validated', published: true }),
  ).in('id', pendientes.map((clip) => clip.id)).select('id');
  if (errorUpdate) throw new Error(`No se pudieron publicar los clips: ${errorUpdate.message}`);
  return { pendientes: pendientes.length, publicados: data.length };
}

async function activarNiveles(supabase, ids, dryRun) {
  const { data, error } = await supabase.from('levels').select('id, available').in('id', ids);
  if (error) throw new Error(`No se pudieron leer los niveles: ${error.message}`);
  const faltan = ids.filter((id) => !data.some((row) => row.id === id));
  const inactivos = data.filter((row) => !row.available).map((row) => row.id);
  if (dryRun || !inactivos.length) return { faltan, porActivar: inactivos.length, activados: 0 };

  const { data: activados, error: errorUpdate } = await supabase
    .from('levels')
    .update({ available: true })
    .in('id', inactivos)
    .select('id');
  if (errorUpdate) throw new Error(`No se pudieron activar los niveles: ${errorUpdate.message}`);
  return { faltan, porActivar: inactivos.length, activados: activados.length };
}

async function main() {
  const { values } = parseArgs({
    options: {
      'consent-ref': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      only: { type: 'string' },
    },
  });
  const consentRef = (values['consent-ref'] ?? '').trim();
  const dryRun = values['dry-run'];
  if (!consentRef) fail('Falta --consent-ref "<código del permiso>" (el mismo que usaste al importar).');
  if (values.only && !['clips', 'levels'].includes(values.only)) fail('--only acepta "clips" o "levels".');

  const env = { ...readDotEnv(), ...process.env };
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const email = env.SENAPLAY_STAFF_EMAIL;
  if (!url || !anonKey) fail('Faltan EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY (entorno o .env).');
  if (!email) fail('Falta SENAPLAY_STAFF_EMAIL (el correo de una cuenta admin).');

  const password = await promptHidden(`Contraseña de ${email}: `);
  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail('No se pudo iniciar sesión. Revisa el correo y la contraseña.');

  try {
    const ids = readLevelsSeed().levels.map((level) => level.id);
    console.log(dryRun ? '\nSimulación (no se escribe nada):' : '\nResultado:');
    if (values.only !== 'levels') {
      const c = await publicarClips(supabase, consentRef, dryRun);
      console.log(dryRun
        ? `  Clips en revisión que se publicarían: ${c.pendientes}`
        : `  Clips validados y publicados: ${c.publicados} de ${c.pendientes}`);
    }
    if (values.only !== 'clips') {
      const n = await activarNiveles(supabase, ids, dryRun);
      console.log(dryRun
        ? `  Niveles que se activarían: ${n.porActivar}`
        : `  Niveles activados: ${n.activados} de ${n.porActivar}`);
      if (n.faltan.length) console.log(`  Niveles que no existen en Supabase (corre antes el import): ${n.faltan.join(', ')}`);
    }
  } catch (e) {
    // Sin process.exit: así el finally alcanza a cerrar la sesión.
    console.error(`Error: ${e.message}`);
    process.exitCode = 1;
  } finally {
    const { error: errorSalida } = await supabase.auth.signOut();
    if (errorSalida) console.error(`Aviso: no se pudo cerrar la sesión (${errorSalida.message}).`);
  }
}

main();
