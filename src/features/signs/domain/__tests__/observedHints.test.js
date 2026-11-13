import { describeSign, normalizeHint } from '../signDescription';
import { createObservedHints, fullSentence, NO_OBSERVED_HINTS, OBSERVED_NOTE } from '../observedHints';

// Fixture: el archivo real lo genera otra herramienta y puede no existir.
const DOC = {
  fuente: 'Observada automáticamente en los videos del Club de Sordos de Talca (landmarks de MediaPipe); pendiente de validar por una persona sorda',
  pistas: {
    hola: {
      manos: 1,
      ubicacion: 'cerca de la frente',
      movimiento: 'amplio hacia afuera',
      texto: 'Se hace con una mano, cerca de la frente, con un movimiento amplio hacia afuera.',
    },
    gracias: {
      manos: 2,
      ubicacion: 'frente al pecho',
      movimiento: 'corto y repetido',
      texto: 'Se hace con dos manos, frente al pecho, con un movimiento corto y repetido.',
    },
    vacia: { manos: 3, ubicacion: '  ', movimiento: 5 },
  },
};
const observed = createObservedHints(DOC);

describe('createObservedHints', () => {
  test('encuentra la pista por clave y descarta entradas sin datos útiles', () => {
    expect(observed.size).toBe(2);
    expect(observed.forSign('hola').ubicacion).toBe('cerca de la frente');
    expect(observed.forSign(' HOLA ')).not.toBeNull();
    expect(observed.forSign('vacia')).toBeNull();
    expect(observed.forSign('chao')).toBeNull();
    expect(observed.fuente).toContain('pendiente de validar');
  });

  test('tolera un archivo ausente o mal formado', () => {
    [null, undefined, 'x', 7, {}, { pistas: [] }, { pistas: null }].forEach((doc) => {
      const empty = createObservedHints(doc);
      expect(empty.size).toBe(0);
      expect(empty.forSign('hola')).toBeNull();
    });
    expect(NO_OBSERVED_HINTS.forSign('hola')).toBeNull();
  });

  test('fullSentence usa el texto o arma una frase con las partes', () => {
    expect(fullSentence({ texto: 'Frase.' })).toBe('Frase.');
    expect(fullSentence({ manos: 1, ubicacion: 'cerca del mentón', movimiento: 'corto' })).toBe(
      'Se hace con una mano, cerca del mentón, con un movimiento corto.',
    );
    expect(fullSentence({ manos: null, ubicacion: null, movimiento: null, texto: null })).toBeNull();
  });
});

describe('describeSign / normalizeHint con pistas observadas', () => {
  test('ubicación y movimiento se llenan; la configuración queda vacía', () => {
    expect(describeSign('hola', observed)).toMatchObject({
      configuracion: null,
      ubicacion: 'cerca de la frente',
      movimiento: 'amplio hacia afuera',
      observada: true,
      manos: 1,
    });
  });

  test('la pista normalizada trae los parámetros, las manos y la nota de validación', () => {
    const hint = normalizeHint(null, 'gracias', observed);
    expect(hint.parametros.map((p) => p.label)).toEqual(['Ubicación', 'Movimiento']);
    expect(hint.texto).toBe('Se hace con dos manos.');
    expect(hint.nota).toBe(OBSERVED_NOTE);
    expect(hint.nota).toMatch(/pendiente de validación/);
  });

  test('sin pista observada ni diccionario no hay descripción', () => {
    expect(describeSign('chao', observed)).toBeNull();
    expect(normalizeHint(null, 'chao', observed)).toBeNull();
  });

  test('las letras del diccionario siguen igual: sin nota y sin datos nuevos', () => {
    const hint = normalizeHint(null, 'a', observed);
    expect(hint.nota).toBeUndefined();
    expect(hint.parametros.map((p) => p.label)).toEqual(['Configuración']);
  });

  test('un texto suelto sigue ganando sobre cualquier descripción', () => {
    expect(normalizeHint('Mira las manos.', 'hola', observed)).toEqual({ texto: 'Mira las manos.', parametros: [] });
  });
});

describe('fullSentence con la frase hecha del archivo', () => {
  test('no repite «un movimiento» y respeta «casi sin moverse»', () => {
    expect(fullSentence({ manos: 2, ubicacion: 'frente al pecho', movimiento: 'un movimiento corto' })).toBe(
      'Se hace con dos manos, frente al pecho, con un movimiento corto.',
    );
    expect(fullSentence({ manos: 1, ubicacion: null, movimiento: 'casi sin moverse' })).toBe(
      'Se hace con una mano, casi sin moverse.',
    );
  });
});
