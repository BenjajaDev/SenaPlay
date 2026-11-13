import { numerarNiveles, resolveUnlockedIds } from '../levelProgress';

// Catálogo real: ids 1–5 (sort 0–4), 13 (sort 7), 14–30 (sort 14–30).
const catalogo = [
  ...[1, 2, 3, 4, 5].map((id) => ({ id, sort_order: id - 1, available: true })),
  { id: 13, sort_order: 7, available: true },
  ...Array.from({ length: 17 }, (_, i) => ({ id: 14 + i, sort_order: 14 + i, available: i < 3 })),
];

describe('numerarNiveles con el catálogo real', () => {
  it('queda 1…23 sin saltos y 13 pasa a ser el 6', () => {
    const numeros = numerarNiveles(catalogo);
    expect([...numeros.values()]).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
    expect(numeros.get(13)).toBe(6);
    expect(numeros.get(30)).toBe(23);
  });

  it('el orden de llegada desordenado da la misma numeración', () => {
    expect([...numerarNiveles([...catalogo].reverse())]).toEqual([...numerarNiveles(catalogo)].sort((a, b) => a[1] - b[1]));
  });

  it('no altera los ids: el desbloqueo sigue usando ids reales', () => {
    const progreso = { completed: { 5: { stars: 3 } }, unlocked: [1] };
    expect(resolveUnlockedIds(catalogo, progreso)).toContain(13);
  });

  it('entradas inválidas (elementos nulos o sin id) se ignoran', () => {
    const numeros = numerarNiveles([null, undefined, {}, { id: 7, sort_order: 0 }]);
    expect([...numeros]).toEqual([[7, 1]]);
  });
});
