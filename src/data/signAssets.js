// Registro central de imágenes/GIFs de señas.
//
// Cómo agregar una seña:
//   1. Deja el archivo en assets/Alfabeto/ o assets/signs/ (ej: assets/signs/uno.png).
//   2. Añade la entrada al mapa: uno: [require('../../assets/signs/uno.png')].
//
// Una seña puede tener MÁS DE UNA imagen (ej: las letras T, X e Y tienen una
// variación de configuración manual). Cuando una clave mapea a varias
// imágenes, SignImage las muestra en un carrusel automático (crossfade) para
// que el usuario vea ambas formas válidas sin que la casilla necesite un
// diseño distinto — así se mantiene la misma coherencia visual en todo el
// diccionario y los niveles.
//
// La clave debe coincidir con el campo `sign` del diccionario y de
// levelsConfig (minúsculas: 'a', 'b', ..., 'uno', 'comer'), o con `word` en
// minúsculas para las señas léxicas de signsData.
//
// React Native resuelve `require` en tiempo de build, así que NO se puede
// armar la ruta dinámicamente (`require('...' + letra)` no compila). Por eso
// el mapa es explícito.

const SIGN_IMAGES = {
  a: [require('../../assets/Alfabeto/A.png')],
  b: [require('../../assets/Alfabeto/B.png')],
  c: [require('../../assets/Alfabeto/C.png')],
  d: [require('../../assets/Alfabeto/D.png')],
  e: [require('../../assets/Alfabeto/E.png')],
  f: [require('../../assets/Alfabeto/F.png')],
  g: [require('../../assets/Alfabeto/G.png')],
  h: [require('../../assets/Alfabeto/H.png')],
  i: [require('../../assets/Alfabeto/I.png')],
  j: [require('../../assets/Alfabeto/J.png')],
  k: [require('../../assets/Alfabeto/K.png')],
  l: [require('../../assets/Alfabeto/L.png')],
  m: [require('../../assets/Alfabeto/M.png')],
  n: [require('../../assets/Alfabeto/N.png')],
  o: [require('../../assets/Alfabeto/O.png')],
  p: [require('../../assets/Alfabeto/P.png')],
  q: [require('../../assets/Alfabeto/Q.png')],
  r: [require('../../assets/Alfabeto/R.png')],
  s: [require('../../assets/Alfabeto/S.png')],
  t: [require('../../assets/Alfabeto/T.png'), require('../../assets/Alfabeto/T_variacion.png')],
  u: [require('../../assets/Alfabeto/U.png')],
  v: [require('../../assets/Alfabeto/V.png')],
  w: [require('../../assets/Alfabeto/W.png')],
  x: [require('../../assets/Alfabeto/X.png'), require('../../assets/Alfabeto/X_variacion.png')],
  y: [require('../../assets/Alfabeto/Y.png'), require('../../assets/Alfabeto/Y_variacion.png')],
  z: [require('../../assets/Alfabeto/Z.png')],
  // dictionaryData usa 'ñ' y levelsConfig usa 'n~' para la misma letra.
  ñ: [require('../../assets/Alfabeto/Ñ.png')],
  'n~': [require('../../assets/Alfabeto/Ñ.png')],

  // Números y acciones — pendiente (aún no hay fotos para estas señas).
  // uno: [require('../../assets/signs/uno.png')],
  // comer: [require('../../assets/signs/comer.gif')],
};

/** Normaliza una clave de seña al formato del registro. */
export function normalizeSignKey(value) {
  return String(value || '').trim().toLocaleLowerCase('es');
}

/**
 * Devuelve las imágenes de una seña (siempre un arreglo), o [] si aún no
 * existen. Los componentes deben tratar el arreglo vacío como "muestra el
 * placeholder" y un arreglo de más de un elemento como "muestra el carrusel".
 */
export function getSignAssets(signKey) {
  const key = normalizeSignKey(signKey);
  return SIGN_IMAGES[key] || [];
}

/** Compat: devuelve solo la primera imagen, o null si no existe. */
export function getSignAsset(signKey) {
  return getSignAssets(signKey)[0] || null;
}

/** true si la seña ya tiene material gráfico cargado. */
export function hasSignAsset(signKey) {
  return getSignAssets(signKey).length > 0;
}
