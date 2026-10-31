# Integración del pipeline nuevo con `gestilingo-dev`: diseño

Estado: **aprobado el 2026-10-31, con los ajustes de la revisión** (sección «Decisiones de la
revisión», al final).

Ramas revisadas:

| Rama | Commit | Rol |
|---|---|---|
| `gestilingo-dev` | `d9f6cd4` | Lo que usa la app hoy (servidor de referencia). |
| `feat/ia-comparacion-temporal` | `09aceae` | Pipeline nuevo: FeatureSpec 2.0, `preprocessing/`, `models/`, LSTM exportada. |
| Base común | `a666e73` | Punto donde se separaron. |

Cubre las tareas 1, 2, 3 y 6 de `docs/ai/pendientes_integracion.md`. Las tareas 4 (negativos
reales), 5 (recalibración) y 7 (recorte) quedan fuera.

**Objetivo:** con `MODELO_DINAMICO=tcn` (por defecto), el servidor responde igual que hoy en las
cuatro rutas que usa o puede usar la app. Con `MODELO_DINAMICO=lstm`, sirve la LSTM exportada,
solo para pruebas locales.

---

## 1. Contrato de las 4 rutas

Lo que consume la app (`src/features/camera/presentation/signCamera.js`):

| Ruta | Quién la llama | Campos que lee | Timeout |
|---|---|---|---|
| `POST /clasificar` | `clasificarSena` | `seña`, `confianza` | 2,5 s |
| `POST /clasificar_frames` | `clasificarTramo` (captura automática) | `es_seña`, `confianza` (≥ `UMBRAL_DINAMICO = 0.6`), `seña`, `alternativas` | 10 s |
| `POST /clasificar_video` | `subirVideo` (monitor dinámico) | `seña`, `confianza`, `alternativas`, `frames_procesados`, `ratio_con_mano` | 15 s |
| `POST /clasificar_secuencia` | nadie (la app no arma el vector de 527) | — | — |

La app trata cualquier respuesta distinta de 2xx igual: `clasificarTramo` vuelve a la lectura
por trayectoria del visor, y las otras dos marcan `sin-conexion`. Por eso cambiar un código de
error (por ejemplo, de 500 a 422) no cambia lo que ve la persona.

### 1.1 Modelos Pydantic (entrada)

```python
class FrameMano(BaseModel):                      # /clasificar (sin cambios)
    landmarks: list[list[float]]

class SecuenciaMano(BaseModel):                  # /clasificar_secuencia
    frames: list[list[float]]                    # tope: Ajustes.max_cuadros_tramo (CAMBIA: antes sin tope)
    fps: float | None = 15.0

class VideoSena(BaseModel):                      # /clasificar_video
    video_base64: str                            # tope de tamaño: ver §6
    mime: str = "video/webm"                     # se valida: ver §6

class TramoMovimiento(BaseModel):                # /clasificar_frames
    frames: list[str]                            # tope: Ajustes.max_cuadros_tramo (120)
    fps: float = Field(default=15.0, gt=0, le=60)
```

Los topes salen de `Ajustes` (§3), que se cargan al arrancar. Por eso no pueden ir como
`Field(max_length=...)`, que se fija al importar el módulo. La ruta los comprueba y responde
422 con `{"detail": "El tramo trae 121 cuadros; el máximo es 120"}`. Hoy el 422 por más de 120
cuadros lo arma Pydantic: el código es el mismo, pero cambia el formato del cuerpo, y el esquema
OpenAPI ya no muestra `maxItems`.

### 1.2 Modelos Pydantic (salida)

```python
class RespuestaEstatica(BaseModel):              # /clasificar y /clasificar_secuencia
    seña: str
    confianza: float                             # redondeada a 4 decimales

class Alternativa(BaseModel):
    seña: str
    confianza: float                             # 4 decimales

Motivo = Literal["sin_mano", "poco_movimiento", "modelo_sin_seña"]

class RespuestaDinamica(BaseModel):              # /clasificar_frames y /clasificar_video
    seña: str                                    # mejor clase, aunque es_seña sea False
    confianza: float
    es_seña: bool                                # motivo is None
    motivo: Motivo | None
    alternativas: list[Alternativa]              # las 2 siguientes del ranking (máx. 2)
    movimiento_muñeca: float | None              # 3 decimales; None sin pose suficiente
    frames_procesados: int
    ratio_con_mano: float                        # 3 decimales
```

Los modelos de salida se declaran como `response_model`, así quedan en el OpenAPI de `/docs`.
Las claves y los redondeos son exactamente los de `_respuesta_dinamica` de `gestilingo-dev`.

### 1.3 Códigos HTTP y errores

Todos los errores propios usan el formato de FastAPI `{"detail": "<mensaje en español>"}`. Los
de validación de Pydantic usan `{"detail": [{"loc", "msg", "type"}]}`, como hoy.

| Ruta | Código | Cuándo | ¿Cambia? |
|---|---|---|---|
| todas | 422 (Pydantic) | Esquema inválido, `fps` fuera de (0, 60] | No |
| `/clasificar_frames` | 422 | Más de `max_cuadros_tramo` cuadros | Mismo código; el cuerpo pasa a `{"detail": "<texto>"}` |
| todas | **413** | Cuerpo de la petición sobre el límite de la ruta (§6) | **Nuevo** |
| `/clasificar` | 503 | Modelo estático no disponible | No |
| `/clasificar` | 500 → **422** | `landmarks` que no son 21×3 (hoy revienta en `extraer_caracteristicas`) | **Sí** (aprobado), solo con entradas inválidas |
| `/clasificar_secuencia` | 503 | Modelo dinámico no disponible (ver §3: con la carga al arrancar, ya no ocurre) | No |
| `/clasificar_secuencia` | 500 → **422** | Ancho distinto de 527 (hoy revienta dentro de la TCN) | **Sí**, solo con entradas inválidas |
| `/clasificar_secuencia` | 200 → **422** | `frames` vacío (hoy clasifica una secuencia de ceros) | **Sí**, solo con entradas inválidas |
| `/clasificar_secuencia` | **422** | Más de 120 cuadros | **Sí** (antes sin tope) |
| `/clasificar_video` | 422 | `No se pudo procesar el video` | Solo el texto: ya no incluye la excepción interna (hoy filtra la ruta del archivo temporal); el detalle va al log |
| `/clasificar_video` | 422 | `No se detectaron frames válidos en el video` | No |
| `/clasificar_video` | **422** | `mime` fuera de `video/webm` o `video/mp4`, o base64 inválido | **Nuevo** |
| `/clasificar_video` | **413** | `video_base64` sobre el límite | **Nuevo** |
| `/clasificar_video` | **413** | El video tiene más de `max_cuadros_video` cuadros muestreados (§6) | **Nuevo** |
| `/clasificar_frames` | 422 | `El tramo no trae cuadros` | No |
| `/clasificar_frames` | 422 | `Cuadro inválido: …` (base64 mal formado) | Solo el texto: indica el número del cuadro |
| `/clasificar_frames` | 422 | `Ningún cuadro se pudo decodificar` | No |
| `/clasificar_frames` | **422** | Prefijo distinto de `data:image/jpeg;base64,`, o bytes que no son JPEG | **Nuevo** |
| `/clasificar_frames` | **413** | Un cuadro sobre el límite por cuadro | **Nuevo** |

**Resumen:** con las entradas que manda la app, ninguna respuesta cambia. Los cambios solo
afectan entradas que la app no produce: entradas malformadas que hoy dan 500 o 200 con basura, y
los límites nuevos de §6.

`/señas`, `/seña/{id}` y `/comparar` no se tocan.

**`GET /`** conserva sus cuatro claves y suma tres. Es un cambio aditivo, y la app no llama a esta
ruta:

```json
{
  "app": "SeñaPlay IA de Señas",
  "modelo_estatico_listo": true,
  "modelo_dinamico_listo": true,
  "total_señas": 32,
  "modelo_dinamico": "tcn",
  "clases_dinamicas": ["G", "J", "Mi", "Nombre", "Presento", "S", "X", "Yo", "Z", "ninguna"],
  "barreras_activas": {"sin_mano": true, "poco_movimiento": true, "modelo_sin_seña": true}
}
```

En modo `lstm`: `"modelo_dinamico": "lstm"`, las 9 clases sin `ninguna`, y
`"modelo_sin_seña": false`.

---

## 2. Arquitectura

### 2.1 Flujo

```
/clasificar_frames  ─▶ entrada.decodificar_cuadros ─▶ MediaPipe (cfg_extraccion del modelo) ─┐
/clasificar_video   ─▶ entrada.validar_video ─▶ extraction.extraer_video ────────────────────┤
                                                                                              ▼
                                                                                      SecuenciaCruda
                                                                       ┌──────────────────┴──────────────────┐
                                                                       ▼                                     ▼
                                                        ModeloDinamico.ranking(cruda)          barreras.evaluar(cruda, …)
                                                                       └──────────────────┬──────────────────┘
                                                                                          ▼
                                                                              armar_respuesta_dinamica
```

`/clasificar_secuencia` recibe vectores ya normalizados de 527 valores, no landmarks crudos, así
que no puede armar una `SecuenciaCruda`. Pasa por `ModeloDinamico.ranking_vectores_v1(matriz)` y
no aplica barreras, igual que hoy.

### 2.2 Puerto

`ai_module/inferencia/puerto.py`:

```python
class ModeloDinamico(Protocol):
    @property
    def nombre(self) -> Literal["tcn", "lstm"]: ...
    @property
    def clases(self) -> tuple[str, ...]: ...
    @property
    def clase_rechazo(self) -> str | None: ...           # "ninguna" o None
    @property
    def cfg_extraccion(self) -> Mapping[str, float]: ... # fps_muestreo y confianzas de MediaPipe

    def ranking(self, cruda: SecuenciaCruda) -> list[tuple[str, float]]: ...
    def ranking_vectores_v1(self, matriz: np.ndarray) -> list[tuple[str, float]]: ...
```

`ranking` devuelve todas las clases ordenadas de mayor a menor probabilidad (softmax). Las rutas
toman de ahí la mejor clase y las alternativas. `ranking_vectores_v1` lanza `ValueError` si la
matriz no es `(T, 527)` con T ≥ 1; la ruta lo traduce a 422.

### 2.3 Adaptadores

Van en `ai_module/model/predict.py`, donde ya están los clasificadores. La base es el
`ClasificadorDinamico` de `feat/ia-comparacion-temporal`, que reconstruye cualquier checkpoint
(legado o exportado) desde su meta con `models.checkpoint.cargar` y preprocesa con
`Preprocesador`. Se le agrega `ranking` y `ranking_vectores_v1`. Los dos adaptadores son
subclases delgadas: no duplican el cálculo, **validan al cargar** que el archivo es el modelo que
dice la configuración, y fijan `clase_rechazo` y `cfg_extraccion`.

| | `TCNLegado` (`MODELO_DINAMICO=tcn`) | `LSTMExportado` (`MODELO_DINAMICO=lstm`) |
|---|---|---|
| Archivo | `data/models/dinamico_tcn.pt` | `models_saved/dinamico.pt` (+ `dinamico.meta.json`) |
| Meta | Traducido por `checkpoint.meta_legado` | Embebido en el `.pt` |
| FeatureSpec | `FeatureSpec.v1(T=60)`: manos en marco local, marco neutro sin pose, solo posición | 2.0: marco vecino sin pose, posición + velocidad + aceleración, T = 30 |
| Entrada al modelo | (60, 527) | (30, 1577) |
| Clases | 10, con `ninguna` | 9, sin `ninguna` |
| Invariantes al cargar | arquitectura `tcn`, spec `1.0`, `ninguna` ∈ clases | arquitectura `lstm`, spec `2.0`, `ninguna` ∉ clases |
| `clase_rechazo` | `"ninguna"` (`CLASE_SIN_SEÑA`) | `None` |
| `cfg_extraccion` | `config/dataset_config.yaml → extraccion`, la misma fuente que usa hoy el servidor | `meta.preprocesamiento.extraccion` |
| `ranking_vectores_v1` | Sí (es su formato nativo) | Sí: la spec es compatible con 1.0 (`es_compatible_v1()` es True), solo para pruebas |

Si un invariante no se cumple (por ejemplo, `RUTA_MODELO_TCN` apunta a la LSTM), el servidor no
arranca y el log dice cuál falló.

Una fábrica `cargar_modelo_dinamico(ajustes) -> ModeloDinamico` elige el adaptador. Es el único
lugar que conoce las clases concretas; `server.py` solo ve el puerto.

`CLASE_SIN_SEÑA` se queda en `model/predict.py` porque `scripts/generar_negativos.py` la importa
de ahí.

### 2.4 Barreras sobre `SecuenciaCruda`

`ai_module/inferencia/barreras.py`. Las constantes no cambian:

```python
RATIO_MIN_CON_MANO = 0.3
MOVIMIENTO_MIN_MUÑECA = 0.08
RATIO_MIN_CON_POSE = 0.5

def ratio_con_mano(cruda: SecuenciaCruda) -> float: ...           # round(con_mano / L, 3); 0.0 si L = 0
def movimiento_muñecas(cruda: SecuenciaCruda) -> float | None: ...
def evaluar(cruda: SecuenciaCruda, mejor: str, clase_rechazo: str | None) -> Evaluacion: ...
```

**`movimiento_muñecas`:** toma los cuadros con `presencia_pose`. Si son menos de la mitad,
devuelve `None`. Si no, normaliza las muñecas de la pose (índices 15 y 16) al marco de hombros de
cada cuadro, con el mismo `normalization.marco_corporal` del pipeline, y devuelve el mayor
rango (`ptp`) en x o y. Hoy se calcula sobre la matriz de 527 valores, con la pose ya
normalizada. Es la misma cuenta antes de aplanar: cuadro a cuadro, `(muñeca − punto medio de
hombros) / ancho de hombros`, y escala 1 si el ancho es degenerado. Por eso sirve para los dos
modelos sin depender de su FeatureSpec.

**Precedencia** (igual que hoy): `sin_mano` → `poco_movimiento` → `modelo_sin_seña`.

**`modelo_sin_seña` con la LSTM:** la LSTM no tiene clase de rechazo (`clase_rechazo = None`),
así que **esta barrera se omite**. Con `MODELO_DINAMICO=lstm`, `motivo` solo puede ser
`sin_mano`, `poco_movimiento` o `None`, y cualquier tramo que pase las dos barreras deterministas
se acepta si la confianza llega a 0,6. Es la razón para no usar la LSTM en producción hasta cerrar
las tareas 4 y 5. Queda explícito en tres lugares:

- **Código:** `barreras.barreras_activas(clase_rechazo)` devuelve
  `{"sin_mano": True, "poco_movimiento": True, "modelo_sin_seña": clase_rechazo is not None}`.
  `evaluar` solo puede producir motivos de barreras activas, y una prueba lo comprueba con un
  modelo que siempre responde `ninguna`.
- **Log:** al arrancar en modo `lstm`, un `logger.warning` dice que el modelo no tiene clase de
  rechazo, que la barrera `modelo_sin_seña` está desactivada y que el modo es solo para pruebas
  locales (condiciones: tareas 4 y 5).
- **`GET /`:** `barreras_activas.modelo_sin_seña` es `false` (§1.3).

Dos detalles para la equivalencia exacta:

- **`ratio_con_mano` se calcula como `con_mano / L` y se redondea a 3 decimales**, como hoy. No se
  usa `1 − ratio_sin_manos()`: en coma flotante, `1 − (1 − x)` puede no ser `x`, y en valores
  como 1/80 = 0,0125 el redondeo puede caer al otro lado.
- **La barrera `sin_mano` compara el valor ya redondeado** con 0,3, como hace hoy
  `_respuesta_dinamica`.

### 2.5 `/clasificar_frames` portada

1. `entrada.decodificar_cuadros(frames)` valida cada cuadro (§6), lo decodifica con
   `base64.b64decode(..., validate=True)` y `cv2.imdecode`. Si un JPEG válido no se decodifica
   (`imdecode` devuelve `None`), se salta, como hoy.
2. `extraction.crear_detector(modelo.cfg_extraccion, modo_video=True)`, un detector por petición
   como hoy, y `extraction.detectar_frame(detector, imagen, i * paso_ms)`, con
   `paso_ms = max(1, round(1000 / fps))`.
3. `extraction.frames_a_secuencia(detectados, fps_muestreo=req.fps)` → `SecuenciaCruda`.
4. `modelo.ranking(cruda)` + `barreras.evaluar` → `RespuestaDinamica`.

No se usa `scripts/holistic_pipeline`. El detector se cierra en un `finally`.

### 2.6 `/clasificar_video`

Pasa a usar
`extraction.extraer_video(ruta, modelo.cfg_extraccion, con_dispositivo=False, max_cuadros=ajustes.max_cuadros_video)`.
Los dos parámetros son nuevos; sus valores por defecto (`True` y `None`) dejan el entrenamiento
como está.

- `con_dispositivo=False` evita que el servidor ejecute `ffprobe` sobre un archivo que mandó un
  cliente: es superficie de ataque y puede tardar hasta 20 s (su timeout).
- `max_cuadros` corta la extracción en cuanto se pasa del tope (§6).

El archivo temporal se borra en `finally`, como hoy.

### 2.7 Paquetes nuevos

```
ai_module/inferencia/
    __init__.py
    ajustes.py      Ajustes (pydantic-settings), §3
    puerto.py       ModeloDinamico (Protocol)
    barreras.py     §2.4
    entrada.py      validación y decodificación de cuadros y video, límites de tamaño (§6)
    respuestas.py   modelos Pydantic de salida + armar_respuesta_dinamica
```

`server.py` queda como composición: rutas, `lifespan` y middleware. Los `print` de `server.py`
y `model/predict.py` pasan a `logging` (logger `senaplay.ia`).

---

## 3. Configuración

`ai_module/inferencia/ajustes.py`, con `pydantic-settings` (dependencia nueva, versión fija en
`requirements-server.txt` y `requirements.txt`):

```python
class Ajustes(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore", case_sensitive=False)

    modelo_dinamico: Literal["tcn", "lstm"] = "tcn"           # MODELO_DINAMICO
    ruta_modelo_tcn: Path = DIR / "data/models/dinamico_tcn.pt"   # RUTA_MODELO_TCN
    ruta_modelo_lstm: Path = DIR / "models_saved/dinamico.pt"     # RUTA_MODELO_LSTM
    ruta_modelo_estatico: Path = DIR / "models_saved/estatico.pkl"  # RUTA_MODELO_ESTATICO
    precargar_modelos: bool = False                           # PRECARGAR_MODELOS (ya existe)

    # Límites de entrada (§6). Cada campo se lee de la variable de entorno en mayúsculas.
    max_cuadros_tramo: PositiveInt = 120                      # /clasificar_frames y /clasificar_secuencia
    max_cuadros_video: PositiveInt = 300                      # cuadros muestreados de /clasificar_video
    max_bytes_cuadro: PositiveInt = 256 * 1024                # base64 de un cuadro JPEG
    max_bytes_video: PositiveInt = 8 * 1024 * 1024            # base64 del video
    max_bytes_cuerpo_frames: PositiveInt = 8 * 1024 * 1024
    max_bytes_cuerpo_video: PositiveInt = 9 * 1024 * 1024
    max_bytes_cuerpo: PositiveInt = 1024 * 1024               # resto de las rutas

    @model_validator(mode="after")
    def _archivos_existen(self) -> Self: ...   # estático + solo el dinámico elegido

    @model_validator(mode="after")
    def _limites_coherentes(self) -> Self: ...
    # max_bytes_cuadro ≤ max_bytes_cuerpo_frames y max_bytes_video < max_bytes_cuerpo_video
```

Todo lo configurable del servidor está en este único objeto, validado al arrancar. No quedan
constantes sueltas para los límites. Las constantes de las barreras (0,3, 0,08 y 0,5) siguen en
`barreras.py`: cambiarlas es recalibrar, que es la tarea 5.

- `case_sensitive=False` afecta solo al **nombre** de la variable. El **valor** de
  `MODELO_DINAMICO` se compara tal cual: `TCN` o `Lstm` se rechazan con un mensaje que lista los
  valores válidos.
- Solo se exige que exista el archivo del modelo dinámico elegido. Si falta `dinamico.pt`, eso no
  impide arrancar con `tcn`.
- Las rutas relativas se resuelven desde `ai_module/`, no desde el directorio de trabajo.

**Arranque (`lifespan`):**

1. `Ajustes()`. Si falla, se registra con `logger.critical` un mensaje en español que dice qué
   variable falló y por qué, y se lanza `RuntimeError`. Uvicorn muestra
   `Application startup failed. Exiting.` y el proceso termina con código distinto de cero.
2. **El modelo dinámico se carga siempre al arrancar** (hoy, solo con `PRECARGAR_MODELOS=1`).
   Es la única forma de validar los invariantes de §2.3 antes de recibir tráfico. Pesa ~1 MB.
   Efecto: el arranque local tarda un poco más y `/` siempre informa
   `modelo_dinamico_listo: true`.
3. El estático sigue como hoy: perezoso, salvo con `PRECARGAR_MODELOS=1` (Dockerfile). Pesa
   35 MB.
4. Se registra con `logger.info`: modelo activo, arquitectura, clases, T, dimensión y
   `clase_rechazo`.

Los modelos quedan en `app.state`, no en variables globales del módulo. Las pruebas inyectan sus
`Ajustes` con un `crear_app(ajustes)` que `server.py` usa para exponer `app = crear_app()`. Así
`uvicorn server:app` y el `CMD` del Dockerfile no cambian.

---

## 4. Verificación de equivalencia

**Pregunta:** con `MODELO_DINAMICO=tcn`, ¿el servidor nuevo responde lo mismo que
`gestilingo-dev@d9f6cd4`?

### 4.1 Montaje

- **Referencia:** `ai_module/` de `d9f6cd4`, extraído con
  `git archive d9f6cd4 ai_module | tar -x -C <dir_ref>`. No se modifica. *(En la
  implementación, el worktree desacoplado que se planeó primero no se pudo crear: Windows
  rechaza las rutas largas de `.claude/skills/` dentro del scratchpad. `git archive` extrae solo
  `ai_module/`, que es lo único que hace falta, y el commit queda anotado en `COMMIT`.)*
- **Candidato:** `feat/integracion-pipeline` (HEAD), con `MODELO_DINAMICO=tcn`.
- **El mismo intérprete y el mismo entorno para los dos**, así que torch, numpy y MediaPipe no
  explican ninguna diferencia.
- **Orquestador** `ai_module/scripts/verificar_equivalencia.py` (se commitea). Genera los casos,
  lanza un subproceso por árbol (cada uno importa *su* `server.py`, así los módulos `server`,
  `model` y `scripts` no chocan) y compara los JSON. Escribe el resumen y el commit de cada árbol
  en `docs/ai/integracion_verificacion.md` y el detalle en
  `docs/tesis/resultados_ia/integracion/equivalencia.csv`.
- **Conductor** `ai_module/tests/equivalencia/conductor.py`. Corre dentro de cada árbol, usa
  `TestClient` y, en los casos B y C, reemplaza solo la detección de MediaPipe por detecciones
  sintéticas fijas. En la referencia, las convierte al dict legado (`pose[:17]`,
  `cara[ÍNDICES_CARA]`), que es exactamente lo que hace la capa de compatibilidad.

### 4.2 Casos (todos sintéticos, semillas fijas, ninguna persona)

| | Ruta | Entrada | Qué cubre |
|---|---|---|---|
| A | `/clasificar_secuencia` | 200 matrices (N, 527) de `tests/sintetico.py`, con N de 8 a 120, más casos sin manos y todo ceros | TCN + remuestreo, sin MediaPipe |
| B | `/clasificar_frames` | 200 secuencias crudas sintéticas, como cuadros JPEG grises válidos; la detección del cuadro *i* devuelve el cuadro *i* de la secuencia | Decodificación, barreras, respuesta y modelo |
| C | `/clasificar_video` | Las mismas secuencias de B, escritas como un MP4 sintético con `cv2.VideoWriter` a 30 fps (y a 60, para que el submuestreo actúe). Se decodifica el video de verdad; solo se reemplaza la detección por cuadro (`scripts.extract_landmarks.detectar_frame` en la referencia, `preprocessing.extraction.detectar_frame` en el candidato). En el candidato, `ffprobe` se reemplaza por una función que hace fallar el caso si se llama | Ruta de video completa: decodificación, submuestreo, barreras, y que `ffprobe` no corre |
| D | `/clasificar_frames` y `/clasificar_video` | Sin reemplazos: MediaPipe real sobre ruido, colores planos y degradados, y un MP4 sintético escrito con `cv2.VideoWriter` | Que el cableado de MediaPipe sea el mismo (se espera `sin_mano` en ambos) |
| E | `/clasificar` | 200 manos sintéticas de 21×3 | El estático no cambió con el merge |
| F | todas | Entradas inválidas que la referencia ya maneja (cuadros vacíos, 121 cuadros, `fps = 0`, base64 roto) | Mismo código HTTP |

En B y C se fuerzan los bordes:

- mano quieta (`poco_movimiento`);
- menos de 30 % de cuadros con mano (`sin_mano`);
- **L = 80 con 23, 24 y 25 cuadros con mano** (ratio 0,2875, 0,3 exacto y 0,3125);
- otros ratios de la forma k/n con un 5 en el cuarto decimal (1/80, 3/80, 7/40);
- movimiento en 0,08 ± 1e-3;
- pose en menos de la mitad de los cuadros (`movimiento_muñeca = None`);
- secuencias en que la TCN responde `ninguna`.

### 4.3 Criterio de aprobación

Por caso:

- mismo código HTTP;
- misma `seña`, mismo `motivo` y mismo `es_seña`;
- `|Δ confianza| ≤ 1e-4`;
- `alternativas` con las mismas clases en el mismo orden y `|Δ| ≤ 1e-4`;
- `movimiento_muñeca` con `|Δ| ≤ 1e-3` (se redondea a 3 decimales);
- `frames_procesados` y `ratio_con_mano` exactamente iguales.

**Empates:** la TCN nueva rellena con `F.pad` en vez del `padding` de `Conv1d`. Es la misma
operación, pero puede diferir en el último bit. Si las dos mejores clases de la referencia
difieren en menos de 1e-4 y salen invertidas, el caso se informa como empate, no como falla, y se
lista. Cualquier otra diferencia hace fallar la verificación.

Las diferencias **esperadas** (las filas «Nuevo» y «Sí» de §1.3) se prueban aparte, en las
pruebas de contrato. No forman parte de la equivalencia.

Además, dentro de `pytest` y sin el worktree:

- `barreras.movimiento_muñecas(cruda)` frente a una copia literal del `_movimiento_muñecas`
  actual sobre la matriz, en 500 secuencias aleatorias;
- `TCNLegado.ranking(cruda)` frente a la referencia legada (`secuencia_a_matriz` +
  `remuestrear_temporal` y una copia literal del `ModeloTCN` de `gestilingo-dev`), con el
  checkpoint real.

---

## 5. Plan de unión

```bash
git switch -c feat/integracion-pipeline gestilingo-dev
git merge --no-ff feat/ia-comparacion-temporal
```

### 5.1 Conflictos

Verificados con `git merge-tree --write-tree gestilingo-dev feat/ia-comparacion-temporal`: son
**5 archivos de texto**.

| Archivo | Resolución |
|---|---|
| `.gitignore` | Unión de los dos bloques: el de `gestilingo-dev` (`!dinamico_tcn.pt`, `data/raw/lsch_kaggle/`) y el de la otra rama (manifiesto, señantes, `results/`, `.venv/`, `models_saved/historial/`). |
| `ai_module/model/train_static.py` | Base de `gestilingo-dev`: `LETRAS_CON_MOVIMIENTO`, `DATOS_POR_DEFECTO`, `cargar_varios`, `--datos` con varios directorios, `--excluir` y `--aug 8`. Más `construir_pipeline(modelo)` de la otra rama, y `entrenar` lo usa en vez del bloque en línea. |
| `ai_module/model/predict.py` | Versión de la otra rama (carga desde el meta) más `CLASE_SIN_SEÑA` y un `probabilidades(matriz)` provisional que delega en el preprocesador. Lo necesita el `server.py` de `gestilingo-dev` hasta el commit 3. |
| `ai_module/scripts/holistic_pipeline.py` | Capa de compatibilidad de la otra rama más `POSE_MUÑECA_IZQ = 15` y `POSE_MUÑECA_DER = 16`, que agregó `gestilingo-dev` y que importa su `server.py`. |
| `ai_module/server.py` | **El de `gestilingo-dev` completo.** El servidor de la otra rama no tiene `/clasificar_frames` ni las barreras. Se reemplaza en los commits siguientes, no en el merge. |

Sin conflicto, pero hay que revisarlos:

- **`ai_module/models_saved/estatico.pkl` no entra en conflicto:** solo `gestilingo-dev` lo
  cambió desde la base. El merge conserva solo el de 21 letras (35 MB). Se verifica con
  `git diff gestilingo-dev -- ai_module/models_saved/estatico.pkl` vacío y con una prueba que
  carga el modelo y comprueba 21 clases sin G, J, Ñ, S, X ni Z.
- **Los 147 `.npy` de `data/landmarks_kaggle/` están en las dos ramas** y son idénticos (no hay
  conflicto).
- **`ai_module/README.md`** se une solo; se revisa a mano.
- **Conflicto semántico:** `tests/test_server.py` de la otra rama parchea
  `server.RUTAS_MODELO_DINAMICO`, que no existe en el `server.py` resuelto. En el merge se ajusta
  lo mínimo para que `pytest` quede en verde, y se reescribe en el commit 3. Va anotado en el
  mensaje del merge.
- **`config/experimentos/estatico_rf.yaml`** dice `n_aug: 4  # igual que el valor por defecto de
  train_static.py`. Tras el merge, el valor por defecto es 8. Ese archivo lo leen dos scripts:
  - `training/eval_static.py` (26 letras, solo Roboflow) toma de ahí `datos` y `aumento.n_aug`;
  - `training/eval_static_produccion.py` (21 letras, Tabla 29) toma solo `datos`, la caché de
    landmarks por imagen. Su `n_aug` sale de `--aug`, que por defecto vale
    `N_AUG_PRODUCCION = 8`.

  Se corrige solo el comentario, para que diga quién usa el 4 y que la Tabla 29 usa 8. **El valor
  4 no cambia.**

El merge commit debe quedar funcional: el servidor de `gestilingo-dev` corre sobre la capa de
compatibilidad, y `pytest` pasa.

### 5.2 Commits (fase 2)

0. `docs(ia): diseño de la integración del pipeline con gestilingo-dev` (este documento)
1. `merge: une feat/ia-comparacion-temporal en feat/integracion-pipeline`
2. `feat(ia): configuración del servidor validada al arrancar` (`inferencia/ajustes.py` + pruebas + `pydantic-settings`)
3. `refactor(ia): puerto ModeloDinamico con adaptadores TCN legada y LSTM`
4. `refactor(ia): barreras de rechazo sobre SecuenciaCruda`
5. `feat(ia): /clasificar_frames sobre preprocessing.extraction` (incluye validación de entrada, §6)
6. `feat(ia): es_seña, motivo y alternativas en /clasificar_frames y /clasificar_video`
7. `fix(ia): normaliza separadores en cargar_signers()` (tarea 6, aparte)
8. `chore: ignora data/processed_landmarks_estaticos/`
9. `docs(ia): aclara qué script usa n_aug de estatico_rf.yaml`
10. `test(ia): verificación de equivalencia con gestilingo-dev`

`requirements-test.txt` entra en el commit 2, junto con `pydantic-settings`.

Cada commit deja `pytest` en verde. Los mensajes van en español y con Conventional Commits.

---

## 6. Seguridad de entrada

El servidor es público (Hugging Face) y cada cuadro cuesta CPU de MediaPipe. Los límites son
campos de `Ajustes` (§3), con valores por defecto y validados al arrancar. La lógica que los
aplica vive en `inferencia/entrada.py`.

| Límite (`Ajustes`) | Por defecto | Respuesta |
|---|---|---|
| `max_cuadros_tramo` (`/clasificar_frames`, `/clasificar_secuencia`) | 120 (ya existía en frames) | 422 |
| `max_cuadros_video`: cuadros muestreados que procesa MediaPipe | 300 | 413 |
| `max_bytes_cuadro`: un cuadro, en caracteres base64 | 256 KiB | 413 `El cuadro 7 pesa 312 KB; el máximo es 256 KB` |
| `max_bytes_cuerpo_frames`: cuerpo de `/clasificar_frames` | 8 MiB | 413 |
| `max_bytes_video`: `video_base64` | 8 MiB | 413 |
| `max_bytes_cuerpo_video`: cuerpo de `/clasificar_video` | 9 MiB | 413 |
| `max_bytes_cuerpo`: cuerpo de las demás rutas | 1 MiB | 413 |

**Tope de cuadros del video: se responde 413, no se trunca.** Truncar devolvería, sin avisar, la
clasificación de un fragmento como si fuera el video entero. El 413 deja claro que la entrada no
se procesó. Además, la extracción se corta en el cuadro 301: un video largo no consume CPU de
MediaPipe más allá del tope. El tope cuenta los cuadros **después** del submuestreo a
`fps_muestreo`, que son los que pasan por MediaPipe. La app graba como máximo 4 s
(`DURACION_MAX_GRABACION_MS = 4000`), unos 120 cuadros a 30 fps, así que con sus entradas nunca
se alcanza y la equivalencia no cambia.

**Cómo se eligieron:** son cotas, no mediciones. El visor manda JPEG de 480 px de ancho como
máximo, con calidad 0,7, a 15 fps, en tramos de hasta 3,4 s (≈ 51 cuadros), y clips de video de
hasta 4 s. Los límites dejan holgura amplia sobre eso. En la fase 3 se registran (solo en el log
del servidor local, sin guardar imágenes) el tamaño máximo real de cuadro, de tramo y de video. Si
alguno queda a menos del doble del límite, se ajusta antes del merge.

**Límite del cuerpo:** un middleware ASGI propio rechaza con 413 si `Content-Length` supera el
límite de la ruta, antes de leer el cuerpo. Si la petición no trae `Content-Length` (chunked),
cuenta los bytes mientras los recibe y corta al pasarse. Sin esto, FastAPI arma el JSON completo
en memoria antes de que Pydantic pueda aplicar `max_length`.

**Cuadros JPEG** (`/clasificar_frames`):

1. Si el cuadro trae prefijo, debe ser exactamente `data:image/jpeg;base64,`. Sin prefijo también
   se acepta, como hoy. Cualquier otro prefijo, por ejemplo `data:image/png;base64,`, da 422:
   `El cuadro 3 no es JPEG (data:image/png)`.
2. Base64 estricto (`validate=True`). Si falla, 422: `El cuadro 3 no es base64 válido`.
3. Los bytes deben empezar con la marca JPEG `FF D8 FF`. Si no, 422: `El cuadro 3 no es un JPEG`.
4. Pasada la validación, si `cv2.imdecode` igual devuelve `None`, el cuadro se salta, como hoy. Si
   no queda ninguno, 422: `Ningún cuadro se pudo decodificar`.

**Video** (`/clasificar_video`):

1. Se compara el tipo base de `mime`, sin parámetros: `video/webm;codecs=vp8` cuenta como
   `video/webm`. Solo se aceptan `video/webm` y `video/mp4`. Otro valor da 422:
   `Formato de video no admitido: video/quicktime`. Hoy, cualquier `mime` sin `webm` se trata
   como `.mp4`.
2. Base64 estricto. Si falla, 422.
3. No se ejecuta `ffprobe` (§2.6).
4. Los mensajes al cliente no incluyen excepciones internas ni rutas de archivos; el detalle va
   al log.

---

## 7. Plan de pruebas

Todas con `pytest`, desde `ai_module/`. Las que necesitan MediaPipe real llevan el marcador
`mediapipe`, que ya existe en `pytest.ini`.

| Archivo | Qué prueba |
|---|---|
| `tests/test_ajustes.py` | Valor por defecto `tcn`; `MODELO_DINAMICO=xyz` y `=TCN` fallan con mensaje claro; archivo inexistente falla y nombra la variable; con `lstm` no se exige el `.pt` de la TCN; rutas relativas desde `ai_module/`; límites no positivos o incoherentes fallan; el servidor no arranca (`TestClient` en contexto lanza) con ajustes inválidos. |
| `tests/test_barreras.py` | `sin_mano` con L = 80 y 23, 24 y 25 cuadros con mano, y con 1/80, 3/80 y 7/40, comparado con la fórmula legada copiada literalmente; mano quieta da `poco_movimiento`; 0,08 ± ε; sin pose o con pose en menos de la mitad de los cuadros da `None`; precedencia de los tres motivos; con `clase_rechazo=None` nunca sale `modelo_sin_seña`, aunque el modelo responda `ninguna`; `barreras_activas`; equivalencia con el `_movimiento_muñecas` legado en 500 secuencias. |
| `tests/test_modelos_dinamicos.py` | `TCNLegado` con el checkpoint real: 10 clases, `ninguna`, T = 60, 527, spec 1.0. `LSTMExportado` real: 9 clases, T = 30, 1577, spec 2.0, sin `ninguna`. El ranking viene ordenado, suma ≈ 1 y tiene una entrada por clase. Invariante roto (ruta TCN → archivo LSTM y al revés) lanza. `ranking_vectores_v1` con ancho distinto o vacío lanza `ValueError`. Equivalencia numérica de la TCN con la referencia legada. |
| `tests/test_entrada.py` | Prefijo JPEG, sin prefijo, PNG, base64 roto, bytes no JPEG, cuadro sobre el límite (413), cuerpo sobre el límite con y sin `Content-Length` (413), `mime` con parámetros, `mime` no admitido. |
| `tests/test_server.py` (reescrito) | Contrato de las 4 rutas **en los dos modos** (fixture parametrizada `tcn`/`lstm` con los modelos reales): claves exactas, tipos, `alternativas` ≤ 2, `motivo` del enum, `es_seña == (motivo is None)`, redondeos, todos los códigos de §1.3, y el 413 por el tope de cuadros del video. Detección reemplazada por secuencias sintéticas. `GET /` con las 4 claves de siempre, más `modelo_dinamico`, `clases_dinamicas` y `barreras_activas`, según el modo. Con `lstm`, el log de arranque contiene la advertencia. |
| `tests/test_server_mediapipe.py` (`mediapipe`) | `/clasificar_frames` y `/clasificar_video` de extremo a extremo con imágenes y un MP4 sintéticos, en los dos modos. |
| `tests/test_estatico.py` | El `estatico.pkl` cargado tiene exactamente 21 clases, sin G, J, Ñ, S, X ni Z. |
| `tests/test_manifest.py` | Tarea 6: una fila de `signers.csv` con `s01\\video.mp4` calza con la clave `s01/video.mp4`. |
| `tests/test_importaciones.py` | Importar `server` no carga `pandas` ni `training`, así la imagen de Docker no necesita más dependencias que las de `requirements-server.txt`. Los scripts legados (`extract_landmarks`, `train_model`, `augmentation`, `generar_negativos`, `visualize_results`) se importan sin error. |
| `scripts/verificar_equivalencia.py` | §4. Se ejecuta aparte: necesita el worktree de referencia. |

No se toca `src/` ni `web/`. Se verifica con `git diff --stat gestilingo-dev -- src web`, que
debe salir vacío, así que no hace falta correr `pnpm test` ni `verify:bundle`.

---

## 8. Riesgos y reversión

### 8.1 Reversión

Hay dos formas de volver atrás, de menor a mayor alcance:

1. **`MODELO_DINAMICO=tcn`.** Es el valor por defecto. Si alguien probó con `lstm`, basta con
   quitar la variable o fijarla en `tcn` y reiniciar el servidor, sin tocar el código. Deja el
   modelo dinámico de producción con sus tres barreras.
2. **Revertir el merge commit.** `git revert -m 1 <merge>` sobre la rama donde se haya unido
   `feat/integracion-pipeline` deja el código como en `gestilingo-dev@d9f6cd4`. No reescribe la
   historia ni requiere push forzado.

Además:

- **Nada de esto toca producción:** la app sigue apuntando al Space de Hugging Face, que no se
  redespliega, y `gestilingo-dev` no cambia hasta que tú unas la rama.
- **Dentro de la rama**, cada paso es un commit atómico y se puede revertir solo, con
  `git revert <commit>`.
- **El `estatico.pkl` de 21 letras queda verificado por una prueba**
  (`tests/test_estatico.py`): exactamente 21 clases, sin G, J, Ñ, S, X ni Z. Si un merge o un
  reentrenamiento lo cambiara, `pytest` falla.
- **El punto de retorno es `gestilingo-dev@d9f6cd4`,** anotado aquí y en el mensaje del merge.

### 8.2 Riesgos

| Riesgo | Mitigación |
|---|---|
| La TCN reimplementada (`F.pad`) da números distintos de los de producción | Prueba numérica con el checkpoint real y la verificación de §4 (tolerancia 1e-4). |
| El merge rompe los scripts legados (`extract_landmarks`, `train_model`, `augmentation`, `generar_negativos`) | Revisado: todos los símbolos que importan los exporta la capa de compatibilidad, salvo `POSE_MUÑECA_*`, que se agregan en la resolución. Una prueba importa cada script. |
| El Python global no es el de producción: fastapi 0.136.3, mediapipe 0.10.35 y scikit-learn 1.9.0, frente a 0.141.1, 1.0.1 y 1.9.1 fijados en `requirements-server.txt` | Se usa `ai_module/.venv` (Python 3.11, como el Dockerfile) con `requirements-server.txt`. La equivalencia, la fase 3 y la latencia corren ahí, y cada medición guarda su `pip freeze` en `entorno.json`. |
| `estatico.pkl` se entrenó con scikit-learn 1.9.0 (carga sin advertencia en 1.9.0), pero `requirements-server.txt` fija 1.9.1 y dice que son las versiones del entrenamiento | Ya ocurre en `gestilingo-dev` y en producción; no se corrige aquí. Con el `.venv`, scikit-learn emite `InconsistentVersionWarning`. La prueba de equivalencia del caso E muestra si cambia alguna predicción. |
| Dependencia nueva (`pydantic-settings`) | Versión fija y compatible con `pydantic==2.13.5`. La imagen de Docker solo se reconstruye al desplegar, que está fuera de alcance. |
| `ffprobe` sobre archivos de clientes | `con_dispositivo=False` en el servidor (§2.6). |
| Con `lstm`, más falsos positivos (no hay clase de rechazo) | Solo para pruebas locales; el log de arranque lo advierte. Condición para producción: tareas 4 y 5. |
| Un límite de §6 corta tramos reales | Holgura amplia; se mide en la fase 3 y se ajusta antes de cerrar. |
| `paso` de muestreo del video: el código nuevo redondea los fps a 3 decimales antes de dividir (`metadatos_video`) y el legado no | Solo difiere si `fps_fuente / 30` cae justo en x,5 (por ejemplo, 45 fps exactos). Queda documentado y no se cambia, porque tocarlo alteraría la extracción del dataset. |
| Cargar el dinámico al arrancar cambia el arranque local | Pesa ~1 MB. A cambio, falla rápido si el modelo no corresponde. |

---

## Decisiones de la revisión (2026-10-31)

1. **`/clasificar` con forma inválida da 422.** La app trata igual cualquier `!resp.ok`.
2. **Entorno:** `ai_module/.venv` con `requirements-server.txt` (Python 3.11), ignorado en
   `.gitignore`. Cada medición guarda su `pip freeze` en `entorno.json`. Las dependencias que
   faltan para `pytest` van en `requirements-test.txt`, que incluye `requirements-server.txt`.
3. **`estatico_rf.yaml`:** solo se corrige el comentario (§5.1); `n_aug: 4` se queda.
4. **Tope de cuadros del video:** `max_cuadros_video = 300` en `Ajustes`. Si se supera,
   **413** y la extracción se corta (§6).
5. **Modo LSTM sin clase de rechazo, explícito:** advertencia en el log de arranque,
   `modelo_dinamico`, `clases_dinamicas` y `barreras_activas` en `GET /`, y en ese modo `motivo`
   nunca vale `modelo_sin_seña` (§2.4).
6. **Un solo objeto de ajustes:** límites, topes y `MODELO_DINAMICO` en `Ajustes`, validados al
   arrancar (§3).
7. **`sin_mano` en el límite:** L = 80 con 23, 24 y 25 cuadros con mano, contra el servidor de
   referencia (§4.2) y en `pytest` (§7).
8. **La equivalencia cubre `/clasificar_video`** con decodificación real del video y `ffprobe`
   desactivado (§4.2, caso C).
9. **Reversión:** `MODELO_DINAMICO=tcn` o revertir el merge commit, y `estatico.pkl` verificado
   por una prueba (§8.1).
