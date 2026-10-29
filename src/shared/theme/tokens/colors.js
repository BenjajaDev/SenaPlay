// Tokens de color de SeñaPlay.
//
// Tono claro: violeta‑magenta. Tono oscuro: dorado‑ámbar.
//
// Reglas de contraste (WCAG 2.1 AA, verificadas con scripts/checkContrast.cjs):
//  - Todo token `text*`, `*Text` y `on*` cumple ≥ 4.5:1 sobre `surface` o
//    sobre el color que acompaña (onPrimary sobre primary, etc.).
//  - `success`/`danger`/`warning`/`info` son colores de RELLENO (fondos,
//    bordes, iconos grandes). Para texto usa su variante `*Text`.
//  - `primaryAlt` es decorativo (degradés vistosos); no lleva texto chico encima.
//
// Si agregas un token, defínelo en AMBOS temas: el usuario cambia de modo en
// caliente y un color que falte en uno de los dos rompe la pantalla.

export const lightColors = {
  background: '#F7EEFC',
  backgroundSoft: '#FDF7FF',
  surface: '#FDF8FF',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#F3EEFB',
  border: '#E6D1F5',
  borderStrong: '#CDB0E3',

  textPrimary: '#2B1733',
  textSecondary: '#6B5177',
  textMuted: '#7A6690',
  textInverse: '#FFFFFF',

  primary: '#8F1EAE',
  primaryAlt: '#D333FF',
  primaryStrong: '#6E1789',
  primarySoft: '#F3DFFB',
  primaryContrast: '#FFFFFF',
  onHeader: '#FFFFFF',
  // Fondo de controles sobre la cabecera (p. ej. el interruptor de tema).
  onHeaderSoft: 'rgba(255, 255, 255, 0.2)',

  gold: '#F2C94C',
  goldDeep: '#D9AE2C',
  goldText: '#7A5A00',

  success: '#58CC02',
  successSoft: '#EAF9DC',
  successText: '#2F7D0B',
  onSuccess: '#16300A',

  danger: '#B8304A',
  dangerSoft: '#FDE7EC',
  dangerText: '#B8304A',
  onDanger: '#FFFFFF',

  warning: '#F59E0B',
  warningSoft: '#FFF4D6',
  warningText: '#B45309',
  onWarning: '#2B1733',

  info: '#2563EB',
  infoSoft: '#E3ECFE',
  infoText: '#1D4ED8',
  onInfo: '#FFFFFF',

  navInactive: '#7A6690',
  focusRing: '#D333FF',
  overlay: 'rgba(43, 23, 51, 0.35)',
  scrim: 'rgba(20, 12, 28, 0.55)',
  // Fondo casi opaco para ver una foto a pantalla completa (texto encima: onHeader).
  photoBackdrop: 'rgba(14, 8, 20, 0.94)',
  shadow: '#2B1733',
  skeletonBase: '#EDE2F5',
  skeletonHighlight: '#F9F3FD',
};

export const darkColors = {
  background: '#120F1D',
  backgroundSoft: '#171327',
  surface: '#1E1930',
  surfaceRaised: '#221C35',
  surfaceSunken: '#1B1730',
  border: '#3A3350',
  borderStrong: '#4B3B73',

  textPrimary: '#F4F0FF',
  textSecondary: '#D2C9E4',
  textMuted: '#A79BBC',
  textInverse: '#191106',

  primary: '#FFBC10',
  primaryAlt: '#FFCF55',
  primaryStrong: '#E2A10A',
  primarySoft: '#3A3350',
  primaryContrast: '#191106',
  onHeader: '#FFFFFF',
  onHeaderSoft: 'rgba(255, 255, 255, 0.12)',

  gold: '#F2C94C',
  goldDeep: '#D9AE2C',
  goldText: '#FCD34D',

  success: '#7EDB43',
  successSoft: '#1E3220',
  successText: '#7EDB43',
  onSuccess: '#132A05',

  danger: '#FF7A8D',
  dangerSoft: '#3A1E28',
  dangerText: '#FF7A8D',
  onDanger: '#2A0A12',

  warning: '#FCD34D',
  warningSoft: '#3A2E12',
  warningText: '#FCD34D',
  onWarning: '#191106',

  info: '#93C5FD',
  infoSoft: '#172C38',
  infoText: '#93C5FD',
  onInfo: '#0B1B33',

  navInactive: '#A79BBC',
  focusRing: '#FFCF55',
  overlay: 'rgba(0, 0, 0, 0.45)',
  scrim: 'rgba(0, 0, 0, 0.6)',
  photoBackdrop: 'rgba(0, 0, 0, 0.94)',
  shadow: '#000000',
  skeletonBase: '#262038',
  skeletonHighlight: '#322A48',
};

// Paleta del "escenario de cámara": las pantallas de práctica con IA se
// dibujan SOBRE el video en vivo, cuyo fondo no depende del tema, así que
// usan siempre esta paleta oscura (igual en claro y oscuro). Sale de la
// identidad de la app: el fondo del tema oscuro, el violeta de marca para
// rellenos, un lila claro para texto y bordes, el dorado para lo que hay que
// mirar y los colores de estado del tema oscuro. contrast.test.js verifica
// AA sobre `stage` y `surface`.
const CAMERA_RGB = {
  stage: '18,15,29',
  white: '255,255,255',
  text: '210,201,228',
  accent: '224,139,255',
  primary: '143,30,174',
  success: '126,219,67',
  danger: '255,122,141',
  warning: '252,211,77',
};

export const cameraColors = {
  stage: '#120F1D',
  surface: '#1E1930',
  border: '#4B3B73',
  text: '#FFFFFF',
  textStrong: '#F4F0FF',
  textSoft: '#D2C9E4',
  textMuted: '#A79BBC',
  // Lila de marca legible sobre el escenario: texto, bordes e indicadores.
  accent: '#E08BFF',
  // Violeta de marca para rellenos de botones (texto blanco encima).
  primary: '#8F1EAE',
  // Dorado: la letra o seña que hay que hacer.
  highlight: '#FFBC10',
  success: '#7EDB43',
  danger: '#FF7A8D',
  dangerLight: '#FFB3BF',
  // Relleno de acciones de grabación (texto blanco encima).
  dangerFill: '#B8304A',
  warning: '#FCD34D',
};

/** Color del escenario de cámara con transparencia: cameraAlpha('white', 0.1). */
export function cameraAlpha(key, alpha) {
  return `rgba(${CAMERA_RGB[key]},${alpha})`;
}
