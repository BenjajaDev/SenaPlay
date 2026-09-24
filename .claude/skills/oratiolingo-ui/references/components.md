# Catálogo de componentes UI

Todos usan `useAppTheme()` + `createStyles(theme)` y se adaptan solos a claro/oscuro. Rutas relativas a `src/components/`.

## ui/ActionButton
Botón principal de la app.
- `label` (string), `onPress`, `disabled`
- `variant`: `'primary'` (degradé de marca, texto `primaryContrast`) | `'secondary'` (superficie + borde `primary`)
- `gradientColors`: pisa el degradé; úsalo para feedback (`[theme.colors.success, theme.colors.success]`, `[theme.colors.danger, theme.colors.danger]`)
- `style`, `textStyle`
- Radio 12, padding 12×14, `disabled` baja la opacidad a 0.55.

```js
<ActionButton label="Comprobar" onPress={check} disabled={!answer} />
<ActionButton label="Más tarde" variant="secondary" onPress={close} />
```

## ui/SurfaceCard
`<SurfaceCard style>` — fondo `surface`, borde `border`, radio 14. Contenedor base para tarjetas; agrega padding vía `style`.

## ui/SectionHeader
`title`, `subtitle?`. Título extraBold 22 + subtítulo medium 14. Úsalo al inicio de cada tab.

## ui/GameScreenHeader
`title`, `onBack`, `rightNode?` (ej. contador de vidas o puntaje). Flecha atrás con `hitSlop`. Cabecera estándar de juegos y sesiones de nivel.

## ui/FilterChip
`label`, `selected`, `onPress`. Seleccionado = degradé; inactivo = superficie + borde. Radio 999.

## ui/StatCard
`label`, `value`, `tone`: `'violet' | 'green' | 'orange' | 'blue'`. Los tonos tienen versión clara y oscura definida en el propio componente; sigue ese patrón si agregas un tono.

## ui/SignImage
Muestra la seña (imagen/GIF de `src/data/signAssets.js`).
- `signKey` (ej. `'a'`, `'hola'`), `label?`, `size` (default 72), `rounded` (default 14), `showPlaceholderIcon`
- Varias fotos → flechas + puntos, crossfade de 160 ms; nada se mueve solo.
- Sin asset → placeholder punteado con la letra/palabra (no parece error).
- Ya trae `accessibilityLabel`.

## ui/FadeInView
`duration` (200), `distance` (10), `style`. Anima al **montar**: pasa una `key` que cambie con el contenido (`key={activeTab}`).

## AdaptiveModal
Modal de mensaje centrado.
- `visible`, `context` (preset), `title?`, `message?`, `variant?`, `primaryText?`, `secondaryText?`, `autoCloseMs?`, `onPrimaryPress`, `onSecondaryPress`, `onRequestClose`
- Presets de `context`: `login-success`, `register-success`, `email-verification-sent`, `email-verification-required`, `password-updated`, `validation`, `auth-error`, `level-complete`
- Variantes: `info`, `success`, `warning`, `error`, `celebration`
- Si necesitas un mensaje recurrente nuevo, agrégalo como preset en `CONTEXT_PRESETS` en vez de pasar título/mensaje a mano en cada pantalla.
- Ojo: `VARIANT_STYLES` usa colores fijos (pensados para modo claro); si trabajas en el modal, dales versión oscura.

## LoadingOverlay
`visible`, `label` ("Guardando cambios…"). Modal con spinner y pop‑in. Úsalo para cualquier espera > ~300 ms iniciada por el usuario; el texto dice qué pasa.

## AppBottomNav
`activeTab`, `onChangeTab`. Tabs definidas en `TABS` (key, label, icon, activeIcon de Ionicons). Tab activa = badge con degradé. Respeta `insets.bottom`.

## SignDetailModal / ProfileActionsModal
Modales específicos (detalle de seña del diccionario, acciones de perfil). Revísalos como referencia de modal tipo hoja.

## Iconos
`Ionicons` de `@expo/vector-icons`. Convención: variante `-outline` para estado inactivo, sólida para activo. Iconos de dominio usados: `hand-left-outline` (seña), `layers` (niveles), `book` (diccionario), `videocam`, `game-controller`, `analytics`, `flash-outline` (quiz), `extension-puzzle-outline` (memoria).
