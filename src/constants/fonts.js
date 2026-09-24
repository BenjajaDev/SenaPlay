export const APP_FONTS = {
  sign: 'ChileanSignLanguage',
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extraBold: 'Poppins_800ExtraBold',
  black: 'Poppins_900Black',
};

// Convierte un fontWeight numérico/string en su variante Poppins cargada.
// Los pesos "intermedios" (300, 100) no están cargados a propósito: se
// evita sumar más archivos de fuente de los que la UI realmente usa.
const WEIGHT_MAP = {
  400: APP_FONTS.regular,
  normal: APP_FONTS.regular,
  500: APP_FONTS.medium,
  600: APP_FONTS.semiBold,
  700: APP_FONTS.bold,
  bold: APP_FONTS.bold,
  800: APP_FONTS.extraBold,
  900: APP_FONTS.black,
};

export function poppins(weight = 400) {
  return WEIGHT_MAP[weight] || APP_FONTS.regular;
}
