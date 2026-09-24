// Senas lexicas reales (un gesto por palabra), extraidas del Diccionario
// Bilingue LSCh-Espanol del MINEDUC (docs/Diccionario_LSCh_A-H.pdf).
// El campo "howTo" describe el gesto interpretado desde las fotos oficiales;
// "page" apunta a la pagina del PDF para verificar la sena real.
//
// Sirve como respaldo local y como fuente para la tabla public.signs en Supabase.
export const REAL_SIGNS = [
  {
    word: 'ABEJA',
    type: 'Sustantivo',
    meaning: 'Insecto que vive en colmenas y produce miel.',
    howTo: 'Mano en forma de pinza (índice y pulgar) cerca de la mejilla, con un pequeño movimiento de picadura.',
    theme: 'Animales',
    page: 21,
  },
  {
    word: 'ABOGADO',
    type: 'Sustantivo',
    meaning: 'Persona que trabaja en los tribunales de justicia.',
    howTo: 'Mano apoyada sobre el lado del pecho con un movimiento corto hacia abajo.',
    theme: 'Profesiones',
    page: 21,
  },
  {
    word: 'ABRAZAR',
    type: 'Verbo',
    meaning: 'Estrechar entre los brazos en señal de cariño.',
    howTo: 'Cruza ambos brazos sobre el pecho, como dándote un abrazo a ti mismo.',
    theme: 'Acciones',
    page: 22,
  },
  {
    word: 'ABREVIAR',
    type: 'Verbo',
    meaning: 'Acortar o reducir a menos tiempo o espacio.',
    howTo: 'Las dos manos, juntas frente al pecho, se acercan entre sí (movimiento hacia el centro).',
    theme: 'Acciones',
    page: 22,
  },
  {
    word: 'ABRIGARSE',
    type: 'Verbo',
    meaning: 'Cubrirse con ropa gruesa para defenderse del frío.',
    howTo: 'Ambas manos cerradas a la altura del pecho bajan por el torso, como cerrándote un abrigo.',
    theme: 'Acciones',
    page: 22,
  },
  {
    word: 'ABRIGO',
    type: 'Sustantivo',
    meaning: 'Prenda de vestir gruesa que se pone sobre las demás.',
    howTo: 'Como “abrigarse”: manos cerradas que bajan por el pecho, indicando la prenda.',
    theme: 'Ropa',
    page: 22,
  },
  {
    word: 'ABRIR-LATA',
    type: 'Verbo',
    meaning: 'Separar la parte superior de una lata de conservas.',
    howTo: 'Una mano sostiene la lata y la otra simula abrir la tapa con un giro.',
    theme: 'Acciones',
    page: 23,
  },
];

export const SIGN_THEMES = ['Todos', 'Acciones', 'Animales', 'Profesiones', 'Ropa'];
