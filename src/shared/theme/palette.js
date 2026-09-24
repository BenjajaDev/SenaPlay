import { darkColors, lightColors } from './tokens/colors';
import { darkGradients, lightGradients } from './tokens/gradients';
import { buildElevation, MIN_TOUCH, motion, radius, spacing, typography } from './tokens/scales';

// Ensambla el objeto de tema que expone useAppTheme(). Todo lo visual de la
// app sale de aquí: colores, degradés, espacios, radios, tipografía,
// movimiento y sombras.
//
// `gradient` (par [inicio, fin]) se mantiene por compatibilidad con código
// que aún lo usa directo en <LinearGradient colors={theme.gradient} />; lo
// nuevo debe usar `theme.gradients.<intención>`.
function buildTheme(mode) {
  const isDark = mode === 'dark';
  const colors = isDark ? darkColors : lightColors;
  const gradients = isDark ? darkGradients : lightGradients;

  return {
    mode,
    isDark,
    colors,
    gradients,
    gradient: gradients.brand.colors,
    spacing,
    radius,
    typography,
    motion,
    minTouch: MIN_TOUCH,
    elevation: buildElevation(colors.shadow, isDark),
  };
}

export const lightTheme = buildTheme('light');
export const darkTheme = buildTheme('dark');

export function getThemeByMode(mode) {
  return mode === 'dark' ? darkTheme : lightTheme;
}
