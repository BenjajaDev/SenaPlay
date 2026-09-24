// Paleta de marca de SeñaPlay.
//
// Tono claro: violeta-magenta (#8F1EAE -> #D333FF).
// Tono oscuro: dorado-ámbar (#FFBC10 -> #FFCF55).
//
// `gradient` es el par de colores principal para LinearGradient (botones,
// barras de progreso, encabezados). No reemplaza a `colors.primary`, lo
// complementa: `colors.primary` es el color sólido de referencia y
// `gradient` es la pareja [inicio, fin] para superficies con degradé.

export const lightTheme = {
  mode: 'light',
  gradient: ['#8F1EAE', '#D333FF'],
  colors: {
    background: '#F7EEFC',
    backgroundSoft: '#FDF7FF',
    surface: '#FDF8FF',
    border: '#E6D1F5',
    textPrimary: '#2B1733',
    textSecondary: '#6B5177',
    primary: '#8F1EAE',
    primaryAlt: '#D333FF',
    primaryStrong: '#6E1789',
    primarySoft: '#F3DFFB',
    primaryContrast: '#FFFFFF',
    gold: '#F2C94C',
    goldDeep: '#D9AE2C',
    success: '#58CC02',
    danger: '#D9435B',
    navInactive: '#9B87AC',
    overlay: 'rgba(43, 23, 51, 0.25)',
    shadow: '#2B1733',
  },
};

export const darkTheme = {
  mode: 'dark',
  gradient: ['#FFBC10', '#FFCF55'],
  colors: {
    background: '#120F1D',
    backgroundSoft: '#171327',
    surface: '#1E1930',
    border: '#3A3350',
    textPrimary: '#F4F0FF',
    textSecondary: '#D2C9E4',
    primary: '#FFBC10',
    primaryAlt: '#FFCF55',
    primaryStrong: '#E2A10A',
    primarySoft: '#3A3350',
    primaryContrast: '#191106',
    gold: '#F2C94C',
    goldDeep: '#D9AE2C',
    success: '#7EDB43',
    danger: '#FF7A8D',
    navInactive: '#A79BBC',
    overlay: 'rgba(0, 0, 0, 0.45)',
    shadow: '#000000',
  },
};

export function getThemeByMode(mode) {
  return mode === 'dark' ? darkTheme : lightTheme;
}
