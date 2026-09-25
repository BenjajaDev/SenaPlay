// Íconos de marca por tema. Los archivos de public/brand/ se generan con
// scripts/generateAppIcons.py a partir de los íconos oficiales de assets/.
export type ThemeMode = 'light' | 'dark';

const variant = (mode: ThemeMode) => (mode === 'dark' ? 'oscuro' : 'claro');

export const brandIcon = (mode: ThemeMode) => `/brand/icono-${variant(mode)}.png`;
export const brandFavicon = (mode: ThemeMode) => `/brand/favicon-${variant(mode)}.png`;

/** Cambia el favicon (el <link id="favicon"> de index.html) al del tema. */
export function applyFavicon(mode: ThemeMode) {
  const link = document.getElementById('favicon') as HTMLLinkElement | null;
  if (link) link.href = brandFavicon(mode);
}
