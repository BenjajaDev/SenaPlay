// Tope de tiempo para LECTURAS de Supabase. Sin él, con red lenta un fetch
// puede quedar colgado y la pantalla se queda en spinner o skeleton. Al vencer
// se comporta como cualquier error de red: el repositorio cae a la caché o al
// contenido local. No se aplica a escrituras ni a subidas de archivos.
export const READ_TIMEOUT_MS = 8000;

export class TimeoutError extends Error {
  constructor(ms) {
    super(`La consulta superó ${ms} ms.`);
    this.name = 'TimeoutError';
  }
}

/**
 * Resuelve `query` (consulta de PostgREST u otra promesa) o rechaza con
 * TimeoutError tras `ms`. Si la consulta acepta `abortSignal()`, además se
 * cancela la petición HTTP para no gastar datos en una respuesta que nadie usará.
 */
export async function withTimeout(query, ms = READ_TIMEOUT_MS) {
  const controller = new AbortController();
  const request = typeof query?.abortSignal === 'function' ? query.abortSignal(controller.signal) : query;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(ms));
    }, ms);
  });
  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
