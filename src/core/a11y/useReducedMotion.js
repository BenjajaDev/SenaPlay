import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

// Respeta el ajuste "Reducir movimiento" del sistema. Con él activo, las
// animaciones saltan al estado final o se limitan a un fade corto; la
// información (color, icono, texto) se mantiene igual.
//
// Es un valor global con UN solo listener del sistema. AppRoot lo lee antes
// de montar la interfaz (primeReducedMotion), así cada componente recibe el
// valor real desde su primer render: antes cada instancia partía en false y
// lo consultaba por su cuenta, y las animaciones de entrada (FadeInView,
// StaggerItem) se reproducían completas aunque el ajuste estuviera activo.

let reduced = false;
let primed = null;
const listeners = new Set();

function update(value) {
  const next = Boolean(value);
  if (next === reduced) return;
  reduced = next;
  listeners.forEach((listener) => listener());
}

/** Lee el ajuste del sistema y queda escuchando sus cambios. Idempotente. */
export function primeReducedMotion() {
  if (!primed) {
    AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    primed = AccessibilityInfo.isReduceMotionEnabled()
      .then(update)
      .catch(() => {});
  }
  return primed;
}

function subscribe(listener) {
  primeReducedMotion();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => reduced;

export default function useReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
