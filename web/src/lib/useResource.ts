import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Carga asíncrona con estados explícitos (loading / error / data) y recarga.
 * Evita repetir el mismo patrón de useEffect + flags en cada página.
 */
export function useResource<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const value = await loader();
      if (alive.current) setData(value);
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (alive.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    alive.current = true;
    reload();
    return () => {
      alive.current = false;
    };
  }, [reload]);

  return { data, setData, loading, error, reload };
}
