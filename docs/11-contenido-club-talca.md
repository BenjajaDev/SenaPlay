# Contenido del Club de Sordos de Talca

El Club de Sordos de Talca entregó 356 videos de señas (saludos, números, colores, animales, alimentos, verbos, tiempo, personas, lugares, transporte, ciudades y el alfabeto manual). Este documento cuenta cómo se convierten, cuánto pesan, qué decisiones se tomaron y cómo se importan a Supabase. El formato general de los clips está en [10](10-senas-en-video.md).

**Pendiente antes de publicar:** el permiso escrito del club. Mientras no exista, todo entra como `in_review` o `draft`, con `published = false`, y nada llega a la app. Ver la sección 5.

---

## 1. Medición de formatos

Se convirtió una muestra de los videos a tres formatos con el mismo encuadre (cuadrado, 480 × 480 o 240 px en WebP animado).

| Formato | Peso por clip | Proyección para 356 clips |
|---|---|---|
| **MP4 H.264, 480 × 480** | 50 a 95 KB | ≈ 25 MB, más ≈ 9 MB de pósters WebP |
| WebP animado (240 px) | 240 a 340 KB | ≈ 100 MB |
| GIF | 1,2 a 4,3 MB | ≈ 1,1 GB |

El MP4 pesa de 3 a 5 veces menos que el WebP animado y más de 20 veces menos que el GIF, con mejor calidad de piel y sin la restricción de 256 colores. Además solo el MP4 permite que la persona decida cuándo se reproduce (regla del producto).

## 2. Decisiones

- **MP4 más póster WebP.** El video se descarga recién al primer toque; el póster es el cuadro clave y es lo único que se ve al entrar.
- **Logo reubicado en 16:9.** Los videos 16:9 traen el logo del club fuera del cuadrado que se recorta alrededor de la persona; el conversor lo copia, del mismo cuadro, a la esquina superior derecha. En esos videos también se borra el rótulo con la palabra, porque revelaría la respuesta.
- **Límite de 10 s** (antes 6 s). Las frases y algunas señas largas no caben en 6 s. Un clip que, después de recortar las pausas, dura más de 10 s queda excluido y no se sube. Excluidos hoy, por clave y variante: `conversar` v1, `19` v1, `nosotros` v1, `datos-personales` v1, `avion` v1, `furgon` v1, `puerto-montt` v1 y `t` v1. `conversar` sigue siendo usable porque queda su variante 2; las demás claves no tienen otra variante y no se usan en los niveles.
- **Import en revisión.** Los clips entran como `in_review`, `published = false`, `license = 'cedida'`, con la referencia del permiso en `consent_ref`. Un admin los valida y publica desde el panel (el disparador `guard_sign_clip` impide que lo haga una cuenta de staff).
- **Alfabeto como borrador.** Las 27 letras entran como `draft`: la app ya tiene fotos del alfabeto y un clip publicado las reemplazaría sin revisión. Los niveles tampoco usan letras.
- **Recursos en Storage, no en la app.** Los clips viven en el bucket `sign-clips` y `expo-video` los guarda en su caché (`useCaching`) al verlos: 0 MB empaquetados en la app.
- **Privacidad de los clips.** La app lee la vista `public.sign_clips_public` (solo clips publicados y sin `consent_ref`, `signer_alias`, `edit_params` ni `created_by`); la tabla `sign_clips` y el listado del bucket quedan solo para el staff. Las rutas de los archivos deben ser exactamente `<carpeta>/<variante>-<uuid>.<ext>`. El importador además quita del `edit_params` la ruta del archivo original.
- **Carpeta segura en Storage.** Supabase Storage solo acepta `[A-Za-z0-9_/!.*'() &$=@;:+,?-]` en las rutas, así que `mañana/1-uuid.mp4` falla. La carpeta se calcula con `toStorageFolder` (`mañana` → `man_ana`, `n~` → `_`), y la migración usa la función SQL equivalente `public.sign_clip_folder`. También arregla la subida desde el panel.
- **Niveles 13 a 30**, disponibles con `available = false`: un admin los activa cuando los clips estén publicados. Quien ya completó el nivel 12 igual los verá desbloqueados, porque el desbloqueo se calcula al leer (`resolveUnlockedIds`) y no depende de que el nivel estuviera activo al completar el anterior.
- **Ejercicio nuevo `sign-choice`** («¿Cuál es la seña de PERRO?»): grilla de 2 columnas con un reproductor por tarjeta. Cuando la glosa es la respuesta (`sign-choice`, `word-meaning`, `true-false`, `recognition` con palabras y `matching` de palabras), el reproductor y el placeholder usan un nombre neutro («Seña de la opción 2», «Seña a interpretar») y la pista al mantener presionado es la general del ejercicio.

## 3. Convertir e importar (Windows)

Cada comando va en su propio bloque, desde la raíz del repositorio. Los videos originales no se modifican.

Requisitos de la conversión: `python -m pip install opencv-python numpy imageio-ffmpeg`.

Convertir los 356 videos (salida fuera del repositorio):

```
python scripts\clubTalca\convert.py --src "D:\ClubTalca\recortes" --out "D:\ClubTalca\salida"
```

Revisar `D:\ClubTalca\salida\manifest.json`: cada clip trae `durationMs`, peso, encuadre y, si corresponde, `excluded`.

Definir el correo de una cuenta del equipo (la contraseña se pide al ejecutar, sin eco; no va en el comando):

```
set SENAPLAY_STAFF_EMAIL=correo@ejemplo.cl
```

Simular la importación (valida clips y niveles sin escribir nada):

```
node scripts\clubTalca\importClubTalca.mjs --dir "D:\ClubTalca\salida" --consent-ref "CLUB-TALCA-2026-01" --dry-run
```

Importar clips y niveles:

```
node scripts\clubTalca\importClubTalca.mjs --dir "D:\ClubTalca\salida" --consent-ref "CLUB-TALCA-2026-01"
```

`--consent-ref` debe ser un **código opaco** (como `CLUB-TALCA-2026-01`) que apunte al documento guardado aparte: nunca nombres, RUT ni el folio personal de alguien, porque la tabla la lee el staff.

Opciones: `--only clips` o `--only levels`, y `--signer-alias "..."` (por defecto «Club de Sordos de Talca»). Se pueden repetir sin riesgo: un clip cuya clave y variante ya existen se salta, y un nivel que ya existe no se pisa (un admin pudo activarlo o editarlo). Si el registro de un clip falla, se borran los archivos que se habían subido. El script usa la clave pública (`EXPO_PUBLIC_SUPABASE_*`, del entorno o de `.env`) y la sesión de staff, nunca la service key.

Orden recomendado:

1. Aplicar la migración `20261113000100_club_talca_content.sql` (límite de 10 s, rutas seguras y el tipo `sign-choice`). Sin ella, los clips de más de 6 s y los niveles nuevos fallan.
2. Importar con `--dry-run` y revisar el resumen.
3. Importar de verdad.
4. En el panel, un admin revisa los clips (video, gloss, encuadre), los valida y los publica.
5. Cuando los clips de un nivel estén publicados, activar el nivel en el editor de niveles.

Los niveles están en `src/features/levels/data/content/clubTalcaLevels.json`; son una semilla para Supabase y la app no los importa. Una prueba (`clubTalcaLevels.test.js`) comprueba que cada nivel pasa `LevelBuilder` en modo estricto y que solo usa claves que existen en `clubTalcaClips.json`, que no son letras y que no están excluidas.

## 4. Verificación

- `pnpm test`, `pnpm verify:bundle`, y en `web/`: `pnpm typecheck`, `pnpm test`, `pnpm build`.
- `pnpm test:sql` necesita un Postgres local (ver [09](09-guia-desarrollo.md)); los casos nuevos cubren los 10 s, la carpeta `man_ana/` y el tipo `sign-choice`.
- En un teléfono con el dev client: la grilla de `sign-choice` a 360 px de ancho, el botón ▶ de cada tarjeta y TalkBack/VoiceOver (los nombres no deben decir la glosa).

## 5. Pendiente

- **Permiso escrito del Club de Sordos de Talca** para usar y publicar los videos (cesión, uso en la app y el portal, y su alcance). El valor de `--consent-ref` es un código opaco que apunta a ese documento; el documento firmado no se guarda en el bucket público.
- Consentimiento de las personas que aparecen (la tabla guarda `signer_alias` y `consent_ref`).
- Validación lingüística: la hace una persona Sorda de la comunidad antes de publicar.
- Revisar los clips con la glosa mal escrita en el origen («BUENOS DIAS», «CLINICA»); la clave de seña ya está normalizada.
