// Dobles de prueba compartidos por los tests de repositorios (sin red ni
// AsyncStorage reales).

export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: async (key, fallback) => (data.has(key) ? data.get(key) : fallback),
    set: async (key, value) => {
      data.set(key, value);
      return true;
    },
    remove: async (key) => data.delete(key),
  };
}

/**
 * Supabase falso: `respond(table)` devuelve la respuesta de cada consulta
 * ({ data, error }), una Error (rechaza) o `'hang'` (nunca responde, para
 * probar timeouts). La consulta encadena select/eq/order/maybeSingle como
 * PostgREST y registra en `calls` cada tabla consultada y si recibió señal
 * de cancelación.
 */
export function fakeSupabase(respond) {
  const calls = [];
  const from = (table) => {
    const call = { table, aborted: false };
    calls.push(call);
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      maybeSingle: () => query,
      abortSignal: (signal) => {
        signal.addEventListener('abort', () => {
          call.aborted = true;
        });
        return query;
      },
      then: (resolve, reject) => {
        const response = respond(table);
        if (response === 'hang') return new Promise(() => {}).then(resolve, reject);
        if (response instanceof Error) return Promise.reject(response).then(resolve, reject);
        return Promise.resolve(response).then(resolve, reject);
      },
    };
    return query;
  };
  return { from, calls };
}
