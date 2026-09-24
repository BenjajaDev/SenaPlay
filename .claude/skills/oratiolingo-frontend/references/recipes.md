# Recetas: cómo extender OratioLingo

## Agregar un juego

1. Crea `src/screens/games/MiJuegoScreen.js` con prop `onBack`. Usa `GameScreenHeader` arriba.
2. Regístralo en `GAMES` de `src/screens/tabs/GamesTabScreen.js`: `{ id, title, description, icon (Ionicons), color, available }`.
3. En `src/screens/MainAppScreen.js`:
   - importa la pantalla;
   - si **usa cámara**, agrégala a `CAMERA_GAMES` (se monta a pantalla completa);
   - si no, agrega `if (activeGame === 'mi-juego') return <MiJuegoScreen onBack={closeGame} />;` en el render de contenido;
   - agrega su título en `tabTitle`;
   - si maneja su propio scroll/botón fijo, inclúyelo en `usesFixedLayout`.
4. Si guarda puntajes, hazlo con una función nueva en `backend/userStats.js` (clave versionada, try/catch).

## Agregar un tab

1. `src/screens/tabs/MiTabScreen.js` empezando con `SectionHeader`.
2. Entrada en `TABS` de `src/components/AppBottomNav.js` (label corto: el espacio es fijo; icono `-outline` + versión sólida).
3. Render en `MainAppScreen` (`if (activeTab === 'mi-tab') …`) y título en `tabTitle`.
4. Si contiene una lista larga, maneja tu propio `FlatList` y exclúyelo del `ScrollView` general (ver `isDictionaryTab`).

## Agregar un tipo de ejercicio de nivel

1. Documenta el tipo en el comentario de cabecera de `src/data/levelsConfig.js`.
2. Implementa el render y la validación en `src/screens/levels/LevelSessionScreen.js`, reusando `handleAnswer(isCorrect, mensaje)` para vidas, feedback y animaciones.
3. Si el catálogo remoto lo usará, asegúrate de que `payload` en Supabase tenga los mismos campos (ver `backend/catalog.js` → `buildExercise`) y regenera el SQL con `node scripts/generateCatalogSql.cjs`.

## Agregar una seña (imagen)

1. Archivo en `assets/Alfabeto/` o `assets/signs/`.
2. Entrada explícita en `SIGN_IMAGES` de `src/data/signAssets.js` (`clave: [require(...)]`, clave en minúsculas). Varias imágenes = variaciones con carrusel manual.
3. Muéstrala con `<SignImage signKey="clave" />`.

## Agregar una llamada a Supabase

```js
// backend/miArea.js
import { supabase } from './supabase';

// Explica por qué existe y cuál es el respaldo si falla.
export async function fetchAlgo() {
  try {
    const { data, error } = await supabase.from('tabla').select('campos');
    if (error || !data) return { items: RESPALDO_LOCAL, source: 'local' };
    return { items: data.map(mapRow), source: 'remote' };
  } catch {
    return { items: RESPALDO_LOCAL, source: 'local' };
  }
}
```
- Tabla nueva → SQL en `supabase/` con políticas RLS.
- Si varios lugares lo necesitan, exponlo con un Context como `CatalogContext`.

## Agregar una preferencia local

Sigue `ThemeProvider`: estado + `AsyncStorage` con clave `oratiolingo.<nombre>.v1`, carga en `useEffect` con bandera `isMounted`, setter que guarda y actualiza estado.

## Modales y feedback

- Mensaje de éxito/error: `AdaptiveModal` con `context` (agrega un preset si se repite).
- Espera iniciada por el usuario: `LoadingOverlay` con texto concreto.
- Evita `Alert.alert` nativo: rompe la estética y no respeta el tema.

## Servidor IA

`SERVIDOR_IA` en `src/screens/games/signCamera.js` es una IP de red local de desarrollo. Si agregas otra pantalla que llame al servidor, importa esa constante (no dupliques la URL). La UI debe tolerar que el servidor no responda: muestra un estado "Sin conexión con la IA" en vez de colgarse.
