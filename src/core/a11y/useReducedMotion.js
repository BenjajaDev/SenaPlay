import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Respeta el ajuste "Reducir movimiento" del sistema. Con él activo, las
// animaciones saltan al estado final o se limitan a un fade corto; la
// información (color, icono, texto) se mantiene igual.
export default function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(Boolean(value));
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setReduced(Boolean(value));
    });
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduced;
}
