# Animaciones en SeñaPlay

La app anima con la API `Animated` de React Native. Ejemplos reales para copiar el estilo:
- `src/shared/ui/motion/FadeInView.js` y `StaggerItem.js` — entrada fade + slide y escalonada.
- `src/shared/ui/motion/animations.js` — recetas `shake`, `pulse`, `popIn`, `fadeTo`, `breathe`.
- `src/shared/ui/feedback/BlockingOverlay.js` / `Dialog.js` — pop‑in con `Easing.back`.
- `src/features/signs/presentation/SignImage.js` — crossfade entre variaciones.
- `src/features/levels/presentation/session/` — `LivesCounter` (temblor sutil + desvanecimiento), `FeedbackPanel` (borde luminoso), `HintFab` (globo), `Confetti` y `LevelCompleteCelebration`.

## Índice
1. Escala de movimiento
2. Reglas técnicas
3. Reducir movimiento (accesibilidad)
4. Recetas
5. ¿Cuándo agregar Reanimated / Lottie?

## 1. Escala de movimiento

| Token | Duración | Uso |
|---|---|---|
| `instant` | 100–120 ms | feedback de presión (scale del botón) |
| `fast` | 150–180 ms | crossfades, chips, cambios pequeños |
| `base` | 200–280 ms | entradas de pantalla/tab, modales, pistas |
| `emphasis` | 400–600 ms | pérdida de vida, acierto destacado, barra de progreso |
| `celebration` | 600–1200 ms | nivel completado (una vez, nunca en loop infinito) |

Curvas:
- Entrar: `Easing.out(Easing.cubic)`.
- Salir: `Easing.in(Easing.cubic)` y un poco más rápido que la entrada.
- Pop con rebote leve: `Easing.out(Easing.back(1.4))` o `Animated.spring({ friction: 6, tension: 120 })`.
- Evita `linear` salvo en spinners y timers.

Estas duraciones y curvas existen como tokens: `theme.motion.duration.*` y `theme.motion.easing.*` (ver `src/shared/theme/tokens/scales.js`). Úsalos en vez de números sueltos.

## 2. Reglas técnicas

- `useRef(new Animated.Value(x)).current` para crear valores; nunca `new Animated.Value` directo en el render.
- `useNativeDriver: true` para `opacity` y `transform`. El driver nativo **no** soporta `backgroundColor`, `width`, `height`, `borderColor`… Para esos usa `false`, en un `Animated.Value` separado (como `wrongFlash` en `LevelSessionScreen`), y no los mezcles en el mismo `Animated.parallel` con valores nativos del **mismo** valor.
- Barra de progreso: anima `transform: [{ scaleX }]` con `transformOrigin: 'left'` (o un `translateX`) en vez de `width` para quedarte en el driver nativo.
- Reinicia con `.setValue()` antes de volver a disparar (patrón de `triggerLifeAnimation`).
- Detén animaciones en loop al desmontar: guarda la referencia de `Animated.loop(...)` y llama `.stop()` en el cleanup del `useEffect`.
- Las pantallas de cámara (`signCamera`, `handTrackingHtml`) ya cargan el hilo JS: ahí anima poco y solo con native driver.
- `FadeInView` se dispara al montar: para re-animar al cambiar de tab pásale `key={activeTab}`.

## 3. Reducir movimiento

Algunas personas se marean con movimiento. Usa el hook `src/core/a11y/useReducedMotion.js` (ya existe) en toda animación nueva. Su implementación:

```js
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Respeta el ajuste "Reducir movimiento" del sistema. Con él activo, las
// animaciones deben saltar al estado final (o limitarse a un fade corto).
export default function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
```

Con `reduced === true`: reemplaza shakes, rebotes y slides por un fade de ≤150 ms o por `setValue(final)` directo. El feedback visual (color, icono, texto) se mantiene igual: lo que se quita es el movimiento, no la información.

## 4. Recetas

### Entrada de contenido (tab, tarjeta)
Usa `FadeInView` (`duration` 200, `distance` 10). Para listas, ver "lista escalonada".

### Pop‑in (modal, badge, estrella ganada)
```js
scale.setValue(0.9);
opacity.setValue(0);
Animated.parallel([
  Animated.timing(scale, { toValue: 1, duration: 220, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
  Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
]).start();
```

### Presión de botón (feedback táctil)
```js
const pressScale = useRef(new Animated.Value(1)).current;
const animateTo = (toValue) =>
  Animated.spring(pressScale, { toValue, friction: 7, tension: 200, useNativeDriver: true }).start();

<Pressable onPressIn={() => animateTo(0.96)} onPressOut={() => animateTo(1)} onPress={onPress}>
  <Animated.View style={{ transform: [{ scale: pressScale }] }}>{/* contenido */}</Animated.View>
</Pressable>
```
Si lo necesitas en varios lugares, agrégalo como opción de `ActionButton` en vez de copiarlo.

### Shake de error (respuesta incorrecta, vida perdida)
```js
const shake = (value) =>
  Animated.sequence(
    [12, -12, 10, -8, 6, 0].map((toValue) =>
      Animated.timing(value, { toValue, duration: 50, useNativeDriver: true }),
    ),
  );
```
Aplícalo con `transform: [{ translateX: value }]`. Acompaña siempre con color `danger` + texto.

### Pulso (llamar la atención una vez)
```js
Animated.sequence([
  Animated.timing(pulse, { toValue: 1.15, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
  Animated.timing(pulse, { toValue: 1, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
]).start();
```
Para "respira" en loop (ej. botón de grabar con cámara) usa `Animated.loop` y detenlo al desmontar o al empezar a grabar.

### Crossfade (cambiar imagen de seña, cambiar ejercicio)
Fade out 160 ms → cambiar estado en el callback de `.start()` → fade in 160 ms (ver `SignImage.goTo`).

### Lista escalonada
```js
const items = useRef(data.map(() => new Animated.Value(0))).current;
useEffect(() => {
  Animated.stagger(
    50,
    items.map((v) => Animated.timing(v, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true })),
  ).start();
}, []);
// cada fila: opacity: v, translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] })
```
Limita a los primeros ~8 elementos visibles; el resto aparece sin animación.

### Barra de progreso
```js
Animated.timing(progress, {
  toValue: current / total,
  duration: 450,
  easing: Easing.out(Easing.cubic),
  useNativeDriver: true,
}).start();
// barra interna: LinearGradient con theme.gradient y
// style={{ transform: [{ scaleX: progress }], transformOrigin: 'left' }}
```

### Acierto
Tarjeta/opción correcta: escala 1 → 1.05 → 1 (spring) + borde/fondo `success` + icono ✓. Botón "Continuar" con `gradientColors` verde. Corto (≤ 400 ms): el usuario va a acertar muchas veces por sesión.

### Celebración (nivel completado)
Una sola vez: pop‑in del modal (`AdaptiveModal` context `level-complete`) + estrellas que aparecen con `stagger` (120 ms) y pop con `Easing.back`. Sin loops infinitos ni confeti que tape el contenido.

## 5. ¿Cuándo agregar Reanimated / Lottie?

`Animated` alcanza para todo lo anterior. Considera **react-native-reanimated** solo si hay animaciones guiadas por gestos (arrastrar cartas, swipe de tarjetas) o si el hilo JS está ocupado (cámara + IA) y las animaciones se traban. Para instalarlo usa `npx expo install react-native-reanimated react-native-worklets` (versiones compatibles con el SDK), revisa la guía de Expo del SDK actual, y reconstruye el development client (`pnpm build:dev`): es un módulo nativo.

**Lottie** (`lottie-react-native`) sirve para ilustraciones animadas (mascota, celebración) hechas por un diseñador; no la uses para animaciones de UI simples.

Ambas son decisiones de dependencia: propónlas al usuario antes de instalarlas.
