export const lightTheme = {
  mode: 'light',
  colors: {
    background: '#EDE7F6',
    backgroundSoft: '#F4F0FF',
    surface: '#F4F0FF',
    border: '#D8CFF0',
    textPrimary: '#2A2438',
    textSecondary: '#5B4F73',
    primary: '#7E57C2',
    primaryStrong: '#6A45B1',
    primarySoft: '#E7DDF7',
    primaryContrast: '#F4F0FF',
    gold: '#F2C94C',
    goldDeep: '#D9AE2C',
    success: '#58CC02',
    danger: '#D9435B',
    navInactive: '#8F84A8',
    overlay: 'rgba(22, 15, 39, 0.2)',
    shadow: '#2A2438',
  },
};

export const darkTheme = {
  mode: 'dark',
  colors: {
    background: '#120F1D',
    backgroundSoft: '#171327',
    surface: '#1E1930',
    border: '#3A3350',
    textPrimary: '#F4F0FF',
    textSecondary: '#D2C9E4',
    primary: '#F2C94C',
    primaryStrong: '#E2B83C',
    primarySoft: '#3A3350',
    primaryContrast: '#120F1D',
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
