import {
  Accessibility,
  BookOpen,
  Camera,
  CheckCircle2,
  Film,
  Gamepad2,
  GraduationCap,
  Hand,
  HeartHandshake,
  Layers,
  Megaphone,
  Smartphone,
  Sparkles,
  Star,
  Type,
  Users,
  Vibrate,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type { PublicationCategory, PublicStats, SiteIconKey } from '@/data/types';
import type { Tone } from '@/ui';

/**
 * Métricas públicas (RPC public_stats) en el orden y con los nombres que
 * muestran la landing y el resumen del panel; `to` es la página del panel
 * donde se gestiona ese contenido.
 */
export const STAT_ITEMS: { key: keyof PublicStats; label: string; icon: LucideIcon; tone: Tone; to: string; adminOnly?: boolean }[] = [
  { key: 'levels', label: 'Niveles disponibles', icon: Layers, tone: 'brand', to: '/admin/levels' },
  { key: 'exercises', label: 'Ejercicios', icon: CheckCircle2, tone: 'success', to: '/admin/levels' },
  { key: 'dictionary', label: 'Entradas de diccionario', icon: Type, tone: 'info', to: '/admin/dictionary' },
  { key: 'vocabulary', label: 'Señas de vocabulario', icon: BookOpen, tone: 'warning', to: '/admin/vocabulary' },
  { key: 'videos', label: 'Videos publicados', icon: Film, tone: 'brand', to: '/admin/media' },
  { key: 'learners', label: 'Usuarios registrados', icon: Users, tone: 'neutral', to: '/admin/users', adminOnly: true },
];

/** Cifra lista para mostrar: separador de miles chileno; «–» si no hay dato. */
export function formatCount(value: unknown): string {
  const number = Number(value);
  return value === null || value === undefined || !Number.isFinite(number) ? '–' : number.toLocaleString('es-CL');
}

/** Íconos que los editores pueden elegir para las tarjetas de la landing. */
export const SITE_ICONS: Record<SiteIconKey, { icon: LucideIcon; label: string }> = {
  layers: { icon: Layers, label: 'Niveles' },
  camera: { icon: Camera, label: 'Cámara' },
  book: { icon: BookOpen, label: 'Libro' },
  gamepad: { icon: Gamepad2, label: 'Juegos' },
  video: { icon: Video, label: 'Video' },
  sparkles: { icon: Sparkles, label: 'Destellos' },
  vibrate: { icon: Vibrate, label: 'Vibración' },
  accessibility: { icon: Accessibility, label: 'Accesibilidad' },
  hand: { icon: Hand, label: 'Mano' },
  heart: { icon: HeartHandshake, label: 'Comunidad' },
  users: { icon: Users, label: 'Personas' },
  star: { icon: Star, label: 'Estrella' },
  smartphone: { icon: Smartphone, label: 'Teléfono' },
  megaphone: { icon: Megaphone, label: 'Anuncio' },
  graduation: { icon: GraduationCap, label: 'Educación' },
};

export const PUBLICATION_CATEGORIES: Record<PublicationCategory, { label: string; plural: string; tone: Tone }> = {
  congreso: { label: 'Congreso', plural: 'Congresos', tone: 'brand' },
  actividad: { label: 'Actividad', plural: 'Actividades', tone: 'success' },
  prueba: { label: 'Prueba', plural: 'Pruebas', tone: 'info' },
  noticia: { label: 'Noticia', plural: 'Noticias', tone: 'warning' },
  otro: { label: 'Otro', plural: 'Otras', tone: 'neutral' },
};

/**
 * «2026-09-01» → «1 de septiembre de 2026». Se arma la fecha en hora local:
 * `new Date('2026-09-01')` es UTC y en Chile mostraría el día anterior.
 */
export function formatEventDate(value: string | null | undefined): string | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}
