---
name: senaplay-ui
description: Sistema de diseño, UX, accesibilidad y animaciones de SeñaPlay (app React Native para aprender Lengua de Señas Chilena y su portal web). Úsala SIEMPRE que se cree o modifique cualquier pantalla, componente visual, estilo, color, degradé, tipografía, modal/diálogo, confirmación, botón, tarjeta, input, carga (spinner/skeleton), feedback de acierto/error, vibración, transición o animación — en la app o en web/ — aunque el usuario no diga "diseño" ni "UI" (ej. "haz que el quiz se vea mejor", "agrega una celebración", "el botón se ve feo en modo oscuro", "pide confirmación antes de borrar", "anima las vidas", "muestra que está cargando"). También para revisar accesibilidad o consistencia visual.
---

# SeñaPlay UI / UX / Animaciones

SeñaPlay enseña LSCh. Muchos usuarios son personas Sordas: la interfaz es **visual primero** y todo feedback es **multimodal** (color + icono + texto + vibración + anuncio al lector de pantalla), nunca solo audio ni solo color.

Referencia completa: `docs/07-design-system.md`. Detalle de componentes: `references/components.md`. Animaciones: `references/animations.md`.

## 1. Tokens (fuente única: `src/shared/theme/tokens/`)

`const theme = useAppTheme()` expone `colors`, `gradients`, `spacing`, `radius`, `typography`, `motion`, `elevation`, `minTouch`, `isDark`. Patrón obligatorio:

```js
const theme = useAppTheme();
const styles = useMemo(() => createStyles(theme), [theme]);
function createStyles(theme) {
  const { colors, spacing, radius } = theme;
  return StyleSheet.create({ card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg } });
}
```

- **Prohibidos los hex sueltos** en pantallas. Si falta un color, agrégalo en AMBOS temas de `tokens/colors.js` (`contrast.test.js` falla si falta en uno o si no cumple AA). Excepciones documentadas: logo sobre blanco y `cameraColors`/`cameraAlpha` (escenario de cámara).
- Colores de estado: `success|danger|warning|info` = relleno; texto con `*Text`; texto sobre relleno con `on*`; fondos suaves `*Soft`.
- Degradés por intención con `<LinearGradient {...theme.gradients.brand} />`: `brand` (botón/selección), `brandVivid` (barras, sin texto chico), `header` (cabeceras; texto `onHeader`), `card`, `reward`, `success`, `danger`, `celebration`.
- Radios: `md 12` botones/inputs · `lg 14` tarjetas · `xl 20` diálogos · `xxl 24` hojas · `pill`. Tipografía: `theme.typography.<variant>` o `<AppText variant tone>`; nunca `fontWeight` sin familia (Android no sintetiza pesos).
- Web: las mismas variables CSS (`--color-*`, `--gradient-*`) generadas por `web/scripts/syncTokens.mjs`.

## 2. Componentes (`import { … } from '../../../shared/ui'`)

Reutiliza antes de crear: `AppText`, `Button` (primary/secondary/ghost/danger/success + loading), `IconButton` (label obligatorio), `Card` (surface/raised/gradient/brand/tone, `onPress`), `TextField` (label visible, error con icono), `Chip`, `Badge`, `SegmentedControl`, `ProgressBar`, `SectionHeader`, `ScreenHeader`, `StatCard`, `EmptyState`, `Spinner`, `Skeleton*`, `Dialog`, `MessageDialog` (presets), `BottomSheet`, `FadeInView`, `StaggerItem`, `animations`. Web: `web/src/ui` con la misma API conceptual.

## 3. Feedback y asincronía (reglas del producto)

```js
const { confirm, runBlocking, notify, showMessage } = useFeedback();
```

- **Acción crítica ⇒ `confirm()`** (cerrar sesión, guardar edición, eliminar, salir de un nivel a medias, publicar, canjes). Con `onConfirm` la acción corre dentro del diálogo con botón en carga. Tono `danger` para destructivas.
- **Espera iniciada por el usuario ⇒ `runBlocking('Guardando…', tarea)`**; carga de listas ⇒ skeletons; nunca un spinner sin texto.
- **Resultado ⇒ `notify()`** (toast) o `showMessage({ context })`; errores de repositorio ya vienen en español (`result.error`).
- Validación de formularios: error junto al campo (`TextField error`), no un modal por error. Respuesta incompleta en juegos: aviso, **sin castigo**.

## 4. Accesibilidad (checklist)

- `accessibilityRole` + `accessibilityLabel` en español en todo control sin texto; `accessibilityState` (selected/disabled/busy).
- Área táctil ≥ 44 px (`IconButton` ya lo garantiza con hitSlop).
- Estado nunca solo por color: icono ✓/✕/candado + texto.
- Vibración con intención: `haptics.success|error|warning|selection|tap|celebrate` (respeta preferencia del usuario y flag remoto).
- Anuncios: `announce(texto)` junto al feedback visual.
- `useReducedMotion()` en toda animación nueva.

## 5. UX para aprender señas

- La seña es protagonista: `SignImage` grande, fondo neutro, nada encima de la mano, nada se mueve solo.
- Pistas: botón flotante con ampolleta (`HintFab` + `HintPopover`, no bloquean) y mantener presionada una seña.
- Errores amables ("Casi…", "¡Casi lo logras!"); pérdida de vida sutil (temblor 6 px + desvanecimiento).
- Progreso visible y celebración al completar (confeti con flag `levels.celebration`).

## 6. Animaciones

`Animated` + native driver (Reanimated no está instalado). Duraciones de `theme.motion.duration` (fast 160, base 220, emphasis 480); curvas `theme.motion.easing`. Recetas en `references/animations.md` y `shared/ui/motion/animations.js`. Anima para comunicar, no para decorar.

## 7. Antes de terminar

Modo claro y oscuro · sin hex nuevos · tipografía por variante · componentes de `shared/ui` · `confirm` en acciones críticas · skeleton/overlay en esperas · labels y roles · feedback multimodal · reducir movimiento · `pnpm test` (incluye `contrast.test.js`).
