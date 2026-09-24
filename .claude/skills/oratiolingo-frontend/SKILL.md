---
name: oratiolingo-frontend
description: Guía de desarrollo frontend para OratioLingo / SeñaPlay (Expo SDK 57 + React Native 0.86 + React 19, JavaScript, Supabase). Úsala SIEMPRE que escribas, refactorices o depures código de la app móvil — pantallas, componentes, hooks, estado, navegación entre tabs/juegos/niveles, llamadas a Supabase o AsyncStorage, cámara/IA, rendimiento, instalación de dependencias o builds con EAS — aunque el pedido no diga "frontend" (ej. "agrega un juego nuevo", "la pantalla de progreso no guarda", "crea un hook para…", "instala X", "la app va lenta en el diccionario", "arregla este bug"). Para decisiones de look & feel y animaciones, combínala con la skill oratiolingo-ui.
---

# OratioLingo — desarrollo frontend

App Expo para aprender Lengua de Señas Chilena. El objetivo de esta guía es que el código nuevo se lea como el existente y no rompa lo que funciona (sesión, progreso offline, cámara con IA).

## Stack

- **Expo SDK 57**, React Native 0.86, React 19.2, **JavaScript** (no TypeScript), **pnpm**.
- `expo-dev-client`: la app corre en un *development build* (la cámara y los módulos nativos no funcionan en Expo Go). Builds con EAS: `pnpm build:dev`, `pnpm build:preview` (Android).
- Supabase (`backend/supabase.js`) para auth + catálogo/diccionario; AsyncStorage para progreso y preferencias locales.
- `expo-camera` + WebView con MediaPipe (`handTrackingHtml.js`) + servidor IA Python (`ai_module/`, URL en `SERVIDOR_IA` de `src/screens/games/signCamera.js`).
- UI: `expo-linear-gradient`, `@expo/vector-icons` (Ionicons), Poppins. Sin librería de componentes externa.

## Estructura

```
App.js                  Auth + router de nivel superior (login/register/verify/reset/main) por estado
index.js                applyPoppinsGlobally() + registerRootComponent
backend/                Acceso a datos: supabase.js, catalog.js, dictionary.js, signs.js, userStats.js
src/theme/              palette.js (tokens claro/oscuro), ThemeProvider (useAppTheme)
src/constants/fonts.js  APP_FONTS, poppins()
src/components/         Componentes compartidos; ui/ = piezas del sistema de diseño
src/screens/            MainAppScreen (router interno), tabs/, games/, levels/
src/data/               Datos locales y contextos (CatalogContext, levelsConfig, signAssets…)
supabase/ + scripts/    SQL y generadores (node scripts/generate*Sql.cjs)
ai_module/              Modelo y servidor IA (Python) — no es parte del bundle
```

Detalle de cómo agregar pantallas, tabs, juegos y datos en `references/recipes.md`.

## Convenciones de código

- Componentes función con **default export**; helpers puros como funciones sueltas arriba o abajo del componente.
- Estilos: `const styles = useMemo(() => createStyles(theme), [theme]);` y `function createStyles(theme) { return StyleSheet.create({...}) }` al final del archivo. Colores del tema, nunca hex nuevos (ver skill `oratiolingo-ui`).
- Imports en este orden: librerías externas, luego módulos locales (componentes, constants, data, theme).
- Nombres en inglés para código; textos de UI y **comentarios en español**. Los comentarios explican el *por qué* (decisiones, trampas), no el qué — mira `FadeInView`, `SignImage` o `applyPoppinsGlobally` como modelo.
- Textos visibles en español de Chile neutro, con tildes y ñ correctas.
- `toLocaleUpperCase('es')` / `toLocaleLowerCase('es')` al manipular letras (ñ).

## Navegación

No se usa React Navigation (está instalado pero sin uso). La navegación es por estado:
- `App.js`: `screen` = `'login' | 'register' | 'verify' | 'resetPassword' | 'main'`.
- `MainAppScreen`: `activeTab`, `activeGame`, `activeLevelId`. Los juegos de cámara van en `CAMERA_GAMES` y se montan a pantalla completa fuera del `ScrollView`.

Sigue este patrón al agregar pantallas. Migrar a React Navigation es un cambio grande: proponlo al usuario, no lo hagas de pasada.

## Estado y datos

- Estado local con `useState`; contexto solo para datos globales (`AppThemeProvider`, `CatalogProvider`). No agregues Redux/Zustand sin acordarlo.
- **Todo acceso a datos pasa por `backend/`**, nunca `supabase.from(...)` directo en una pantalla. Las funciones de `backend/`:
  - atrapan errores (`try/catch`) y devuelven un valor por defecto utilizable, nunca lanzan hacia la UI;
  - tienen **respaldo local** (ej. `fetchCatalog` cae a `LEVELS_CATALOG`) para que la app funcione offline;
  - devuelven `{ data, source }` o la forma que la UI ya espera.
- Claves de AsyncStorage con prefijo versionado: `oratiolingo.<área>.v1[.<userId>]`. Si cambias la forma del dato, sube la versión o valida al leer (ver `getLevelProgress`).
- Efectos async: bandera `mounted`/`isMounted` y cleanup para evitar setState tras desmontar; desuscribe listeners (`authListener.subscription.unsubscribe()`).
- La clave de Supabase del cliente es *publishable* (pública por diseño); la seguridad real depende de las políticas RLS en `supabase/*.sql`. Nunca pongas una service key en la app.

## Rendimiento

- Listas largas (diccionario, catálogo de señas): `FlatList` con `keyExtractor`, `initialNumToRender`, y `renderItem` memoizado; no `ScrollView` + `map` para cientos de ítems.
- Calcula derivados con `useMemo`, callbacks que van a hijos con `useCallback`.
- Imágenes de señas: se resuelven vía `src/data/signAssets.js` (requires estáticos). No hagas `require` dinámico con strings construidos: Metro no lo soporta.
- Pantallas de cámara: el hilo JS está ocupado con frames/landmarks; evita setState por frame, agrupa o limita (throttle) actualizaciones.

## Dependencias

- Instala con `npx expo install <paquete>` (elige la versión compatible con el SDK 57); pnpm es el gestor. No uses `npm install`.
- Si el paquete trae código nativo: hay que reconstruir el dev client (`pnpm build:dev`) — avísale al usuario.
- Antes de sumar una dependencia, revisa si RN/Expo ya lo resuelve. Propón las dependencias grandes (navegación, estado, animación) antes de instalarlas.

## Verificación antes de entregar

El repo no tiene tests ni linter configurados. Como mínimo:
1. `npx expo export --platform android --output-dir /tmp/oratio-export` (o `--platform web`) para confirmar que el bundle compila (detecta imports rotos y errores de sintaxis). Requiere `pnpm install` previo.
2. `npx expo-doctor` si tocaste dependencias o `app.json`.
3. Si cambiaste UI: pide al usuario que lo pruebe en el dev client o usa la skill `run` para la versión web cuando aplique (la cámara no funciona en web).
4. Relee el diff buscando: hex hardcodeados, pesos sin `APP_FONTS`, `supabase` fuera de `backend/`, efectos sin cleanup, textos sin tildes.

## Git

- Rama de trabajo: `gestilingo-dev`.
- Commits estilo Conventional Commits **en español**: `feat: …`, `fix: …`, `chore: …`, `refactor: …` (ver `git log`).
- `ai_module/` ignora binarios (videos, landmarks, checkpoints): no los agregues.
