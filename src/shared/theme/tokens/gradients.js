// Degradés armónicos construidos SOLO con la paleta de marca.
//
// Cada degradé es { colors, start, end } listo para <LinearGradient {...g} />.
// Se separan por intención (no por color) para poder retocar la identidad
// visual en un solo lugar:
//
//  brand       botón primario, chip/tab activo. Termina en un magenta más
//              oscuro que primaryAlt para que el texto blanco cumpla AA (4.9:1).
//  brandVivid  superficies sin texto chico (barra de progreso, halos, banners
//              con texto grande): usa el magenta brillante completo.
//  header      encabezados de pantalla y de tarjetas destacadas.
//  card        fondo sutil de tarjetas "hero" (casi plano, da profundidad).
//  reward      logros, racha, estrellas.
//  success / danger  feedback de respuesta.
//  celebration banner de nivel completado.

const diagonal = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
const horizontal = { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } };
const vertical = { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } };

export const lightGradients = {
  brand: { colors: ['#8F1EAE', '#B429D9'], ...diagonal },
  brandVivid: { colors: ['#8F1EAE', '#D333FF'], ...horizontal },
  header: { colors: ['#6E1789', '#8F1EAE', '#B429D9'], ...diagonal },
  card: { colors: ['#FFFFFF', '#F7EEFC'], ...vertical },
  reward: { colors: ['#F2C94C', '#FFE08A'], ...diagonal },
  success: { colors: ['#58CC02', '#7EDB43'], ...diagonal },
  danger: { colors: ['#B8304A', '#D9435B'], ...diagonal },
  celebration: { colors: ['#8F1EAE', '#D333FF', '#F2C94C'], ...diagonal },
};

export const darkGradients = {
  brand: { colors: ['#FFBC10', '#FFCF55'], ...diagonal },
  brandVivid: { colors: ['#E2A10A', '#FFCF55'], ...horizontal },
  header: { colors: ['#2A2240', '#3A2E5C', '#4B3B73'], ...diagonal },
  card: { colors: ['#221C35', '#1B1730'], ...vertical },
  reward: { colors: ['#D9AE2C', '#FFCF55'], ...diagonal },
  success: { colors: ['#5DBB2B', '#7EDB43'], ...diagonal },
  danger: { colors: ['#E0566B', '#FF7A8D'], ...diagonal },
  celebration: { colors: ['#4B3B73', '#FFBC10', '#FFCF55'], ...diagonal },
};
