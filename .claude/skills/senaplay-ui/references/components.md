# Catálogo de componentes (`src/shared/ui`)

Todos usan `useAppTheme()` y funcionan en claro/oscuro. Importar desde el índice: `import { Button, Card } from '<ruta>/shared/ui'`.

## Átomos

| Componente | Props clave | Notas |
|---|---|---|
| `AppText` | `variant` (display, title, heading, body, bodyStrong, subtitle, caption, label, button, stat), `tone` (primary, secondary, muted, brand, inverse, success, danger, warning, info, gold), `align` | reemplaza fontSize/fontWeight/color sueltos |
| `Button` | `label`, `onPress`, `variant` (primary, secondary, ghost, danger, success), `size` (sm, md, lg), `icon`, `iconPosition`, `loading`, `disabled`, `fullWidth`, `haptic` | escala al presionar, borde de foco, bloquea doble envío en `loading` |
| `IconButton` | `icon`, `label` (obligatorio), `variant` (ghost, soft, solid, surface), `size`, `haptic` | área táctil ≥ 44 |
| `Card` | `variant` (surface, raised, gradient, brand), `tone` (success, danger, warning, info), `padding` (none, sm, md, lg, xl), `onPress`, `accessibilityLabel` | presionable con estado pressed/focus |
| `TextField` | `label`, `value`, `onChangeText`, `error`, `helper`, `icon`, `secureTextEntry`, `multiline`, `disabled`, `right` | foco con halo, error con icono y región viva, mostrar/ocultar contraseña |
| `Chip` | `label`, `selected`, `onPress`, `icon` | seleccionado = degradé + ✓ |
| `Badge` | `label`, `tone` (brand, success, warning, danger, info, neutral), `icon` | `difficultyBadgeProps(dificultad)` |
| `SegmentedControl` | `options [{key,label}]`, `value`, `onChange` | 2–4 opciones excluyentes |
| `ProgressBar` | `value` 0–1, `gradient`, `height`, `label` | anima `scaleX` con native driver |

## Moléculas

`SectionHeader` (title, subtitle, right) · `ScreenHeader` (title, onBack, rightNode, backLabel) · `StatCard` (label, value, tone: green/orange/blue/violet/gold, icon) · `EmptyState` (icon, title, message, actionLabel, onAction).

## Carga

`Spinner` (size, label) — anillo de marca + mano; cae a ActivityIndicator con reducir movimiento · `Skeleton` (width, height, radius) · `SkeletonCard` · `SkeletonList` (count, lines, label) · `BlockingOverlay` (visible, label) — normalmente vía `runBlocking`.

## Feedback

| Componente / API | Uso |
|---|---|
| `useFeedback().confirm({ title, message, tone, icon, confirmLabel, cancelLabel, onConfirm })` → `Promise<boolean>` | acciones críticas |
| `useFeedback().runBlocking(label, tarea)` | esperas con bloqueo (mín. 450 ms) |
| `useFeedback().notify({ tone, title, message })` | toast no bloqueante + vibración + anuncio |
| `useFeedback().showMessage({ context \| title, message, variant })` → `'primary'\|'secondary'\|'dismiss'` | mensajes con presets (`MESSAGE_PRESETS`) |
| `Dialog` | base visual de diálogos (tone: info, success, warning, danger, celebration, brand) |
| `MessageDialog` | API de la antigua AdaptiveModal (context, variant, primaryText, secondaryText…) |
| `BottomSheet` | formularios (visible, title, onClose, dismissible, footer) |

## Movimiento

`FadeInView` (duration, distance, delay; re-anima al remontar con `key`) · `StaggerItem` (index; escalona hasta 8) · `animations.shake|pulse|popIn|fadeTo|breathe`.

## Específicos de niveles (`features/levels/presentation`)

`exercises/OptionTile` (state: idle, selected, matched, empty) · `SignStrip` / `SignSpotlight` (long-press = pista) · `session/LivesCounter` · `session/FeedbackPanel` (borde luminoso) · `session/HintFab` + `HintPopover` · `session/LevelCompleteCelebration` + `Confetti`.

## Otros

`features/signs/presentation/SignImage` (signKey, size, rounded; carrusel manual de variaciones y placeholder) · `app/navigation/AppBottomNav` (tabs con flag remoto) · `features/remoteConfig/presentation/AnnouncementBanner` · `AppGateScreen`.
