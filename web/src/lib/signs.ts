import type { SignSlide } from '@/data/types';

/**
 * Abecedario LSCh incluido en el sitio (web/public/signs/*.webp, generado
 * desde assets/Alfabeto). Permite armar los carruseles del hero sin subir
 * imágenes; la Ñ se guarda como NN.webp para evitar nombres no ASCII.
 */
export const SIGN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

export const signImageUrl = (letter: string) => `/signs/${letter === 'Ñ' ? 'NN' : letter}.webp`;

export const builtinSignSlide = (letter: string): SignSlide => ({ label: letter, image_url: signImageUrl(letter), image_path: null });

/** Letra incluida a la que corresponde una URL, o null si es una imagen subida. */
export function builtinLetter(url: string): string | null {
  return SIGN_LETTERS.find((letter) => signImageUrl(letter) === url) ?? null;
}

/**
 * Imágenes que aceptan los carruseles: rutas del propio sitio o https (las
 * del bucket de Supabase). Cualquier otra cosa se descarta al leer la base.
 */
export function isSafeImageUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url.trim()) return false;
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}
