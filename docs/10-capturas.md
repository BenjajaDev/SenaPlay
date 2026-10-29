# 10. Capturas de pantalla

Las capturas de la app (para la tesis y la documentación) se toman con [Maestro](https://maestro.mobile.dev), que recorre la app real en un emulador o teléfono Android y guarda un PNG por pantalla. Así salen iguales cada vez, y si la interfaz cambia basta con volver a correr un comando.

| Pieza | Dónde | Qué hace |
|---|---|---|
| Flujo principal | `.maestro/capturas.yaml` | Abre la app con estado limpio y ejecuta las pantallas en orden |
| Pantallas | `.maestro/pantallas/*.yaml` | Acceso, niveles, diccionario, videos, juegos, cámara, progreso y perfil |
| Subflujos | `.maestro/subflujos/*.yaml` | Iniciar sesión, cambiar de pestaña y salir de un juego |
| Script | `scripts/capturas.sh` (`pnpm capturas`) | Prepara el dispositivo y corre el flujo en modo claro y oscuro |

## 10.1 Requisitos (una vez)

1. **Java 17 o superior** (`java -version`).
2. **Android platform-tools** (`adb`): vienen con Android Studio, o se instalan solas.
3. **Maestro**:

   ```bash
   curl -fsSL "https://get.maestro.mobile.dev" | bash
   ```

   En Windows se usa dentro de WSL2, con el emulador expuesto a `adb`.
4. **Un emulador o un teléfono Android con Android 10 o superior.** Para la tesis conviene un emulador de Android Studio con el perfil Pixel 7 (1080 × 2400), porque da capturas nítidas y del mismo tamaño.
5. **La app en versión *preview*** (no el dev client: al limpiar el estado, el dev client vuelve a su menú de servidores):

   ```bash
   pnpm build:preview
   ```

   Descarga el APK desde el enlace que entrega EAS e instálalo con `adb install senaplay.apk`.
6. **Una cuenta de prueba** ya verificada en Supabase, creada solo para esto. Nunca uses la de una persona real.

## 10.2 Tomar las capturas

Con el dispositivo conectado (`adb devices` muestra uno solo):

```bash
SENAPLAY_EMAIL=prueba@correo.com SENAPLAY_PASSWORD='contraseña' pnpm capturas
```

Las credenciales solo viajan como variables de entorno y no se guardan en el repositorio.

El script:

1. Activa el **modo demostración** de Android: hora fija 12:00, batería llena, señal completa y sin notificaciones.
2. Pone el sistema en modo claro, abre la app con el estado limpio (así sigue el tema del sistema) y recorre todo.
3. Repite en modo oscuro.
4. Restaura el modo del sistema y sale del modo demostración, aunque algo falle.

Las capturas quedan en `capturas/claro/` y `capturas/oscuro/` (la carpeta está en `.gitignore`). Para otra carpeta: `pnpm capturas /ruta/destino`.

## 10.3 Qué se captura

| Archivo | Pantalla |
|---|---|
| `01-inicio-sesion`, `02-recuperar-contrasena`, `03-registro` | Acceso |
| `10-niveles`, `11-niveles-ruta` | Ruta de niveles |
| `12-nivel-ejercicio`, `13-nivel-pista`, `14-nivel-aviso`, `15-nivel-confirmar-salida` | Sesión de un nivel (las que dependan del ejercicio sorteado pueden no aparecer) |
| `20-diccionario-deletreo`, `21-diccionario-detalle`, `22-diccionario-senas-reales` | Diccionario |
| `30-videos`, `31-video-reproductor` | Videos (si la pestaña está activa; el reproductor, si hay videos) |
| `40-juegos`, `41-juego-memoria`, `42-juego-quiz` | Juegos |
| `50-camara-practica-libre`, `51-camara-practica-guiada`, `52-camara-deletreo`, `53-camara-traduccion`, `54-camara-senas-dinamicas` | Juegos con cámara (el último solo si el flag beta está activo) |
| `60-progreso`, `61-menu-perfil`, `62-perfil-editar`, `63-perfil` | Progreso y perfil |

Con la cámara: en el emulador se ve su escena virtual; en un teléfono, lo que tenga enfrente. Para mostrar el seguimiento de la mano, usa un teléfono y deja tu mano frente a la cámara mientras corre ese tramo.

## 10.4 Si un paso falla

- Maestro indica qué paso falló y guarda una captura del momento en `~/.maestro/tests/`.
- Lo más común es que cambió un texto o un label. Los flujos navegan por los mismos `accessibilityLabel` que usa el lector de pantalla, así que un cambio de texto se corrige en el `.yaml` de esa pantalla.
- `maestro studio` abre un inspector en el navegador para ver qué textos e ids reconoce Maestro en la pantalla actual.
- Para correr solo una parte, cambia el orden o comenta los `runFlow` de `.maestro/capturas.yaml`. El inicio de sesión siempre tiene que ir antes de las pantallas internas.
