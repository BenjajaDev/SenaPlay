import { useRef, useState } from 'react';

/**
 * Claves de React para listas de solo lectura sin id propio: se derivan del
 * contenido y, si dos elementos son iguales, del número de aparición. Así la
 * clave sigue al elemento aunque la lista se reordene (un índice no).
 */
export function keyed<T>(items: readonly T[], contentKey: (item: T) => string): { item: T; key: string }[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = contentKey(item);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return { item, key: count ? `${base}#${count}` : base };
  });
}

/**
 * Claves estables para las filas de un editor de listas (sin id en los
 * datos). Cada fila conserva su clave al escribir, moverla o quitar otra, de
 * modo que los campos no pierden el foco ni se mezclan los valores. Si la
 * lista cambia de largo desde afuera (descartar, restaurar), se regeneran.
 */
export function useListKeys(length: number) {
  const counter = useRef(0);
  const next = () => {
    counter.current += 1;
    return `fila-${counter.current}`;
  };
  const [keys, setKeys] = useState<string[]>(() => Array.from({ length }, next));
  // Sincronización durante el render (no en un efecto) para no pintar filas sin clave.
  if (keys.length !== length) {
    const synced = keys.length < length ? [...keys, ...Array.from({ length: length - keys.length }, next)] : keys.slice(0, length);
    setKeys(synced);
    return { keys: synced, add: () => undefined, remove: () => undefined, move: () => undefined };
  }
  return {
    keys,
    /** Llamar junto con el onChange que agrega una fila al final. */
    add: () => setKeys((current) => [...current, next()]),
    remove: (index: number) => setKeys((current) => current.filter((_, position) => position !== index)),
    move: (index: number, delta: number) =>
      setKeys((current) => {
        const moved = [...current];
        [moved[index], moved[index + delta]] = [moved[index + delta], moved[index]];
        return moved;
      }),
  };
}
