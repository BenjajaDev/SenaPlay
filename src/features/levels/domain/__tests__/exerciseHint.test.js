import { createObservedHints, OBSERVED_NOTE } from '../../../signs/domain/observedHints';
import { hintSignKeys, resolveHint } from '../exerciseHint';

// Fixture: el archivo real de pistas lo genera otra herramienta.
const observed = createObservedHints({
  pistas: {
    hola: { manos: 1, ubicacion: 'cerca de la frente', movimiento: 'amplio', texto: 'Se hace con una mano, cerca de la frente, con un movimiento amplio.' },
    chao: {
      manos: 2,
      ubicacion: 'frente al pecho',
      movimiento: 'corto y repetido',
      texto: 'Se hace con dos manos, frente al pecho, con un movimiento corto y repetido.',
    },
  },
});

const GENERIC = 'Mira primero las manos y luego la cara.';
const wordMeaning = { type: 'word-meaning', signs: ['hola'], options: ['Hola', 'Chao'], correct: 'Hola', hint: GENERIC };
const signChoice = { type: 'sign-choice', word: 'CHAO', signs: ['gracias', 'chao'], correct: 'chao', hint: GENERIC };
const trueFalse = { type: 'true-false', sign: 'hola', statement: 'Esta seña significa HOLA', answer: true, hint: GENERIC };
const recognition = { type: 'recognition', signs: ['hola', 'gracias', 'chao'], options: ['Hola', 'Chao'], correct: ['Hola', 'Chao'] };
const matching = { type: 'matching', letters: ['gracias', 'hola', 'chao'], labels: ['Gracias', 'Hola', 'Chao'], hint: GENERIC };

describe('pista de un ejercicio con señas del club', () => {
  test('word-meaning: usa la seña mostrada, sin nombrarla', () => {
    const hint = resolveHint(wordMeaning, {}, observed);
    expect(hint.title).toBe('Pista');
    expect(hint.parametros.map((p) => p.valor)).toEqual(['cerca de la frente', 'amplio']);
    expect(hint.nota).toBe(OBSERVED_NOTE);
    expect(JSON.stringify(hint).toLowerCase()).not.toContain('hola');
  });

  test('sign-choice: usa la seña de la palabra pedida', () => {
    const hint = resolveHint(signChoice, {}, observed);
    expect(hint.parametros.map((p) => p.valor)).toEqual(['frente al pecho', 'corto y repetido']);
    expect(hint.texto).toBe('Se hace con dos manos.');
  });

  test('true-false con una seña usa esa seña', () => {
    expect(resolveHint(trueFalse, {}, observed).parametros[0].valor).toBe('cerca de la frente');
  });

  test('recognition: una línea por seña mostrada, numeradas, y avisa las que no tienen pista', () => {
    const hint = resolveHint(recognition, {}, observed);
    expect(hint.texto.split('\n')).toEqual([
      'Seña 1: Se hace con una mano, cerca de la frente, con un movimiento amplio.',
      'Seña 2: sin pista todavía.',
      'Seña 3: Se hace con dos manos, frente al pecho, con un movimiento corto y repetido.',
    ]);
    expect(hint.nota).toBe(OBSERVED_NOTE);
  });

  test('matching: la primera seña sin emparejar', () => {
    expect(hintSignKeys(matching, [])).toEqual(['gracias']);
    expect(hintSignKeys(matching, ['s-0', 'l-0'])).toEqual(['hola']);
    expect(hintSignKeys(matching, ['s-0', 's-1', 's-2'])).toEqual([]);
    // «gracias» no tiene pista observada: cae al genérico.
    expect(resolveHint(matching, {}, observed).texto).toBe(GENERIC);
    const next = resolveHint(matching, { matched: ['s-0', 'l-0'] }, observed);
    expect(next.texto).toMatch(/^Una de las señas que faltan\./);
    expect(next.parametros).toHaveLength(2);
  });

  test('sin pista observada se mantiene el hint genérico del ejercicio', () => {
    const hint = resolveHint({ ...wordMeaning, signs: ['gracias'] }, {}, observed);
    expect(hint).toEqual({ texto: GENERIC, parametros: [], title: 'Pista' });
  });

  test('sin pista observada ni hint genérico no hay pista (la UI pone una frase general)', () => {
    expect(resolveHint({ type: 'word-meaning', signs: ['gracias'], options: ['a', 'b'], correct: 'a' }, {}, observed)).toBeNull();
  });
});

describe('mantener presionada una seña', () => {
  test('sin ocultar la glosa, el título nombra la seña', () => {
    const hint = resolveHint(recognition, { signKey: 'hola', conceal: false }, observed);
    expect(hint.title).toBe('Pista: HOLA');
    expect(hint.nota).toBe(OBSERVED_NOTE);
  });

  test('ocultando la glosa, usa la pista observada de esa seña sin nombrarla', () => {
    const hint = resolveHint(recognition, { signKey: 'chao', conceal: true }, observed);
    expect(hint.title).toBe('Pista');
    expect(hint.parametros.map((p) => p.valor)).toEqual(['frente al pecho', 'corto y repetido']);
  });

  test('ocultando la glosa sin pista observada cae a la general del ejercicio', () => {
    expect(resolveHint(trueFalse, { signKey: 'gracias', conceal: true }, observed).texto).toBe(GENERIC);
  });

  test('una letra sigue usando el diccionario', () => {
    const hint = resolveHint({ type: 'multiple-choice', sign: 'a', options: ['a', 'b'], correct: 'a' }, { signKey: 'a' }, observed);
    expect(hint.title).toBe('Pista: A');
    expect(hint.parametros[0].label).toBe('Configuración');
  });
});
