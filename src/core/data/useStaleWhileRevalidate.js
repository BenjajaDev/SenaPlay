import { useEffect, useState } from 'react';

const sameContent = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * Muestra primero lo que ya hay en el dispositivo y lo reemplaza por lo
 * fresco cuando llega (stale-while-revalidate):
 *
 *   initial   resultado inmediato (contenido empaquetado) o null si no hay
 *   readCached() → resultado | null   (caché local, sin red)
 *   readFresh()  → resultado          (remoto → caché → local)
 *
 * Devuelve { data, loading }. `loading` sigue en true hasta que responde
 * readFresh, aunque ya se esté mostrando la caché. Si lo fresco es igual a
 * lo mostrado no se re-renderiza: la pantalla no parpadea. `readCached` y
 * `readFresh` deben ser estables (métodos de un repositorio).
 */
export default function useStaleWhileRevalidate(readCached, readFresh, initial = null) {
  const [state, setState] = useState(() => ({
    data: typeof initial === 'function' ? initial() : initial,
    loading: true,
  }));

  useEffect(() => {
    let mounted = true;
    let settled = false;
    const show = (data, loading) =>
      setState((prev) => (sameContent(prev.data, data) && prev.loading === loading ? prev : { data, loading }));

    readCached().then((cached) => {
      if (mounted && !settled && cached) show(cached, true);
    });
    readFresh().then((fresh) => {
      settled = true;
      if (mounted) show(fresh, false);
    });
    return () => {
      mounted = false;
    };
  }, [readCached, readFresh]);

  return state;
}
