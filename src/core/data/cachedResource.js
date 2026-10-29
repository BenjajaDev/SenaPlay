// Contenido remoto con respaldo en tres niveles, compartido por los
// repositorios de catálogo, señas y videos:
//
//   1. remote  Supabase (tras una lectura exitosa se recuerda en memoria
//              durante `ttlMs`: volver a una pestaña no repite la consulta)
//   2. cache   último valor remoto válido guardado en el dispositivo
//   3. local   contenido empaquetado con la app
//
// `fetchRemote()` devuelve el valor ya mapeado o lanza; quien lo implementa
// aplica withTimeout a la consulta. Nunca lanza hacia afuera.

export const CONTENT_TTL_MS = 5 * 60 * 1000;

const isNonEmptyArray = (value) => Array.isArray(value) && value.length > 0;

export function createCachedResource({
  storage,
  cacheKey,
  fetchRemote,
  local,
  isValid = isNonEmptyArray,
  ttlMs = CONTENT_TTL_MS,
  now = Date.now,
}) {
  let memory = null;
  let inFlight = null;

  const readCached = async () => {
    const cached = await storage.get(cacheKey, null);
    return isValid(cached) ? cached : null;
  };

  const load = async () => {
    try {
      const remote = await fetchRemote();
      if (isValid(remote)) {
        memory = { value: remote, at: now() };
        await storage.set(cacheKey, remote);
        return { value: remote, source: 'remote' };
      }
    } catch {
      /* sin red o con red lenta: se intenta la caché */
    }
    const cached = await readCached();
    if (cached) return { value: cached, source: 'cache' };
    return { value: local, source: 'local' };
  };

  return {
    /** Último valor guardado en el dispositivo, o null. Sin red. */
    readCached,

    /** Valor más fresco disponible: { value, source }. */
    read() {
      if (memory && now() - memory.at < ttlMs) return Promise.resolve({ value: memory.value, source: 'remote' });
      if (!inFlight) inFlight = load().finally(() => (inFlight = null));
      return inFlight;
    },
  };
}
