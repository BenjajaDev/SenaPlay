import {
  Accessibility,
  BookOpen,
  Camera,
  CheckCircle2,
  Film,
  Gamepad2,
  GraduationCap,
  Database,
  Hand,
  HeartHandshake,
  Landmark,
  Layers,
  MapPin,
  Megaphone,
  Scale,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Target,
  Type,
  UserCheck,
  Users,
  Vibrate,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type { FeatureItem, PublicationCategory, PublicStats, SiteIconKey } from '@/data/types';
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
  landmark: { icon: Landmark, label: 'Institución' },
  scale: { icon: Scale, label: 'Derechos' },
  mapPin: { icon: MapPin, label: 'Lugar' },
  shield: { icon: ShieldCheck, label: 'Protección' },
  database: { icon: Database, label: 'Datos' },
  target: { icon: Target, label: 'Objetivo' },
  userCheck: { icon: UserCheck, label: 'Persona con derechos' },
};

/** Más allá de este N, «1 de cada N» deja de dibujarse como fila de puntos (solo texto). */
export const RATIO_DOTS_MAX = 60;

/**
 * «≈ 1 de cada N»: cuántas personas de `total` hay por cada una de la cifra.
 * La cifra debe ser un entero escrito a la chilena («488.511» o «488511»);
 * algo como «24/7» no es una cantidad y devuelve null. También devuelve null
 * si no aporta (N < 2).
 */
export function oneInEvery(value: string, total: number | null): number | null {
  const trimmed = value.trim();
  if (!/^(\d{1,3}(\.\d{3})+|\d+)$/.test(trimmed)) return null;
  const count = Number(trimmed.replace(/\./g, ''));
  if (!total || !count || count >= total) return null;
  const ratio = Math.round(total / count);
  return ratio >= 2 ? ratio : null;
}

/**
 * Reparte las tarjetas de «La solución» entre destacadas y chips. Si ninguna
 * está marcada (contenido guardado antes de existir la opción), se destacan
 * las primeras para que la sección no quede solo con chips.
 */
export function splitFeatures(items: FeatureItem[], max: number): { featured: FeatureItem[]; extras: FeatureItem[] } {
  const marked = items.filter((item) => item.highlight).slice(0, max);
  const featured = marked.length ? marked : items.slice(0, max);
  return { featured, extras: items.filter((item) => !featured.includes(item)) };
}

export type PolicyBlock = { kind: 'heading' | 'paragraph'; text: string };

/**
 * Texto largo de la política (/privacidad) en bloques: se separan por una
 * línea en blanco y los que empiezan con «## » son subtítulos. Se renderiza
 * como texto de React, nunca como HTML.
 */
export function policyBlocks(body: string): PolicyBlock[] {
  return body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => (block.startsWith('## ') ? { kind: 'heading', text: block.slice(3).trim() } : { kind: 'paragraph', text: block }));
}

/** Iniciales para el lugar del logo cuando una institución no tiene imagen. */
export function initialsOf(name: string, max = 3): string {
  const acronym = name.match(/\(([^)]+)\)/)?.[1];
  if (acronym) return acronym.slice(0, 5).toUpperCase();
  return name
    .split(/\s+/)
    .filter((word) => word.length > 2 && word[0] === word[0].toUpperCase())
    .slice(0, max)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

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
