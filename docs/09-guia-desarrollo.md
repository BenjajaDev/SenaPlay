# 9. Guía de desarrollo

## 9.1 Requisitos

- Node 22 y pnpm 10.
- Android: un *development build* (`pnpm build:dev`). La cámara y los módulos nativos, como `expo-haptics`, no funcionan en Expo Go.
- PostgreSQL 15+ local (opcional) para `pnpm test:sql`.
- Python 3.11 (opcional) para `ai_module/`.

## 9.2 Comandos

### App móvil (raíz)

| Comando | Qué hace |
|---|---|
| `pnpm install` | instala dependencias |
| `pnpm start` | Metro + dev client |
| `pnpm test` | Jest: dominio, design system, pantallas y sesión de nivel (93 tests) |
| `pnpm verify:bundle` | compila el bundle de Android con Hermes; detecta imports rotos |
| `pnpm test:sql` | aplica todo el SQL sobre Postgres local y prueba las políticas RLS |
| `pnpm build:dev` / `pnpm build:preview` | builds de EAS |
| `node scripts/generate*Sql.cjs` | regenera el SQL base desde los datos locales (solo antes de usar el panel) |
| `node scripts/moveModules.cjs moves.json` | mueve módulos y reescribe los imports |
| `node scripts/checkMermaid.cjs` | valida los diagramas de `docs/` |

### Portal web (`web/`)

| Comando | Qué hace |
|---|---|
| `pnpm install` | instala dependencias (proyecto independiente, `ignore-workspace`) |
| `pnpm dev` | sincroniza tokens + Vite en `localhost:5173` |
| `pnpm test` | Vitest + Testing Library |
| `pnpm typecheck` / `pnpm build` | TypeScript + build de producción en `web/dist` |

## 9.3 Variables de entorno

| Variable | Dónde | Default |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | app | proyecto actual |
| `EXPO_PUBLIC_AI_SERVER_URL` | app | `http://192.168.1.5:8000` |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | web (`web/.env.local`) | proyecto actual |
| `VITE_ANDROID_URL`, `VITE_IOS_URL` | web | vacío («Próximamente») |

Solo van claves **públicas** (*publishable*); la seguridad está en RLS. Nunca uses la *service key* en un cliente.

## 9.4 Convenciones

- **Capas:** la UI nunca importa `supabase`; pide servicios con `useServices()`. El dominio no importa React.
- **Estilos:** `createStyles(theme)` + tokens. Prohibidos los hex sueltos en pantallas. Excepciones: el logo sobre blanco y `cameraColors`.
- **Feedback:** toda acción crítica pasa por `confirm()`, toda espera por `runBlocking()` o un skeleton, y cada resultado lleva `notify()` o diálogo, vibración y anuncio.
- **Idioma:** código en inglés; UI y comentarios en español de Chile. Los comentarios explican el *por qué*.
- **Commits:** Conventional Commits en español, en la rama `gestilingo-dev`.

## 9.5 Agregar…

| Qué | Pasos |
|---|---|
| Un tipo de ejercicio | 1) `levels/domain/exerciseTypes.js` 2) `evaluateAnswer.js` 3) componente en `presentation/exercises/` y registro en `index.js` 4) agregar el tipo al `check` de la migración 002. El panel web lo muestra solo. |
| Una clave de configuración remota | 1) `DEFAULT_REMOTE_CONFIG` 2) sección en `RemoteConfigPage.tsx` 3) tipo en `web/src/lib/domain.ts` 4) documentarla en [08](08-configuracion-remota.md) |
| Un flag | 1) `DEFAULT_FLAGS` 2) usar `useFeatureFlag('x.y')` 3) insertar la fila (o crearla desde el panel) |
| Un color | agregarlo en **ambos** temas de `tokens/colors.js`; `contrast.test.js` falla si falta en uno |
