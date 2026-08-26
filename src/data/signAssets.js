// Registro central de imágenes/GIFs de señas.
//
// Hoy está vacío a propósito: todavía no existen los recursos gráficos. Mientras
// tanto `getSignAsset` devuelve null y los componentes muestran un placeholder.
// Cuando lleguen las imágenes basta con agregarlas aquí, SIN tocar las pantallas.
//
// Cómo agregar una seña:
//   1. Deja el archivo en assets/signs/  (ej: assets/signs/a.png o a.gif)
//   2. Añade la entrada al mapa:  a: require('../../assets/signs/a.png'),
//
// La clave debe coincidir con el campo `sign` del diccionario y de levelsConfig
// (minúsculas: 'a', 'b', ..., 'uno', 'comer'), o con `word` en minúsculas para
// las señas léxicas de signsData.
//
// React Native resuelve `require` en tiempo de build, así que NO se puede armar
// la ruta dinámicamente (`require('...' + letra)` no compila). Por eso el mapa
// es explícito.

const SIGN_IMAGES = {
  // Alfabeto — pendiente
  // a: require('../../assets/signs/a.png'),
  // b: require('../../assets/signs/b.png'),

  // Números y acciones — pendiente
  // uno: require('../../assets/signs/uno.png'),
  // comer: require('../../assets/signs/comer.gif'),
};

/** Normaliza una clave de seña al formato del registro. */
export function normalizeSignKey(value) {
  return String(value || '').trim().toLocaleLowerCase('es');
}

/**
 * Devuelve el recurso de imagen de una seña, o null si aún no existe.
 * Los componentes deben tratar el null como "muestra el placeholder".
 */
export function getSignAsset(signKey) {
  const key = normalizeSignKey(signKey);
  return SIGN_IMAGES[key] || null;
}

/** true si la seña ya tiene material gráfico cargado. */
export function hasSignAsset(signKey) {
  return getSignAsset(signKey) !== null;
}
