# ai_module — IA de señas de SeñaPlay

Dos pipelines independientes conviven acá:

- **Estático** (alfabeto LSCh, una mano, sin movimiento) — `data/extract_landmarks.py`
  → `model/train_static.py` → `models_saved/estatico.pkl`. Ya entrenado y en
  producción (98% test). No lo toca nada de lo que describe este README.
- **Dinámico** (señas con movimiento, repertorio de palabras) — el pipeline
  nuevo que describe este documento: `scripts/` + `config/` + `data/raw_videos/`
  → `data/processed_landmarks/` → `data/models/dinamico_tcn.pt`.

## Instalación

```bash
cd ai_module
pip install -r requirements.txt
```

`torch` entrena en CPU sin problema con este dataset (no hace falta GPU).
Si falta el modelo de MediaPipe:

```bash
curl -L -o models_mediapipe/holistic_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker.task
```

---

## 1. Qué captura el pipeline dinámico

`scripts/holistic_pipeline.py` usa `HolisticLandmarker` (Tasks API de
MediaPipe — la única disponible en mediapipe ≥0.10.3x, `mp.solutions` fue
removida) para correr manos + pose + cara **en paralelo** sobre cada frame, y
arma un vector fijo de **527 valores por frame**:

| Rango       | Contenido                                                            | Tamaño |
|-------------|-----------------------------------------------------------------------|--------|
| `[0:63]`    | Mano izquierda — forma normalizada (centrada en muñeca, escalada)    | 63     |
| `[63:126]`  | Mano derecha — igual que arriba                                      | 63     |
| `[126]`     | Presencia mano izquierda (0/1)                                       | 1      |
| `[127]`     | Presencia mano derecha (0/1)                                         | 1      |
| `[128:179]` | Pose superior — landmarks 0-16 de MediaPipe Pose (cabeza, hombros, codos, muñecas), centrada/escalada por hombros | 51 |
| `[179:527]` | Cara reducida — 116 puntos (labios+ojos+cejas+nariz), mismo marco que la pose | 348 |

El orden es **estable** — no se reordena entre versiones sin bump del campo
`entrada` guardado en el checkpoint. Ver el docstring de
`scripts/holistic_pipeline.py` para el detalle índice a índice.

**Por qué cara reducida (116 puntos) y no los 468/478 completos:** se tomó la
unión de los grupos canónicos de FaceMesh para labios, ojos, cejas y nariz —
son los que cambian con los marcadores no-manuales de lengua de señas
(preguntas, negación, intensidad). Se excluyó el contorno de cara (+36
puntos) por no aportar información gramatical y encarecer el vector en móvil
sin beneficio claro. Los índices se calculan en tiempo de importación desde
las constantes de topología reales de mediapipe, no están hardcodeados a
mano — no pueden desincronizarse de la versión instalada.

**Por qué pose "superior" y no el esqueleto completo:** solo landmarks 0-16
(cabeza + hombros + codos + muñecas). Se excluyen caderas/piernas (17-32) a
propósito — no aportan nada a una seña y solo agregarían ruido.

---

## 2. Arquitectura del modelo — TCN

`model/tcn.py` — una **CNN 1D dilatada** (Temporal Convolutional Network),
sin recurrencia (nada de LSTM/GRU). Se evaluaron tres variantes antes de
fijar esta:

1. **TCN (elegida):** convoluciones 1D con dilatación creciente (1,2,4,8...)
   dan un campo receptivo temporal grande con pocas capas. Es "CNN pura",
   paraleliza sobre el eje temporal (a diferencia de una LSTM, que es
   secuencial) y por eso entrena rápido en CPU — la restricción dura de este
   proyecto (sin GPU, dataset chico).
2. CNN espacial por frame + LSTM/GRU encima: separa mejor forma-por-frame de
   evolución temporal, pero el entrenamiento recurrente es notablemente más
   lento en CPU para el mismo dataset.
3. CNN 2D tratando (frames × 527 features) como una imagen: mezclaría en la
   misma convolución dos ejes de naturaleza distinta (tiempo vs. landmark),
   suele rendir peor y es menos interpretable. Descartada.

La primera capa del TCN proyecta las 527 features de entrada a un espacio
aprendido más chico (64 canales) vía convolución 1×1 — actúa como un
"embedding por frame" antes de las capas temporales dilatadas. El padding es
simétrico ("same"), no causal: la clasificación es sobre una secuencia YA
grabada completa, no streaming en vivo, así que no hay motivo para
restringir cada paso a ver solo el pasado.

---

## 3. Flujo de trabajo local

### 3.1 Llenar `data/raw_videos/` y extraer landmarks

```
ai_module/data/raw_videos/
  hola/
    hola_juan_01.mp4
    hola_maria_01.mov
    ...
  gracias/
    gracias_juan_01.mp4
    ...
```

- Acepta `.mp4` y `.mov` (case-insensitive).
- Nombrar los archivos `<seña>_<signante>_<numero>.ext` es opcional pero
  recomendado: `scripts/train_model.py` usa el `<signante>` para no partir a
  la misma persona entre train/val/test. Si no sigues la convención, el
  entrenamiento igual funciona (cada archivo queda como su propio grupo).

Extraer:

```bash
python scripts/extract_landmarks.py              # todas las señas
python scripts/extract_landmarks.py --señas hola adios
python scripts/extract_landmarks.py --overwrite   # re-extraer todo
```

Cada video nuevo genera `data/processed_landmarks/<seña>/<archivo>.npy`
(shape `(T, 527)`). Cualquier carpeta nueva en `raw_videos/` se registra sola
en `config/dataset_config.yaml`.

### 3.2 Entrenar el modelo completo

```bash
python scripts/train_model.py
python scripts/train_model.py --epocas 120 --batch 16   # override puntual
python scripts/train_model.py --señas hola adios gracias  # subconjunto
```

Qué hace, en orden:

1. Carga todas las secuencias `.npy` de las señas activas (`activa: true` en
   `dataset_config.yaml`), las remuestrea a `longitud_secuencia` frames
   (interpolación — da invarianza a la velocidad de ejecución).
2. Split train/val/test estratificado por clase, agrupado por signante
   (ver 3.1) — proporciones en `entrenamiento.split_*` del YAML.
3. Augmenta SOLO el train (`scripts/augmentation.py`): rotación en el plano
   XY, escalado, espejado (intercambia mano izq/der + niega X; ver el
   docstring del módulo para la simplificación deliberada en el espejado de
   cara), ruido gaussiano — cuántas variaciones por muestra y con qué
   intensidad se configura en `augmentacion.*`.
4. Entrena el TCN con Adam + `ReduceLROnPlateau`, guarda el checkpoint cada
   vez que mejora el F1 macro de validación (no la accuracy — más robusto
   si el dataset queda desbalanceado entre clases).
5. Al terminar, evalúa el MEJOR checkpoint contra el split de test y
   imprime accuracy + F1 por clase (`classification_report` de sklearn).

Salida: `data/models/dinamico_tcn.pt` (state_dict + etiquetas + longitud de
secuencia + tamaño de entrada — todo lo que `model/predict.py` necesita para
reconstruir el modelo exacto).

Es **multiclase de una sola pasada**: un solo modelo clasifica todo el
repertorio activo, no hay un modelo por seña.

### 3.3 Agregar una seña nueva — paso a paso

```bash
# 1. Primera corrida: crea la carpeta vacía y te avisa
python scripts/add_new_signs.py --seña buenos_dias

# 2. Copia ahí tus videos (.mp4/.mov) — uno por signante, como el resto del dataset
#    data/raw_videos/buenos_dias/buenos_dias_juan_01.mp4 ...

# 3. Segunda corrida: extrae landmarks y (opcionalmente) reentrena
python scripts/add_new_signs.py --seña buenos_dias --reentrenar
```

No hay fine-tuning incremental — cada `--reentrenar` reentrena el modelo
COMPLETO desde cero con todas las señas activas. Con un dataset de este
tamaño (25 videos/seña) y sin GPU, reentrenar entero es más simple y más
confiable que mantener un modelo "parcheado", y sigue siendo rápido en CPU.
Si vas a agregar varias señas de una, hazlo sin `--reentrenar` en cada una y
corre `python scripts/train_model.py` una sola vez al final.

Para desactivar temporalmente una seña sin borrar sus datos (dataset
incompleto, en revisión), poné `activa: false` en su entrada de
`config/dataset_config.yaml` — `train_model.py` la salta.

---

## 4. De local a Supabase (post-desarrollo)

Local (`data/raw_videos/` + extracción in situ) y Supabase deben confluir al
MISMO formato de salida (`data/processed_landmarks/<seña>/*.npy`, shape
`(T, 527)`) para que `scripts/train_model.py` los consuma sin distinción.

**Storage (bucket `senas-dinamicas-videos`):**

```
senas-dinamicas-videos/
  <seña>/
    <signante_id>/
      <fecha_iso>.mp4
```

**Postgres (`supabase/dynamic_signs_capture.sql`):** tabla
`dynamic_sign_captures` con `sign_id`, `signer_id`, `captured_at`,
`consent`, `video_path`, `processing_status`
(`pendiente` / `procesado` / `error`), `landmarks_path`. RLS restringida a
`service_role` — son datos de entrenamiento con consentimiento, no contenido
público del diccionario.

**Flujo de sincronización (a implementar cuando se conecte Supabase):**

1. Un script (`scripts/sync_supabase.py`, TODO — no implementado todavía,
   es trabajo post-desarrollo) descarga los videos con
   `processing_status = 'pendiente'`, los guarda en
   `data/raw_videos/<sign_id>/<signer_id>_<fecha>.mp4` — es decir, **caen en
   la MISMA carpeta que llenarías a mano**, con nombre compatible con la
   convención `<seña>_<signante>_<numero>` de 3.1.
2. Corre `scripts/extract_landmarks.py` normalmente sobre esa carpeta — no
   hay código de extracción distinto para Supabase, es el mismo pipeline.
3. El script de sync actualiza `processing_status = 'procesado'` y
   `landmarks_path` en Postgres una vez que el `.npy` existe.

Así, el origen del video (grabado a mano localmente o subido a Supabase por
otra persona) es invisible para `scripts/train_model.py`.

---

## 5. De captura en vivo a clasificación dinámica (todavía no conectado)

`server.py::/clasificar_secuencia` y `model/predict.py::ClasificadorDinamico`
ya están listos para el TCN — reciben una secuencia de vectores de 527
valores (los mismos que produce `frame_a_vector`), NO landmarks crudos de
mano.

La app (WebView de `src/screens/games/handTrackingHtml.js`) hoy solo captura
manos en vivo con `@mediapipe/hands` (JS, vía CDN) para la clasificación
ESTÁTICA — no arma pose ni cara. Conectar la clasificación dinámica en vivo
requeriría que el WebView corra un pipeline holístico equivalente en JS
(`@mediapipe/holistic` o Tasks API para Web) y reproduzca exactamente
`frame_a_vector` en el cliente. Es una extensión razonable pero no estaba en
el alcance de este cambio (que solo pedía capturar completo en el pipeline
de ENTRENAMIENTO, y simplificar la VISUALIZACIÓN en vivo a puntos de mano).

---

## 6. Visualización en la app (frontend)

`src/screens/games/handTrackingHtml.js` ya no renderiza un modelo 3D de
mano (Three.js) — dibuja los puntos y líneas de AMBAS manos sobre el feed de
cámara, en un `<canvas>` 2D superpuesto al video, estilo MediaPipe estándar.
En modo práctica, la pose de referencia ("mano fantasma") se dibuja
semitransparente, alineada a la muñeca de la mano detectada y escalada a su
mismo tamaño en pantalla, para comparar forma contra forma en vivo — el
equivalente 2D de lo que antes hacía la mano fantasma 3D.

Esto es puramente visual: la clasificación sigue siendo de una sola mano
(la primera detectada), igual que antes — no cambia el contrato con el
backend ni con `signCamera.js`.
