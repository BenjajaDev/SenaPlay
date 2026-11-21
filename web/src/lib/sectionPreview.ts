import { SECTION_KEYS } from '@/data/repositories';
import type { SectionKey } from '@/data/types';

/**
 * Mensajes entre el editor de secciones y su vista previa (un iframe de
 * /vista-previa del mismo sitio). Solo se aceptan si vienen del mismo origen
 * y de la ventana esperada; el contenido igual pasa por los sanitizadores de
 * la landing antes de mostrarse.
 */
export const PREVIEW_PATH = '/vista-previa';
const UPDATE = 'senaplay:preview:update';
const READY = 'senaplay:preview:ready';

export type PreviewTheme = 'light' | 'dark';
export type PreviewUpdate = { type: typeof UPDATE; key: SectionKey; value: unknown; theme: PreviewTheme };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export const previewUpdate = (key: SectionKey, value: unknown, theme: PreviewTheme): PreviewUpdate => ({ type: UPDATE, key, value, theme });
export const previewReady = () => ({ type: READY });

export function parsePreviewUpdate(data: unknown): PreviewUpdate | null {
  if (!isRecord(data) || data.type !== UPDATE) return null;
  if (!SECTION_KEYS.includes(data.key as SectionKey)) return null;
  if (data.theme !== 'light' && data.theme !== 'dark') return null;
  return { type: UPDATE, key: data.key as SectionKey, value: data.value, theme: data.theme };
}

export const isPreviewReady = (data: unknown) => isRecord(data) && data.type === READY;
