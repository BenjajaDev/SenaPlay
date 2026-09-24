import { Easing } from 'react-native';
import { APP_FONTS } from '../fonts';

// Escalas de forma, espacio, tipografía y movimiento. Son iguales en modo
// claro y oscuro; lo que cambia entre temas son colores, degradés y sombras.

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Radios únicos del sistema: no inventes otros valores en las pantallas.
export const radius = {
  sm: 8,
  md: 12, // botones, inputs
  lg: 14, // tarjetas
  xl: 20, // diálogos, overlays
  xxl: 24, // hojas inferiores
  pill: 999, // chips, badges, FAB
};

// Tamaño táctil mínimo recomendado (WCAG 2.5.5 / guías de Android e iOS).
export const MIN_TOUCH = 44;

// Android no sintetiza pesos: cada variante fija su fontFamily explícita.
export const typography = {
  display: { fontFamily: APP_FONTS.black, fontSize: 28, lineHeight: 36 },
  title: { fontFamily: APP_FONTS.extraBold, fontSize: 22, lineHeight: 30 },
  heading: { fontFamily: APP_FONTS.bold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: APP_FONTS.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: APP_FONTS.semiBold, fontSize: 15, lineHeight: 22 },
  subtitle: { fontFamily: APP_FONTS.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: APP_FONTS.medium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: APP_FONTS.semiBold, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: APP_FONTS.bold, fontSize: 15, lineHeight: 20 },
  stat: { fontFamily: APP_FONTS.black, fontSize: 22, lineHeight: 28 },
};

export const motion = {
  duration: {
    instant: 110,
    fast: 160,
    base: 220,
    slow: 320,
    emphasis: 480,
    celebration: 900,
  },
  easing: {
    enter: Easing.out(Easing.cubic),
    exit: Easing.in(Easing.cubic),
    standard: Easing.inOut(Easing.cubic),
    pop: Easing.out(Easing.back(1.4)),
  },
  spring: {
    press: { friction: 7, tension: 220 },
    pop: { friction: 6, tension: 120 },
  },
  stagger: 45,
};

export function buildElevation(shadowColor, isDark) {
  // En oscuro las sombras casi no se ven: se compensa con bordes/superficies.
  const opacity = isDark ? 0.4 : 0.12;
  return {
    none: {},
    sm: {
      shadowColor,
      shadowOpacity: opacity * 0.7,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    md: {
      shadowColor,
      shadowOpacity: opacity,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    lg: {
      shadowColor,
      shadowOpacity: opacity * 1.3,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 12,
    },
  };
}
