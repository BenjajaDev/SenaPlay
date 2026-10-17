import { useEffect, useRef, useState } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** true si la persona pidió reducir movimiento en su sistema (se actualiza en vivo). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.(REDUCED_MOTION).matches));
  useEffect(() => {
    const query = window.matchMedia?.(REDUCED_MOTION);
    if (!query) return undefined;
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** false mientras la pestaña está oculta: los carruseles no avanzan sin que nadie los vea. */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

/**
 * Índice de un carrusel que avanza solo cada `intervalMs`. El temporizador se
 * reinicia con cada cambio (también los manuales), así nunca salta justo
 * después de que alguien eligió una diapositiva. `firstDelayMs` desfasa el
 * primer cambio para que varios carruseles no se muevan a la vez.
 */
export function useAutoAdvance(count: number, intervalMs: number, { paused = false, firstDelayMs }: { paused?: boolean; firstDelayMs?: number } = {}) {
  const [index, setIndex] = useState(0);
  const started = useRef(false);

  // Si se quitan diapositivas, el índice vuelve a una válida.
  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (paused || count < 2) return undefined;
    const delay = started.current ? intervalMs : (firstDelayMs ?? intervalMs);
    const timer = window.setTimeout(() => {
      started.current = true;
      setIndex((current) => (current + 1) % count);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [index, paused, count, intervalMs, firstDelayMs]);

  return [Math.min(index, Math.max(count - 1, 0)), setIndex] as const;
}
