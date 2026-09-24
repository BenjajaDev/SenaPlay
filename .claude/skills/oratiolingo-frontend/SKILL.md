---
name: oratiolingo-frontend
description: Guía de desarrollo para OratioLingo / SeñaPlay — app móvil (Expo SDK 57 + React Native 0.86, JavaScript, arquitectura feature-first con capas domain/data/presentation), portal web (web/: Vite + React + TypeScript) y Supabase (migraciones + RLS). Úsala SIEMPRE que escribas, refactorices o depures código del proyecto — pantallas, hooks, repositorios, dominio, navegación, Supabase, AsyncStorage, config remota, feature flags, panel de administración, migraciones SQL, cámara/IA, dependencias o builds — aunque el pedido no diga "frontend" (ej. "agrega un juego", "el progreso no guarda", "nuevo tipo de ejercicio", "agrega un flag", "sección nueva en el panel", "instala X", "arregla este bug"). Para look & feel y animaciones, combínala con oratiolingo-ui.
---

# OratioLingo — desarrollo

Documentación completa en `docs/` (arquitectura, patrones, modelo, casos de uso, despliegue, trazabilidad, design system, config remota, guía). Léela antes de cambios estructurales.

## Stack y piezas

| Pieza | Dónde | Tecnología |
|---|---|---|
| App móvil | `App.js` → `src/app/AppRoot.js` | Expo 57, RN 0.86, React 19, JS, pnpm, dev client (EAS) |
| Portal web | `web/` (proyecto pnpm independiente) | Vite 8, React 19, TS 5.9, React Router 7 |
| Backend | `supabase/` (+ `migrations/`, `tests/`) | Postgres + Auth + Storage + RLS |
| IA | `ai_module/` | Python, FastAPI, MediaPipe (URL en `EXPO_PUBLIC_AI_SERVER_URL`) |

## Arquitectura de la app (feature-first + capas)

```
src/app/                 AppRoot (providers), RootNavigator (máquina de estados de auth), MainAppScreen (tabs/juegos/niveles)
src/core/                config/env · di/ServicesProvider · events/EventBus · storage/jsonStorage · supabase/client · feedback/haptics · a11y · result
src/shared/theme|ui/     tokens + ThemeProvider · design system (ver skill oratiolingo-ui)
src/features/<módulo>/
  domain/                JS PURO: reglas y entidades (sin React, sin Supabase) — testeado con Jest
  data/                  repositorios: remoto → caché → local; devuelven Result {ok, value, error} o datos con `source`
  presentation/          pantallas, hooks y componentes del módulo
```

Módulos: `auth`, `levels`, `progress`, `signs`, `dictionary`, `games`, `camera`, `profile`, `videos`, `remoteConfig`.

**Reglas de dependencia (no romperlas):**
- La UI pide servicios con `useServices()` (auth, profile, catalog, progress, signs, media, remoteConfig, events). **Nunca** importa `core/supabase/client` fuera de `features/*/data` o `core/di`.
- `domain/` no importa React, RN, Supabase ni AsyncStorage (el portal web lo reutiliza vía alias `@domain`).
- Solo `core/di/ServicesProvider.js` elige implementaciones concretas (composition root).

## Patrones en uso (seguir el mismo estilo)

- **Repository**: `createXRepository({ supabase, storage, ... })`, try/catch, nunca lanza hacia la UI; errores con `toUserMessage` (español).
- **Factory/Builder**: ejercicios SIEMPRE pasan por `ExerciseFactory`; niveles por `LevelBuilder` (`.lenient()` en la app).
- **State Machine**: `levels/domain/sessionMachine.js` (reducer puro) + `useLevelSession` (efectos). Nuevas reglas de juego → reducer + test.
- **Observer**: `appEvents` (`APP_EVENTS.LEVEL_COMPLETED`, `LIFE_LOST`, `REMOTE_CONFIG_UPDATED`…). Emite desde quien sabe qué pasó; escucha en hooks (`useUserProgress`).
- **Strategy**: `levels/presentation/exercises/index.js` (tipo → componente).

## Recetas

- **Tipo de ejercicio nuevo**: `domain/exerciseTypes.js` → `domain/evaluateAnswer.js` (+ test) → componente en `presentation/exercises/` con contrato `{ exercise, answer, onAnswerChange, disabled, onHint }` → registrar en `exercises/index.js` → agregar al `check` de `supabase/migrations/*_content_admin.sql`. El editor del panel lo muestra solo.
- **Juego nuevo**: pantalla con `ScreenHeader`, entrada en `GAMES` de `games/presentation/GamesTabScreen.js` con `flag`, flag en `DEFAULT_FLAGS` y fila en `feature_flags`; montar en `MainAppScreen` (`CAMERA_GAMES` si usa cámara).
- **Clave de config remota**: `DEFAULT_REMOTE_CONFIG` (remoteConfig/domain) → leer con `useRemoteConfig().config` → sección en `web/src/features/admin/config/RemoteConfigPage.tsx` y tipo en `web/src/lib/domain.ts` → documentar en `docs/08`.
- **Flag**: `DEFAULT_FLAGS` + `useFeatureFlag('modulo.nombre')`.
- **Tabla/cambio de BD**: nueva migración `supabase/migrations/<timestamp>_<nombre>.sql` idempotente (`if not exists`, `drop policy if exists`), RLS con `is_staff()` / `is_admin()`, y casos en `supabase/tests/10_rls_policies.sql`.
- **Preferencia local**: `jsonStorage` + `storageKey('area', 'v1', userId)`.
- **Página del panel**: `web/src/features/admin/...`, datos por `useRepositories()` (DI), carga con `useResource`, acciones destructivas/publicación con `useFeedback().confirm({ onConfirm })`, ruta lazy en `web/src/App.tsx` (+ `RequireStaff admin` si aplica).

## Navegación

Por estado (sin React Navigation): `RootNavigator` (loading/login/register/verify/resetPassword/main + gate remoto) y `MainAppScreen` (`activeTab`, `activeGame`, `activeLevelId`). Cada destino en `FadeInView key=…`. Migrar a React Navigation es una decisión grande: proponerla antes.

## Convenciones

- Código en inglés; textos de UI y comentarios en español de Chile (tildes y ñ). Comentarios explican el **por qué**.
- Componentes función, default export; estilos con `createStyles(theme)` (ver oratiolingo-ui).
- Efectos async con bandera `mounted` y cleanup; listeners siempre desuscritos.
- Claves públicas solamente (`EXPO_PUBLIC_*`, `VITE_*`); nunca service key en clientes.
- Dependencias: `pnpm add <pkg>@~<versión SDK 57>` (el proxy bloquea la API de `expo install`; elegir la línea 57.x para módulos expo-*). Módulo nativo nuevo ⇒ avisar que hay que regenerar el dev client.
- `@supabase/supabase-js` está fijado en 2.105.4: ≥ 2.106 rompe la compilación Hermes (import dinámico).

## Verificación antes de entregar (obligatoria)

1. `pnpm test` (Jest: dominio, design system, pantallas, sesión de nivel).
2. `pnpm verify:bundle` (bundle Android + Hermes).
3. Si tocaste SQL: `pnpm test:sql` (necesita Postgres local; ver `docs/09`).
4. Si tocaste `web/`: `cd web && pnpm typecheck && pnpm test && pnpm build`.
5. Si tocaste diagramas: `node scripts/checkMermaid.cjs`.
6. Relee el diff: supabase fuera de data/, hex sueltos, acciones críticas sin `confirm`, efectos sin cleanup.

## Git

Rama `gestilingo-dev`; Conventional Commits en español (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`). Para mover archivos usa `node scripts/moveModules.cjs moves.json` (reescribe imports).
