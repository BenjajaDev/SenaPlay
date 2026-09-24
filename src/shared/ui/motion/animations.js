import { Animated, Easing } from 'react-native';

// Recetas de animación reutilizables (todas con native driver). Devuelven la
// animación SIN iniciar para que quien llama pueda componerlas con
// Animated.parallel / sequence o saltarlas si "reducir movimiento" está activo.

// Temblor sutil y no punitivo (pérdida de vida, respuesta incorrecta): amplitud
// chica y decreciente. Más fuerte se siente como castigo.
export function shake(value, amplitude = 8) {
  const steps = [amplitude, -amplitude, amplitude * 0.6, -amplitude * 0.4, 0];
  return Animated.sequence(
    steps.map((toValue) => Animated.timing(value, { toValue, duration: 55, useNativeDriver: true })),
  );
}

// Pulso único para llamar la atención (1 → peak → 1).
export function pulse(value, peak = 1.12, duration = 180) {
  return Animated.sequence([
    Animated.timing(value, { toValue: peak, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    Animated.timing(value, { toValue: 1, duration: duration + 40, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
  ]);
}

// Pop‑in con rebote leve (0 → 1).
export function popIn(value, duration = 260) {
  return Animated.timing(value, {
    toValue: 1,
    duration,
    easing: Easing.out(Easing.back(1.5)),
    useNativeDriver: true,
  });
}

export function fadeTo(value, toValue, duration = 200) {
  return Animated.timing(value, {
    toValue,
    duration,
    easing: toValue > 0 ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    useNativeDriver: true,
  });
}

// "Respiración" en loop (botón de grabar, spinner temático). Devuelve el loop:
// quien lo usa DEBE llamar .stop() al desmontar.
export function breathe(value, min = 0.92, max = 1.06, duration = 700) {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(value, { toValue: max, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(value, { toValue: min, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]),
  );
}
