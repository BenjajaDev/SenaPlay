// Validación local de un clip del manifest antes de subir nada.
import { existsSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

/** Ruta del manifest resuelta dentro de `dir`; lanza si intenta salirse (../, absoluta). */
export function insideDir(dir, relativePath) {
  const full = resolve(dir, String(relativePath ?? ''));
  const rel = relative(dir, full);
  if (!relativePath || rel === '' || rel.startsWith('..') || isAbsolute(rel)) throw new Error('ruta fuera de la carpeta del manifest');
  return full;
}

/** edit_params sin la ruta del archivo original: es un dato interno del club. */
export function publicEditParams(editParams) {
  if (!editParams || typeof editParams !== 'object') return {};
  const { source, ...rest } = editParams;
  if (!source || typeof source !== 'object') return rest;
  const { file: _file, ...safeSource } = source;
  return { ...rest, source: safeSource };
}

/**
 * Revisa un clip no excluido con los límites del dominio (SIGN_CLIP_LIMITS) y
 * devuelve las rutas de sus archivos y el peso del video. Lanza con un mensaje
 * legible si algo no cumple; la base de datos repite estos límites.
 */
export function validateClip(clip, dir, { signMedia }) {
  const limits = signMedia.SIGN_CLIP_LIMITS;
  if (!signMedia.isValidSignKey(clip.key)) throw new Error('clave de seña inválida');
  if (!Number.isInteger(clip.variant) || clip.variant < 1 || clip.variant > 20) throw new Error('variante fuera de 1 a 20');
  if (!Number.isFinite(clip.durationMs) || clip.durationMs < limits.minDurationMs || clip.durationMs > limits.maxDurationMs) {
    throw new Error('duración fuera de 0,5 a 10 s');
  }
  if (!Number.isInteger(clip.width) || !Number.isInteger(clip.height) || clip.width !== clip.height) {
    throw new Error('el clip debe ser cuadrado (ancho y alto enteros e iguales)');
  }
  const videoFile = insideDir(dir, clip.video);
  const posterFile = insideDir(dir, clip.poster);
  if (!existsSync(videoFile) || !existsSync(posterFile)) throw new Error('faltan el video o la imagen fija');
  const sizeBytes = statSync(videoFile).size;
  if (sizeBytes > limits.maxVideoBytes) throw new Error('el video supera 1,5 MB');
  return { videoFile, posterFile, sizeBytes };
}
