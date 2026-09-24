/**
 * Bus de eventos de dominio (patrón Observer).
 *
 * Permite que módulos independientes reaccionen a lo que pasa en otros sin
 * importarse entre sí: la sesión de nivel emite LEVEL_COMPLETED y el módulo de
 * progreso (racha, estadísticas) lo escucha; la configuración remota emite
 * REMOTE_CONFIG_UPDATED y los servicios de háptica/pistas se ajustan.
 *
 * Los listeners se aíslan: si uno lanza, no impide que los demás se ejecuten.
 */
export function createEventBus() {
  const listeners = new Map();

  return {
    on(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
      return () => listeners.get(type)?.delete(listener);
    },
    once(type, listener) {
      const off = this.on(type, (payload) => {
        off();
        listener(payload);
      });
      return off;
    },
    emit(type, payload) {
      const current = listeners.get(type);
      if (!current) return;
      [...current].forEach((listener) => {
        try {
          listener(payload);
        } catch (error) {
          if (__DEV__) console.warn(`[EventBus] listener de "${type}" falló:`, error);
        }
      });
    },
    clear() {
      listeners.clear();
    },
    listenerCount(type) {
      return listeners.get(type)?.size || 0;
    },
  };
}

// Catálogo de eventos de dominio (evita strings mágicos repetidos).
export const APP_EVENTS = Object.freeze({
  LEVEL_COMPLETED: 'level/completed',
  LEVEL_FAILED: 'level/failed',
  LIFE_LOST: 'lives/lost',
  HINT_USED: 'level/hintUsed',
  REMOTE_CONFIG_UPDATED: 'config/updated',
  SESSION_CHANGED: 'auth/sessionChanged',
});

// Instancia compartida de la app.
export const appEvents = createEventBus();
