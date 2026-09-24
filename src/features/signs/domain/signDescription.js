// Descripción estructurada de señas para el sistema de pistas.
//
// ── Por qué no basta con texto libre ─────────────────────────────────────────
// Las lenguas de señas no se describen bien en prosa. Desde Stokoe (1960) y en
// la tradición que sigue el Diccionario Bilingüe LSCh–Español del MINEDUC, una
// seña se analiza por PARÁMETROS FONOLÓGICOS: unidades mínimas que, al cambiar,
// cambian el significado (son pares mínimos, igual que /p/ y /b/ en español).
//
// Los cinco parámetros son:
//
//   1. CONFIGURACIÓN (queirema)      forma que adopta la mano
//   2. UBICACIÓN     (toponema)      dónde se articula respecto al cuerpo
//   3. ORIENTACIÓN   (queirotropema) hacia dónde apunta la palma y los dedos
//   4. MOVIMIENTO    (kinema)        trayectoria, repetición y velocidad
//   5. NO MANUALES                   expresión facial, mirada, postura del torso
//
// Esto importa para las pistas por dos razones prácticas:
//
//   - Una pista por parámetro se puede dosificar: primero la configuración,
//     después la ubicación. Un párrafo entero regala la respuesta de una vez.
//   - Obliga a cubrir la ubicación y la orientación, que es justo lo que la
//     app se estaba saltando. "Mano en forma de C" no distingue una C hecha
//     frente al pecho de la misma forma junto a la mejilla, y en LSCh esa
//     diferencia puede ser dos señas distintas.
//
// Los componentes NO MANUALES no son decorativos: la expresión facial marca
// negación, interrogación y grado. Una seña con la cara neutra puede ser
// agramatical aunque las manos estén perfectas.
//
// ── Estado de los datos ──────────────────────────────────────────────────────
// Abajo solo está poblado el parámetro que las descripciones actuales de
// dictionaryData.js permiten deducir con seguridad: la CONFIGURACIÓN. Los demás
// quedan vacíos a propósito en vez de inventados — completarlos requiere
// contrastar con el diccionario MINEDUC o con un usuario nativo de LSCh.

import { DICTIONARY_ENTRIES } from '../data/local/dictionaryData';

export const PARAMETROS = [
  { key: 'configuracion', label: 'Configuración', icon: 'hand-left-outline' },
  { key: 'ubicacion', label: 'Ubicación', icon: 'body-outline' },
  { key: 'orientacion', label: 'Orientación', icon: 'compass-outline' },
  { key: 'movimiento', label: 'Movimiento', icon: 'move-outline' },
  { key: 'noManual', label: 'Expresión', icon: 'happy-outline' },
];

// Señas cuya descripción ya incluye movimiento explícito en el diccionario.
// Se separan porque el clasificador estático no puede resolverlas y la pista
// debe advertirlo.
const CON_MOVIMIENTO = {
  j: 'El meñique dibuja una J en el aire, hacia abajo y con gancho final.',
  ñ: 'La mano oscila lateralmente, repetido.',
  s: 'El índice dibuja una S en el aire.',
  x: 'El índice dibuja una X en el aire.',
  z: 'El meñique dibuja una Z en el aire, en zigzag.',
};

/** Índice letra→entrada del diccionario, para no recorrer el array en cada pista. */
const POR_CLAVE = DICTIONARY_ENTRIES.reduce((acc, entry) => {
  acc[String(entry.sign).toLocaleLowerCase('es')] = entry;
  return acc;
}, {});

/**
 * Devuelve la descripción por parámetros de una seña.
 * Los parámetros sin dato confiable vuelven como null y no se muestran.
 */
export function describeSign(signKey) {
  const clave = String(signKey || '').trim().toLocaleLowerCase('es');
  const entry = POR_CLAVE[clave];
  if (!entry) return null;

  return {
    clave,
    titulo: entry.letter,
    configuracion: entry.description || null,
    ubicacion: null,
    orientacion: null,
    movimiento: CON_MOVIMIENTO[clave] || null,
    noManual: null,
  };
}

/**
 * Normaliza una pista al formato que renderiza la UI.
 *
 * Acepta las tres formas que existen hoy:
 *   - string                     → pista suelta de levelsConfig (55 de estas)
 *   - objeto con parámetros      → formato nuevo
 *   - null + signKey             → se deduce del diccionario
 *
 * Devuelve { texto?, parametros: [{label, icon, valor}] }.
 */
export function normalizeHint(hint, signKey) {
  if (typeof hint === 'string' && hint.trim()) {
    return { texto: hint, parametros: [] };
  }

  const fuente = hint && typeof hint === 'object' ? hint : describeSign(signKey);
  if (!fuente) return null;

  const parametros = PARAMETROS
    .map(({ key, label, icon }) => ({ label, icon, valor: fuente[key] }))
    .filter((p) => p.valor);

  if (!parametros.length) return null;
  return { texto: null, parametros };
}
