import { useCallback, useState } from 'react';

export function shuffle(items) {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

/**
 * Banco de fichas + casilleros (ordenar letras, armar palabras). Tocar una
 * ficha la pone en el primer casillero libre; tocar un casillero la devuelve
 * al banco. `onChange(slots)` informa la respuesta actual.
 */
export default function useSlots(items, slotCount, onChange) {
  // Se usan índices del banco original para que letras repetidas (ej. "ANA")
  // se puedan mover de forma independiente.
  const [pool, setPool] = useState(() => shuffle(items.map((value, id) => ({ id, value }))));
  const [slots, setSlots] = useState(() => Array(slotCount).fill(null));

  const place = useCallback(
    (token) => {
      const slotIndex = slots.findIndex((item) => item === null);
      if (slotIndex < 0) return;
      const nextSlots = [...slots];
      nextSlots[slotIndex] = token;
      setSlots(nextSlots);
      setPool((prev) => prev.filter((item) => item.id !== token.id));
      onChange(nextSlots.map((item) => item?.value ?? null));
    },
    [slots, onChange],
  );

  const remove = useCallback(
    (slotIndex) => {
      const token = slots[slotIndex];
      if (!token) return;
      const nextSlots = [...slots];
      nextSlots[slotIndex] = null;
      setSlots(nextSlots);
      setPool((prev) => [...prev, token]);
      onChange(nextSlots.map((item) => item?.value ?? null));
    },
    [slots, onChange],
  );

  return { pool, slots, place, remove };
}
