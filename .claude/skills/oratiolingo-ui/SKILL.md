---
name: oratiolingo-ui
description: Sistema de diseño, UX y animaciones de OratioLingo / SeñaPlay (app React Native para aprender Lengua de Señas Chilena). Úsala SIEMPRE que se cree o modifique cualquier pantalla, componente visual, estilo, color, tipografía, modal, botón, tarjeta, feedback de acierto/error, transición o animación de la app — aunque el usuario no diga "diseño" ni "UI" (ej. "haz que el quiz se vea mejor", "agrega una celebración al terminar el nivel", "el botón se ve feo en modo oscuro", "mejora la pantalla de perfil", "anima las vidas"). También para revisar accesibilidad o consistencia visual.
---

# OratioLingo UI / UX / Animaciones

OratioLingo (marca visible: **SeñaPlay**) enseña Lengua de Señas Chilena (LSCh) con niveles, juegos y cámara con IA. Muchos usuarios son personas Sordas o están aprendiendo a comunicarse con ellas, así que la interfaz es **visual primero**: todo feedback tiene que verse, no oírse.

Esta skill describe cómo se ve y se mueve la app *hoy* para que lo nuevo encaje. Antes de inventar un estilo, busca si ya existe en `src/components/ui/` o en una pantalla parecida.

## 1. Tema: nunca colores sueltos

Todo color sale del tema (`src/theme/palette.js`) vía `useAppTheme()`. La app tiene modo claro (violeta‑magenta) y oscuro (dorado‑ámbar) y el usuario lo cambia en caliente; un hex hardcodeado se ve bien en un modo y roto en el otro.

Patrón obligatorio en cada componente/pantalla:

```js
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { APP_FONTS } from '../../constants/fonts';
import { useAppTheme } from '../../theme/ThemeProvider';

export default function MiComponente() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // ...
}

function createStyles(theme) {
  return StyleSheet.create({
    card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  });
}
```

Tokens disponibles (`theme.colors.*`):

| Token | Uso |
|---|---|
| `background`, `backgroundSoft` | fondo de pantalla |
| `surface`, `border` | tarjetas, inputs, chips inactivos |
| `textPrimary`, `textSecondary` | títulos / cuerpo y subtítulos |
| `primary`, `primaryAlt`, `primaryStrong`, `primarySoft` | acento de marca (sólido, alterno, presionado, fondo suave) |
| `primaryContrast` | texto/icono sobre `primary` o sobre el degradé |
| `gold`, `goldDeep` | recompensas, estrellas, racha |
| `success`, `danger` | acierto / error |
| `navInactive` | iconos inactivos de la barra inferior |
| `overlay`, `shadow` | fondos de modal, sombras |

`theme.gradient` es el par `[inicio, fin]` para `LinearGradient` (botón primario, chip activo, tab activo, cabeceras). Úsalo con `start={{x:0,y:0}} end={{x:1,y:1}}` como el resto de la app. `theme.isDark` / `theme.mode` sirven para ajustes finos.

Si necesitas un color que no existe (ej. los tonos de `StatCard` o las variantes de `AdaptiveModal`), define **ambas** versiones (claro y oscuro) en el `createStyles`/mapa del componente, o agrega el token a `palette.js` en los dos temas. Ya hay ~270 hex sueltos en `src/screens/`; no sumes más — si tocas una pantalla con hex sueltos, migra los que toques.

## 2. Tipografía

Poppins se aplica globalmente (`applyPoppinsGlobally`), pero Android **no** sintetiza pesos: `fontWeight: '800'` sin `fontFamily` se ve regular. Para pesos distintos de 400 usa siempre `APP_FONTS` (o `poppins(peso)` de `src/constants/fonts.js`):

| Rol | Estilo |
|---|---|
| Título de pantalla / sección | `APP_FONTS.extraBold`, 22 |
| Título de tarjeta | `APP_FONTS.bold`, 16–18 |
| Botón | `APP_FONTS.bold`, 15–16 |
| Cuerpo | regular, 14–15 |
| Subtítulo / ayuda | `APP_FONTS.medium`, 13–14, `textSecondary` |
| Chip / etiqueta | `APP_FONTS.semiBold`, 12–13 |
| Número grande (stats) | `APP_FONTS.black`, 20+ |

`APP_FONTS.sign` (fuente ChileanSignLanguage) está obsoleta para mostrar señas: usa `SignImage`.

## 3. Forma y espaciado

- Radios: botones 12 · tarjetas 14 · modales/overlays 20 · chips y píldoras 999.
- Bordes de 1px con `theme.colors.border`; la jerarquía se hace con superficie + borde, las sombras son sutiles o nulas.
- Padding de tarjeta 12–16; separación entre bloques con `gap` (8–16) antes que márgenes sueltos.
- Respeta safe areas con `useSafeAreaInsets()` (ver `AppBottomNav`). Pantallas de cámara van a pantalla completa y gestionan sus propios márgenes.

## 4. Componentes existentes (reutiliza antes de crear)

Detalle de props y ejemplos en `references/components.md`. Resumen:

- `ui/ActionButton` — botón primario (degradé) o `variant="secondary"`; `gradientColors` para feedback verde/rojo.
- `ui/SurfaceCard` — contenedor base.
- `ui/SectionHeader` — título + subtítulo de sección.
- `ui/GameScreenHeader` — cabecera con back para juegos/niveles.
- `ui/FilterChip` — chip seleccionable.
- `ui/StatCard` — métrica con `tone` green/orange/blue/violet.
- `ui/SignImage` — imagen/GIF de una seña con carrusel manual y placeholder.
- `ui/FadeInView` — entrada fade + slide (requiere `key` que cambie).
- `AdaptiveModal` — modal de mensaje con presets por `context` (success, error, level-complete…).
- `LoadingOverlay` — spinner con texto para operaciones async.
- `AppBottomNav` — barra inferior de tabs.

Si un patrón aparece en 2+ pantallas, extráelo a `src/components/ui/` con el mismo estilo (default export, `createStyles(theme)`, comentario arriba explicando *por qué* existe).

## 5. UX para aprender señas

- **Feedback visual siempre.** Acierto/error se comunica con color (`success`/`danger`), icono, texto y movimiento. Nunca solo con sonido; si algún día hay sonido o vibración, es complemento.
- **La seña es la protagonista.** `SignImage` grande, con fondo neutro, sin elementos encima de la mano. Las flechas de variaciones van a los costados.
- **Nada se mueve solo.** Carruseles y GIFs los controla el usuario (ver comentario en `SignImage`). Timers visibles (quiz) deben mostrar claramente el tiempo restante.
- **Errores amables.** Mensajes en español neutro y cercano ("Casi, revisa la forma de la mano"), sin culpar. Tras un error, muestra la seña correcta.
- **Progreso visible.** Barra de progreso con degradé, vidas, racha y estrellas refuerzan la motivación estilo Duolingo.
- **Cámara/IA.** Explica qué hacer antes de abrir la cámara, muestra estado ("Buscando tu mano…"), y oculta predicciones de baja confianza en vez de mostrar resultados erróneos.
- Estados vacíos y de carga siempre diseñados: `LoadingOverlay` con texto concreto, placeholders con icono `hand-left-outline`.

## 6. Accesibilidad (checklist)

- Todo `Pressable` sin texto visible lleva `accessibilityRole="button"` y `accessibilityLabel` en español.
- Imágenes de señas: `accessibilityLabel="Seña de X"` (ya lo hace `SignImage`).
- Área táctil mínima ~44×44: usa `hitSlop={8}` en iconos chicos.
- Contraste: texto sobre degradé usa `primaryContrast`; no pongas `textSecondary` sobre `primarySoft` en tamaños < 13.
- No transmitas información solo con color: acompaña con icono o texto (✓ / ✕, "Correcto").
- Respeta "reducir movimiento" del sistema (ver `references/animations.md`).
- Textos con `numberOfLines` + `adjustsFontSizeToFit` cuando el espacio es fijo (tabs, chips).

## 7. Animaciones

La app usa la API `Animated` de React Native (Reanimated **no** está instalado). Lee `references/animations.md` antes de animar: tiene la escala de duraciones, curvas, recetas listas (entrada, pop‑in, shake de error, pulso, crossfade, presión de botón, lista escalonada, barra de progreso, celebración) y cuándo tendría sentido agregar Reanimated.

Reglas cortas:
- `useNativeDriver: true` siempre que animes `opacity`/`transform`. Solo colores/tamaños de layout usan `false` (y aíslalos en su propio `Animated.Value`).
- Duraciones cortas: 150–300 ms para UI; hasta ~600 ms solo para celebraciones o feedback de error.
- Anima para comunicar (entró algo, acertaste, perdiste una vida), no para decorar.

## 8. Antes de terminar

1. ¿Probaste mentalmente modo claro **y** oscuro? ¿Algún hex nuevo?
2. ¿Pesos tipográficos vía `APP_FONTS`?
3. ¿Reutilizaste componentes de `ui/`?
4. ¿Labels de accesibilidad y feedback no solo por color?
5. ¿Animaciones con native driver y respetando reducir movimiento?
