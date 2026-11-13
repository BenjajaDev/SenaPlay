// Sube los clips del manifest (video + póster) a Storage y registra su fila.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { publicEditParams, validateClip } from './validateClip.mjs';

const BUCKET = 'sign-clips';

async function listExistingClips(supabase) {
  const existing = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('sign_clips').select('sign_key, variant').range(from, from + 999);
    if (error) throw new Error(`No se pudo leer sign_clips: ${error.message}`);
    data.forEach((row) => existing.add(`${row.sign_key}#${row.variant}`));
    if (data.length < 1000) return existing;
  }
}

/** Sube los dos archivos y registra la fila; si algo falla, borra lo subido. */
async function uploadAndInsert({ supabase, clip, files, options, signMedia, stats, id }) {
  const bucket = supabase.storage.from(BUCKET);
  const folder = signMedia.toStorageFolder(clip.key);
  const uuid = randomUUID();
  const paths = { video: `${folder}/${clip.variant}-${uuid}.mp4`, poster: `${folder}/${clip.variant}-${uuid}.webp` };
  const uploaded = [];
  try {
    for (const [path, file, contentType] of [
      [paths.video, files.videoFile, 'video/mp4'],
      [paths.poster, files.posterFile, 'image/webp'],
    ]) {
      const { error } = await bucket.upload(path, readFileSync(file), { contentType, upsert: false });
      if (error) throw new Error(`no se pudo subir ${path}: ${error.message}`);
      uploaded.push(path);
    }
    const { error } = await supabase.from('sign_clips').insert({
      sign_key: clip.key,
      gloss: clip.gloss,
      variant: clip.variant,
      region: 'general',
      video_path: paths.video,
      poster_path: paths.poster,
      duration_ms: Math.round(clip.durationMs),
      width: clip.width,
      height: clip.height,
      size_bytes: files.sizeBytes,
      signer_alias: options.signerAlias,
      consent_ref: options.consentRef,
      license: 'cedida',
      edit_params: publicEditParams(clip.editParams),
      // El alfabeto entra como borrador para no reemplazar las fotos sin revisar.
      validation_status: clip.kind === 'letter' ? 'draft' : 'in_review',
      published: false,
    });
    if (error) throw new Error(`no se pudo registrar: ${error.message}`);
  } catch (error) {
    if (uploaded.length) {
      const { error: removeError } = await bucket.remove(uploaded);
      if (removeError) stats.errors.push(`clip ${id}: no se pudo borrar lo subido (${uploaded.join(', ')}): ${removeError.message}`);
    }
    throw error;
  }
}

export async function importClips({ supabase, dir, manifest, options, domain, stats }) {
  const existing = options.dryRun ? new Set() : await listExistingClips(supabase);

  for (const clip of manifest.clips) {
    const id = `${clip.key} v${clip.variant}`;
    if (clip.excluded) {
      stats.clips.excluded += 1;
      continue;
    }
    if (existing.has(`${clip.key}#${clip.variant}`)) {
      stats.clips.skipped += 1;
      continue;
    }
    try {
      const files = validateClip(clip, dir, domain);
      if (options.dryRun) {
        stats.clips.wouldImport += 1;
        continue;
      }
      await uploadAndInsert({ supabase, clip, files, options, signMedia: domain.signMedia, stats, id });
      stats.clips[clip.kind === 'letter' ? 'drafts' : 'inReview'] += 1;
    } catch (error) {
      stats.clips.failed += 1;
      stats.errors.push(`clip ${id}: ${error.message}`);
    }
  }
}
