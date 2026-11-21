import type { LandingSections } from '@/data/types';

export type NavLink = { href: string; label: string };

/** Qué secciones opcionales tienen contenido para mostrarse (además de su interruptor). */
export type LandingAvailability = { publications: boolean; showcase: boolean };

/**
 * Menú de la landing en el orden de la página. Accesibilidad y La app no van
 * en el menú: cuelgan de «La solución». Privacidad siempre está.
 */
export function landingNavLinks(sections: LandingSections | undefined, available: LandingAvailability): NavLink[] {
  return [
    { href: '#problema', label: 'Problema', show: sections?.problem.visible },
    { href: '#solucion', label: 'Solución', show: sections?.features.visible },
    { href: '#territorio', label: 'Territorio y comunidad', show: sections?.territory.visible },
    { href: '#publicaciones', label: 'Avances', show: sections?.publications.visible && available.publications },
    { href: '#nosotros', label: 'Nosotros', show: true },
    { href: '#financiamiento', label: 'Financiamiento', show: sections?.funding.visible },
    { href: '#privacidad', label: 'Privacidad', show: Boolean(sections) },
  ]
    .filter((link) => link.show)
    .map(({ href, label }) => ({ href, label }));
}
