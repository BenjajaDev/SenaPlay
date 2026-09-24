# 6. Matriz de trazabilidad

Cada requerimiento se enlaza con los módulos que lo implementan, los endpoints o recursos de Supabase que usa y la prueba que lo verifica.

**Convenciones de endpoints**
- `REST` → PostgREST (`/rest/v1/<tabla>`).
- `RPC` → `/rest/v1/rpc/<función>`.
- `AUTH` → `/auth/v1/*`.
- `STORAGE` → `/storage/v1/object/<bucket>`.
- `IA` → servidor Python.

## 6.1 Arquitectura y patrones

| ID | Requerimiento | Módulos | Endpoints / recursos | Verificación |
|---|---|---|---|---|
| RA-01 | Arquitectura desacoplada por capas (feature-first) | `src/features/*/{domain,data,presentation}`, `src/core`, `src/shared` | — | [01-arquitectura](01-arquitectura.md) · `pnpm verify:bundle` |
| RA-02 | Patrón Repository | `features/*/data/*Repository.js`, `web/src/data/repositories.ts` | REST `levels`, `exercises`, `dictionary`, `signs`, `media`, `app_config`, `feature_flags` | `src/core/__tests__/core.test.js`, `web/src/test/repositories.test.ts` |
| RA-03 | Factory / Builder de entidades | `ExerciseFactory.js`, `LevelBuilder.js` | RPC `save_level` | `levels.domain.test.js` (valida el catálogo completo) |
| RA-04 | State Machine / Observer | `sessionMachine.js`, `RootNavigator.js`, `EventBus.js`, `useUserProgress.js` | — | `levels.domain.test.js`, `core.test.js`, `LevelSessionScreen.test.js` |
| RA-05 | Componentes atómicos y reutilizables | `src/shared/ui/*`, `web/src/ui/*` | — | `designSystem.test.js` |

## 6.2 Sistema de diseño

| ID | Requerimiento | Módulos | Verificación |
|---|---|---|---|
| DS-01 | Inputs, tarjetas y botones unificados, con estados pressed, hover y disabled | `Button`, `TextField`, `Card`, `IconButton`, `Chip` (móvil) · `ui/Button`, `ui/Fields`, `ui/Display` (web) | `designSystem.test.js` («Button no dispara cargando») |
| DS-02 | Radios consistentes | `tokens/scales.js` → `radius` · `--radius-*` (web) | [07-design-system](07-design-system.md) |
| DS-03 | Tokens de color globales | `tokens/colors.js` → `useAppTheme()` · `tokens.generated.css` (web) | `contrast.test.js` (40+ pares AA en ambos temas) |
| DS-04 | Degradés armónicos (tarjetas, botones y encabezados) | `tokens/gradients.js` (`brand`, `header`, `card`, `reward`, `celebration`…) | `contrast.test.js` (texto sobre degradé ≥ 4.5) |

## 6.3 Feedback y gestión asíncrona

| ID | Requerimiento | Módulos | Endpoints | Verificación |
|---|---|---|---|---|
| FB-01 | Confirmación de acciones críticas | `FeedbackProvider.confirm()`: cerrar sesión (`MainAppScreen`), guardar perfil y foto (`ProfileTabScreen`), salir de un nivel, reiniciar o salir de memoria · web: eliminar, publicar, cambiar rol, mantenimiento | AUTH `logout` · AUTH `user` · REST `*` DELETE/PATCH | `designSystem.test.js`, `LevelSessionScreen.test.js`, `web/src/test/ui.test.tsx` |
| FB-02 | Spinner temático | `loading/Spinner.js` · `ui/Display.Spinner` | — | render en `designSystem.test.js` |
| FB-03 | Skeleton loaders | `loading/Skeleton.js` (niveles, diccionario, progreso, videos) · `SkeletonRows` (web) | — | `screens.smoke.test.js` |
| FB-04 | Bloqueo de pantalla en operaciones async | `BlockingOverlay` + `runBlocking()` (login, registro, OTP, guardar) | AUTH `token`, `signup`, `verify` | `designSystem.test.js` («runBlocking») |

## 6.4 Portal web

| ID | Requerimiento | Módulos (web) | Endpoints | Verificación |
|---|---|---|---|---|
| PW-01 | Landing responsiva con características, métricas y descargas | `features/landing/LandingPage.tsx` | RPC `public_stats` | `ui.test.tsx`, capturas 390/1366 px |
| PW-02 | Gestor de medios: carga, vista previa, categorización y publicación | `admin/media/MediaPage.tsx`, `createMediaRepository` | STORAGE `media` · REST `media` | `repositories.test.ts` (limpieza de huérfanos) |
| PW-03 | CRUD de niveles, lecciones, vocabulario y pistas | `LevelsPage`, `LevelEditorPage`, `ExerciseEditor`, `DictionaryPages` | RPC `save_level` · REST `levels`, `exercises`, `dictionary`, `signs` | `ui.test.tsx`, `repositories.test.ts`, SQL `10_rls_policies.sql` |
| PW-04 | Modo mantenimiento y avisos globales | `RemoteConfigPage` → `maintenance`, `announcements` · app: `AppGateScreen`, `AnnouncementBanner` | REST `app_config` | `remoteConfig.test.js`, `ui.test.tsx` |
| PW-05 | Recarga de vidas y penalizaciones | `RemoteConfigPage` → `lives`, `scoring` · app: `livesPolicy`, `scoring` | REST `app_config` | `progress.domain.test.js`, `levels.domain.test.js` |
| PW-06 | Módulos experimentales y eventos temporales | `FeatureFlagsPage` · app: `evaluateFlags`, `GamesTabScreen`, `AppBottomNav` | REST `feature_flags` | `remoteConfig.test.js` (ventanas y rollout) |
| PW-07 | Umbrales de dificultad y versión mínima | `RemoteConfigPage` → `difficulty`, `appVersion` · app: Quiz, cámara, `AppGateScreen` | REST `app_config` | `remoteConfig.test.js` |
| PW-08 | Seguridad del backoffice | `RequireStaff`, `AuthProvider` · SQL `is_staff()`, `is_admin()`, RLS | AUTH · REST `profiles` | `pnpm test:sql` |
| PW-09 | Auditoría de configuración | `AuditPage` · trigger `audit_config_change` | REST `config_audit` | `10_rls_policies.sql` |

## 6.5 Experiencia móvil

| ID | Requerimiento | Módulos | Verificación |
|---|---|---|---|
| MX-01 | Feedback multimodal (háptica + visual) | `core/feedback/haptics.js`, `FeedbackPanel` (borde luminoso), `MessageDialog`, `Toast`, juegos | `LevelSessionScreen.test.js` |
| MX-02 | Lector de pantalla y contraste WCAG 2.1 AA | `core/a11y/announce.js`, `accessibilityLabel` y roles en todos los componentes · `contrast.test.js` | `contrast.test.js`, consultas por rol y label en tests |
| MX-03 | Subtítulos y tipografía legible | `VideosTabScreen` (insignia CC), `MediaPage` (pista `.vtt`), `typography` (Poppins por peso) | [07-design-system](07-design-system.md) |
| MX-04 | Transiciones suaves entre pestañas y rutas | `FadeInView` con key por destino (`MainAppScreen`, `RootNavigator`), `AppBottomNav` animado | revisión manual |
| MX-05 | Entrada escalonada | `StaggerItem` (niveles, juegos, progreso, videos) | revisión manual |
| MX-06 | Celebración al completar | `LevelCompleteCelebration` + `Confetti` (flag `levels.celebration`) | `LevelSessionScreen.test.js` |
| MX-07 | Pérdida de vida no punitiva | `LivesCounter` (temblor de 6px y desvanecimiento), mensaje «¡Casi lo logras!» | `LevelSessionScreen.test.js` |
| MX-08 | Pistas con botón flotante y globo contextual | `session/HintFab.js` (`HintFab`, `HintPopover`) | `LevelSessionScreen.test.js` («Ver pista») |
| MX-09 | Reducir movimiento | `useReducedMotion` en todas las animaciones · `prefers-reduced-motion` (web) | revisión manual |

## 6.6 Documentación

| ID | Requerimiento | Documento |
|---|---|---|
| DOC-01 | Trazabilidad | este archivo |
| DOC-02 | Diagrama de arquitectura | [01-arquitectura](01-arquitectura.md) |
| DOC-03 | Diagrama de patrones | [02-patrones-de-diseno](02-patrones-de-diseno.md) |
| DOC-04 | Diagrama de clases | [03-modelo-de-dominio](03-modelo-de-dominio.md) |
| DOC-05 | Casos de uso | [04-casos-de-uso](04-casos-de-uso.md) |
| DOC-06 | Despliegue | [05-despliegue](05-despliegue.md) |
