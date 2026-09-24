// Señas de referencia para el modo práctica y palabras para el deletreo.
//
// Los landmarks están en coordenadas Three.js world (el mismo sistema del visor
// 3D), NO en las coordenadas crudas de MediaPipe: el servidor los usa en
// /comparar para calcular la similitud dedo a dedo, no en /clasificar.

// ── Señas disponibles para el modo práctica ────────────────────────────────────
export const SIGNS = [
  {
    id: '5',
    nombre: 'Número 5',
    instruccion: 'Abre la mano con todos los dedos extendidos',
    landmarks: [
      [ 0.00, -1.00,  0.00], [-0.30, -0.70,  0.10], [-0.52, -0.42,  0.18],
      [-0.68, -0.18,  0.12], [-0.80,  0.04,  0.06], [-0.22,  0.10,  0.00],
      [-0.22,  0.42,  0.00], [-0.22,  0.68,  0.00], [-0.22,  0.90,  0.00],
      [ 0.00,  0.15,  0.00], [ 0.00,  0.48,  0.00], [ 0.00,  0.76,  0.00],
      [ 0.00,  0.98,  0.00], [ 0.22,  0.10,  0.00], [ 0.22,  0.42,  0.00],
      [ 0.22,  0.66,  0.00], [ 0.22,  0.86,  0.00], [ 0.40,  0.00,  0.00],
      [ 0.44,  0.26,  0.00], [ 0.47,  0.46,  0.00], [ 0.49,  0.62,  0.00],
    ],
  },
  {
    id: 'A',
    nombre: 'Letra A',
    instruccion: 'Cierra el puño con el pulgar al costado',
    landmarks: [
      [ 0.00, -1.00,  0.00], [-0.30, -0.70,  0.10], [-0.52, -0.42,  0.18],
      [-0.68, -0.22,  0.14], [-0.82, -0.08,  0.08], [-0.22,  0.10,  0.00],
      [-0.22,  0.30,  0.12], [-0.18,  0.42,  0.22], [-0.12,  0.38,  0.30],
      [ 0.00,  0.15,  0.00], [ 0.00,  0.34,  0.12], [ 0.02,  0.46,  0.22],
      [ 0.06,  0.42,  0.30], [ 0.22,  0.10,  0.00], [ 0.22,  0.30,  0.12],
      [ 0.20,  0.42,  0.22], [ 0.16,  0.38,  0.30], [ 0.40,  0.00,  0.00],
      [ 0.42,  0.18,  0.10], [ 0.42,  0.30,  0.20], [ 0.40,  0.28,  0.28],
    ],
  },
  {
    id: 'B',
    nombre: 'Letra B',
    instruccion: 'Mano plana, dedos juntos hacia arriba, pulgar doblado',
    landmarks: [
      [ 0.00, -1.00,  0.00], [-0.30, -0.70,  0.10], [-0.42, -0.50,  0.14],
      [-0.44, -0.32,  0.16], [-0.36, -0.18,  0.15], [-0.22,  0.10,  0.00],
      [-0.22,  0.42,  0.00], [-0.22,  0.68,  0.00], [-0.22,  0.90,  0.00],
      [ 0.00,  0.15,  0.00], [ 0.00,  0.48,  0.00], [ 0.00,  0.76,  0.00],
      [ 0.00,  0.98,  0.00], [ 0.22,  0.10,  0.00], [ 0.22,  0.42,  0.00],
      [ 0.22,  0.66,  0.00], [ 0.22,  0.86,  0.00], [ 0.40,  0.00,  0.00],
      [ 0.44,  0.26,  0.00], [ 0.47,  0.46,  0.00], [ 0.49,  0.62,  0.00],
    ],
  },
  {
    id: 'L',
    nombre: 'Letra L',
    instruccion: 'Índice arriba y pulgar al costado formando una L',
    landmarks: [
      [ 0.00, -1.00,  0.00], [-0.30, -0.70,  0.10], [-0.52, -0.42,  0.18],
      [-0.68, -0.18,  0.12], [-0.80,  0.04,  0.06], [-0.22,  0.10,  0.00],
      [-0.22,  0.42,  0.00], [-0.22,  0.68,  0.00], [-0.22,  0.90,  0.00],
      [ 0.00,  0.15,  0.00], [ 0.00,  0.34,  0.12], [ 0.02,  0.46,  0.22],
      [ 0.06,  0.42,  0.30], [ 0.22,  0.10,  0.00], [ 0.22,  0.30,  0.12],
      [ 0.20,  0.42,  0.22], [ 0.16,  0.38,  0.30], [ 0.40,  0.00,  0.00],
      [ 0.42,  0.18,  0.10], [ 0.42,  0.30,  0.20], [ 0.40,  0.28,  0.28],
    ],
  },
  {
    id: 'C',
    nombre: 'Letra C',
    instruccion: 'Curva todos los dedos como si agarraras una pelota',
    landmarks: [
      [ 0.00, -1.00,  0.00], [-0.28, -0.72,  0.08], [-0.48, -0.46,  0.16],
      [-0.60, -0.22,  0.20], [-0.68, -0.02,  0.22], [-0.20,  0.10,  0.00],
      [-0.28,  0.36,  0.12], [-0.30,  0.58,  0.18], [-0.28,  0.74,  0.20],
      [ 0.00,  0.14,  0.00], [-0.06,  0.42,  0.12], [-0.08,  0.64,  0.18],
      [-0.06,  0.80,  0.20], [ 0.18,  0.12,  0.00], [ 0.14,  0.40,  0.12],
      [ 0.12,  0.60,  0.18], [ 0.14,  0.76,  0.20], [ 0.36,  0.02,  0.00],
      [ 0.36,  0.24,  0.10], [ 0.36,  0.42,  0.16], [ 0.36,  0.56,  0.18],
    ],
  },
];

// ── Palabras para el juego de Deletreo ─────────────────────────────────────────
// Las letras estáticas las reconoce el servidor; J/Z (con movimiento) se resuelven
// por trayectoria en el WebView (ver CONFIG_MOV en handTrackingHtml.js).
export const PALABRAS = ['HOLA', 'AMIGO', 'MAMA', 'CASA', 'AMOR', 'GATO', 'PERA'];

// Confianza mínima de la IA para dar por buena una letra del deletreo.
export const UMBRAL_DELETREO = 0.55;
