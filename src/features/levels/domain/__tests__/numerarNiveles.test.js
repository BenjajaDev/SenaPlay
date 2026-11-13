import { numerarNiveles } from '../levelProgress';

const nivel = (id, sortOrder, available = true) => ({ id, sort_order: sortOrder, available });

describe('numerarNiveles', () => {
  it('numera por posición sin saltos aunque los ids los tengan (5 → 13)', () => {
    const levels = [1, 2, 3, 4, 5, 13, 14].map((id, index) => nivel(id, index));
    const numeros = numerarNiveles(levels);
    expect([...numeros.values()]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(numeros.get(13)).toBe(6);
  });

  it('respeta sort_order y no el orden de llegada', () => {
    const numeros = numerarNiveles([nivel(13, 7), nivel(1, 0), nivel(14, 14)]);
    expect(numeros.get(1)).toBe(1);
    expect(numeros.get(13)).toBe(2);
    expect(numeros.get(14)).toBe(3);
  });

  it('desempata por id cuando el sort_order coincide', () => {
    const numeros = numerarNiveles([nivel(20, 5), nivel(15, 5)]);
    expect(numeros.get(15)).toBe(1);
    expect(numeros.get(20)).toBe(2);
  });

  it('numera también los niveles no disponibles, igual que la grilla', () => {
    const numeros = numerarNiveles([nivel(1, 0), nivel(2, 1, false), nivel(3, 2)]);
    expect(numeros.get(3)).toBe(3);
  });

  it('un id ausente no está en el mapa y una entrada inválida da un mapa vacío', () => {
    expect(numerarNiveles([nivel(1, 0)]).has(99)).toBe(false);
    expect(numerarNiveles(null).size).toBe(0);
  });
});
