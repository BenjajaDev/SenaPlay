"""
Servidor FastAPI para el módulo de IA de SeñaPlay.

Ofrece:
  - Clasificación de señas estáticas (foto instantánea de mano)
  - Clasificación de señas con movimiento (secuencia de frames)
  - Comparación de pose del usuario vs. pose de referencia
  - Servicio de poses de referencia para el modo práctica del app

Cómo iniciar:
    uvicorn server:app --host 0.0.0.0 --port 8000 --reload

La configuración (modelo dinámico activo, rutas de los modelos y límites de
entrada) se lee del entorno y se valida al arrancar: ver inferencia/ajustes.py.
Si no es válida, el servidor no arranca y dice por qué.

En producción corre en Hugging Face Spaces con el Dockerfile de esta carpeta
(ver docs/05-despliegue.md).

Usar 0.0.0.0 en lugar de localhost permite que el celular
conecte al servidor a través de la red local (WiFi compartida).
"""

import base64
import json
import logging
import os
import tempfile
from contextlib import asynccontextmanager

import numpy as np
from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional

from inferencia import barreras, entrada
from inferencia.ajustes import Ajustes, AjustesInvalidos, cargar_ajustes
from inferencia.modelos import cargar_modelo_dinamico
from inferencia.puerto import ModeloDinamico
from preprocessing import extraction
from preprocessing.extraction import SecuenciaCruda
from scripts.extract_landmarks import _extraer_video
from scripts.holistic_pipeline import POSE_MUÑECA_DER, POSE_MUÑECA_IZQ, SLICE_POSE

logger = logging.getLogger("senaplay.ia")

# ── Carga inicial de datos de referencia ──────────────────────────────────────

_DIRECTORIO = os.path.dirname(__file__)
_RUTA_REFERENCIA = os.path.join(_DIRECTORIO, "signs_reference.json")

with open(_RUTA_REFERENCIA, "r", encoding="utf-8") as _archivo:
    # Las claves que empiezan con "_" son comentarios del archivo, no señas
    SEÑAS_REFERENCIA: dict = {
        clave: datos
        for clave, datos in json.load(_archivo).items()
        if not clave.startswith("_")
    }


def _configurar_log() -> None:
    """
    Uvicorn configura sus propios loggers, no el raíz: sin esto, los avisos de
    arranque de `senaplay.*` no se verían. Si el raíz ya tiene handlers (pytest,
    otro servidor), se respetan.
    """
    raiz = logging.getLogger("senaplay")
    if raiz.handlers or logging.getLogger().handlers:
        return
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(levelname)s:     %(name)s - %(message)s"))
    raiz.addHandler(handler)
    raiz.setLevel(logging.INFO)


def _obtener_modelo_estatico(app: FastAPI):
    """Carga el clasificador estático (RandomForest) si aún no está en memoria."""
    if app.state.modelo_estatico is None:
        try:
            from model.predict import ClasificadorEstatico
            app.state.modelo_estatico = ClasificadorEstatico(
                str(app.state.ajustes.ruta_modelo_estatico))
        except Exception:
            logger.exception("No se pudo cargar el modelo estático")
    return app.state.modelo_estatico


def _modelo_dinamico(request: Request) -> ModeloDinamico:
    modelo = getattr(request.app.state, "modelo_dinamico", None)
    if modelo is None:
        raise HTTPException(503, "Modelo dinámico no disponible.")
    return modelo


@asynccontextmanager
async def _ciclo_de_vida(app: FastAPI):
    _configurar_log()
    try:
        ajustes = app.state.ajustes_fijos or cargar_ajustes()
    except AjustesInvalidos as error:
        logger.critical("%s", error)
        raise
    app.state.ajustes = ajustes
    app.state.modelo_estatico = None
    # El dinámico se carga siempre al arrancar: si el archivo no corresponde al
    # modelo configurado, es mejor que el servidor no arranque.
    try:
        modelo = cargar_modelo_dinamico(ajustes)
    except Exception:
        logger.critical("No se pudo cargar el modelo dinámico %r desde %s; el servidor no arranca",
                        ajustes.modelo_dinamico, ajustes.ruta_modelo_dinamico, exc_info=True)
        raise
    app.state.modelo_dinamico = modelo
    logger.info("Modelo dinámico activo: %s, %s (%s)", modelo.nombre, modelo.describir(),
                ajustes.ruta_modelo_dinamico)
    if modelo.clase_rechazo is None:
        logger.warning(
            "El modelo dinámico %r no tiene clase de rechazo: la barrera modelo_sin_seña "
            "está desactivada y cualquier tramo con movimiento recibe alguna seña. Úsalo solo "
            "para pruebas locales (antes de producción faltan negativos reales y recalibrar "
            "umbrales: tareas 4 y 5 de docs/ai/pendientes_integracion.md).", modelo.nombre)
    if ajustes.precargar_modelos:
        _obtener_modelo_estatico(app)
    yield


# ── Esquemas de entrada/salida (Pydantic) ─────────────────────────────────────

class FrameMano(BaseModel):
    # 21 landmarks CRUDOS de MediaPipe (x, y, z en rango ~0-1), igual que el
    # entrenamiento. El cliente (app) los manda tal cual los entrega MediaPipe.
    landmarks: list[list[float]]


class SecuenciaMano(BaseModel):
    # Para señas con movimiento: N frames YA VECTORIZADOS en el formato 1.0
    # (manos + pose superior + cara reducida, 527 valores/frame; ver
    # docs/ai/feature_spec.md) — NO landmarks crudos de mano. La app todavía no
    # arma este vector en vivo (ver ai_module/README.md).
    frames: list[list[float]]
    fps: Optional[float] = 15.0  # Cuadros por segundo de la captura


class VideoSena(BaseModel):
    # Clip corto grabado en el WebView (MediaRecorder) con la misma cámara que
    # ya usa el visor de manos. Se procesa con el mismo pipeline Python que
    # generó el dataset de entrenamiento, así que no hay riesgo de desajuste
    # entre captura en vivo y entrenamiento.
    video_base64: str
    mime: str = "video/webm"


class TramoMovimiento(BaseModel):
    # Cuadros JPEG (base64, con o sin prefijo "data:image/jpeg;base64,") del
    # tramo en que el visor detectó la mano en movimiento, con un poco de
    # margen antes y después. Los manda la captura automática del WebView
    # (ver handTrackingHtml.js, sección 9b) para que el modelo dinámico
    # clasifique en sincronía con el estático, sin botón de grabar.
    # Tope generoso (el visor manda ~50 como máximo: 3 s + 0,4 s a 15 fps); el
    # servidor es público y cada cuadro cuesta ~50 ms de CPU. El tope y el
    # tamaño por cuadro salen de Ajustes (max_cuadros_tramo, max_bytes_cuadro).
    frames: list[str]
    fps: float = Field(default=15.0, gt=0, le=60)


class SolicitudComparacion(BaseModel):
    landmarks: list[list[float]]  # Mano actual del usuario
    sign_id: str                  # ID de la seña objetivo (ej: "A", "hola")


# ── Huesos de cada dedo (pares de índices de landmarks) ─────────────────────

HUESOS_POR_DEDO = {
    "pulgar":  [(0, 1), (1, 2), (2, 3), (3, 4)],
    "indice":  [(0, 5), (5, 6), (6, 7), (7, 8)],
    "medio":   [(0, 9), (9, 10), (10, 11), (11, 12)],
    "anular":  [(0, 13), (13, 14), (14, 15), (15, 16)],
    "menique": [(0, 17), (17, 18), (18, 19), (19, 20)],
}


# ── Rutas del servidor ────────────────────────────────────────────────────────

rutas = APIRouter()


@rutas.get("/")
def inicio(request: Request):
    """Estado general del servidor y modelos."""
    modelo = getattr(request.app.state, "modelo_dinamico", None)
    return {
        "app": "SeñaPlay IA de Señas",
        "modelo_estatico_listo": _obtener_modelo_estatico(request.app) is not None,
        "modelo_dinamico_listo": modelo is not None,
        "total_señas": len(SEÑAS_REFERENCIA),
        "modelo_dinamico": None if modelo is None else modelo.nombre,
        "clases_dinamicas": [] if modelo is None else list(modelo.clases),
        # En modo lstm, modelo_sin_seña es false: ese modelo no tiene clase de rechazo.
        "barreras_activas": None if modelo is None else barreras.barreras_activas(modelo.clase_rechazo),
    }


@rutas.get("/señas")
def listar_señas():
    """Lista todas las señas disponibles con sus metadatos (sin landmarks)."""
    return [
        {
            "id": clave,
            "nombre": datos["nombre"],
            "tipo": datos.get("tipo", "estatica"),
            "descripcion": datos.get("descripcion", ""),
            "dificultad": datos.get("dificultad", 1),
        }
        for clave, datos in SEÑAS_REFERENCIA.items()
    ]


@rutas.get("/seña/{seña_id}")
def obtener_seña(seña_id: str):
    """Devuelve una seña con todos sus landmarks de referencia."""
    if seña_id not in SEÑAS_REFERENCIA:
        raise HTTPException(404, f"Seña '{seña_id}' no encontrada")
    return SEÑAS_REFERENCIA[seña_id]


@rutas.post("/clasificar")
def clasificar_seña_estatica(req: FrameMano, request: Request):
    """
    Clasifica una seña estática a partir de 21 landmarks CRUDOS de MediaPipe.
    (A diferencia de /comparar, que usa poses de referencia en coordenadas world.)
    Requiere haber entrenado el modelo: python model/train_static.py
    """
    modelo = _obtener_modelo_estatico(request.app)
    if modelo is None:
        raise HTTPException(
            503,
            "Modelo estático no disponible. "
            "Primero entrénalo ejecutando: python model/train_static.py"
        )

    try:
        landmarks = np.array(req.landmarks, dtype=np.float32)
    except ValueError:  # filas de distinto largo
        landmarks = None
    if landmarks is None or landmarks.shape != (21, 3):
        raise HTTPException(422, "Se esperan exactamente 21 landmarks con [x, y, z] cada uno")
    seña, confianza = modelo.predecir(landmarks)
    return {"seña": seña, "confianza": round(float(confianza), 4)}


@rutas.post("/clasificar_secuencia")
def clasificar_seña_dinamica(req: SecuenciaMano, request: Request):
    """
    Clasifica una seña con movimiento a partir de una secuencia de vectores
    holísticos (ver SecuenciaMano).
    """
    modelo = _modelo_dinamico(request)
    maximo = request.app.state.ajustes.max_cuadros_tramo
    if len(req.frames) > maximo:
        raise HTTPException(422, f"La secuencia trae {len(req.frames)} cuadros; el máximo es {maximo}")
    try:
        seña, confianza = modelo.ranking_vectores_v1(np.array(req.frames, dtype=np.float32))[0]
    except ValueError as e:  # filas de distinto largo, ancho ≠ 527 o secuencia vacía
        raise HTTPException(422, str(e))
    return {"seña": seña, "confianza": round(float(confianza), 4)}


@rutas.post("/clasificar_video")
def clasificar_seña_video(req: VideoSena, request: Request):
    """
    Clasifica una seña con movimiento a partir de un clip de video (grabado en
    el WebView). Extrae los landmarks holísticos con el mismo pipeline que
    generó el dataset de entrenamiento (scripts.extract_landmarks) y clasifica
    con el modelo dinámico.
    """
    modelo = _modelo_dinamico(request)

    datos, sufijo = entrada.validar_video(req.video_base64, req.mime,
                                          request.app.state.ajustes.max_bytes_video)
    ruta_temp = None
    try:
        with tempfile.NamedTemporaryFile(suffix=sufijo, delete=False) as archivo_temp:
            archivo_temp.write(datos)
            ruta_temp = archivo_temp.name

        cfg_extraccion = modelo.cfg_extraccion
        matriz, stats = _extraer_video(
            ruta_temp,
            fps_muestreo=cfg_extraccion["fps_muestreo"],
            confianza_deteccion=cfg_extraccion["confianza_deteccion"],
            confianza_landmarks=cfg_extraccion["confianza_landmarks"],
        )
    except Exception:
        # El detalle (que puede traer la ruta del archivo temporal) va al log, no al cliente.
        logger.warning("No se pudo procesar el video", exc_info=True)
        raise HTTPException(422, "No se pudo procesar el video")
    finally:
        if ruta_temp and os.path.exists(ruta_temp):
            os.remove(ruta_temp)

    if matriz.shape[0] == 0:
        raise HTTPException(422, "No se detectaron frames válidos en el video")

    return _respuesta_dinamica(modelo, matriz, stats)


# Por debajo de esta fracción de cuadros con mano, el tramo no se clasifica:
# el TCN rellenaría la seña con ceros y respondería cualquier cosa.
RATIO_MIN_CON_MANO = 0.3

# Desplazamiento mínimo de la muñeca más activa (en anchos de hombro, marco
# corporal de holistic_pipeline) para considerar el tramo una seña dinámica.
# En el dataset real el mínimo es ~0.09 (J/G) y la mediana 0.3–1.0; la mano
# quieta o un cambio entre letras estáticas quedan bajo ~0.05. Es una barrera
# determinista que complementa a la clase "ninguna" del TCN, que con un
# dataset tan chico todavía deja pasar parte de esos tramos.
MOVIMIENTO_MIN_MUÑECA = 0.08
# Si la pose (hombros) se ve en menos de esta fracción de cuadros, no hay marco
# corporal fiable para medir el desplazamiento y decide solo el TCN.
RATIO_MIN_CON_POSE = 0.5


def _movimiento_muñecas(matriz: np.ndarray) -> float | None:
    """
    Rango máximo (x/y) recorrido por la muñeca más activa en el marco corporal,
    o None si la pose casi no se detectó (cuadro muy cerrado sobre la cara).
    """
    T = len(matriz)
    pose = matriz[:, SLICE_POSE].reshape(T, -1, 3)
    con_pose = np.abs(pose).sum(axis=(1, 2)) > 0
    if T == 0 or con_pose.mean() < RATIO_MIN_CON_POSE:
        return None
    muñecas = pose[con_pose][:, [POSE_MUÑECA_IZQ, POSE_MUÑECA_DER], :2]  # (T', 2, 2)
    return float(np.ptp(muñecas, axis=0).max())


@rutas.post("/clasificar_frames")
def clasificar_tramo_movimiento(req: TramoMovimiento, request: Request):
    """
    Clasifica con el modelo dinámico un tramo de movimiento capturado en vivo
    como cuadros JPEG. Los pasa por MediaPipe con los parámetros con que se
    extrajo el dataset del modelo activo (preprocessing.extraction). `es_seña` es False cuando el modelo responde su clase de
    rechazo («ninguna», si la tiene) o casi no hubo mano en cuadro: la app lo trata
    como "no era una seña con movimiento" y sigue con el modelo estático.
    """
    modelo = _modelo_dinamico(request)
    ajustes = request.app.state.ajustes
    # Todo el tramo se valida antes de crear el detector o decodificar nada.
    jpegs = entrada.validar_cuadros(req.frames, ajustes.max_cuadros_tramo, ajustes.max_bytes_cuadro)
    cuadros = entrada.decodificar_cuadros(jpegs)

    cruda = extraction.extraer_cuadros(cuadros, req.fps, modelo.cfg_extraccion)
    return _respuesta_cruda(modelo, cruda)


def _respuesta_cruda(modelo: ModeloDinamico, cruda: SecuenciaCruda) -> dict:
    """
    Respuesta común de los endpoints dinámicos: mejor clase + alternativas, y
    si el tramo cuenta como seña dinámica (`es_seña`, con `motivo` si no). Las
    barreras se calculan sobre los landmarks crudos (inferencia/barreras.py).
    """
    ranking = modelo.ranking(cruda)
    seña, confianza = ranking[0]
    evaluacion = barreras.evaluar(cruda, seña, modelo.clase_rechazo)
    movimiento = evaluacion.movimiento_muñeca
    return {
        "seña": seña,
        "confianza": round(float(confianza), 4),
        "es_seña": evaluacion.es_seña,
        "motivo": evaluacion.motivo,
        "alternativas": [
            {"seña": s, "confianza": round(float(p), 4)} for s, p in ranking[1:3]
        ],
        "movimiento_muñeca": None if movimiento is None else round(movimiento, 3),
        "frames_procesados": len(cruda),
        "ratio_con_mano": evaluacion.ratio_con_mano,
    }


def _respuesta_dinamica(modelo, matriz: np.ndarray, stats: dict) -> dict:
    """
    Respuesta común de los endpoints dinámicos: mejor clase + alternativas, y
    si el tramo cuenta como seña dinámica (`es_seña`, con `motivo` si no).
    """
    ranking = modelo.ranking_vectores_v1(matriz)
    seña, confianza = ranking[0]
    movimiento = _movimiento_muñecas(matriz)

    motivo = None
    if stats["ratio_con_mano"] < RATIO_MIN_CON_MANO:
        motivo = "sin_mano"
    elif movimiento is not None and movimiento < MOVIMIENTO_MIN_MUÑECA:
        motivo = "poco_movimiento"
    elif modelo.clase_rechazo is not None and seña == modelo.clase_rechazo:
        # Solo si el modelo tiene clase de rechazo: la LSTM no la tiene.
        motivo = "modelo_sin_seña"

    return {
        "seña": seña,
        "confianza": round(float(confianza), 4),
        "es_seña": motivo is None,
        "motivo": motivo,
        "alternativas": [
            {"seña": s, "confianza": round(float(p), 4)} for s, p in ranking[1:3]
        ],
        "movimiento_muñeca": None if movimiento is None else round(movimiento, 3),
        "frames_procesados": stats["frames"],
        "ratio_con_mano": stats["ratio_con_mano"],
    }


@rutas.post("/comparar")
def comparar_con_referencia(req: SolicitudComparacion):
    """
    Compara los landmarks actuales del usuario con la pose de referencia de una seña.
    Devuelve puntuación global (0–1) y desglose por dedo.
    El frontend usa esto para mostrar el feedback de colores en la mano 3D.
    """
    if req.sign_id not in SEÑAS_REFERENCIA:
        raise HTTPException(404, f"Seña '{req.sign_id}' no encontrada")

    landmarks_referencia = np.array(
        SEÑAS_REFERENCIA[req.sign_id]["landmarks"], dtype=np.float32
    )
    landmarks_usuario = np.array(req.landmarks, dtype=np.float32)

    if landmarks_usuario.shape != (21, 3) or landmarks_referencia.shape != (21, 3):
        raise HTTPException(422, "Se esperan exactamente 21 landmarks con [x, y, z] cada uno")

    return _calcular_similitud(landmarks_usuario, landmarks_referencia)


# ── Aplicación ────────────────────────────────────────────────────────────────

async def _responder_entrada_invalida(_request: Request, error: entrada.EntradaInvalida):
    return JSONResponse(status_code=error.status, content={"detail": error.mensaje})


def _limite_cuerpo(scope) -> int | None:
    """Bytes máximos del cuerpo según la ruta; sin ajustes cargados, sin límite."""
    ajustes = getattr(scope["app"].state, "ajustes", None)
    if ajustes is None:
        return None
    ruta = scope.get("path", "")
    if ruta == "/clasificar_frames":
        return ajustes.max_bytes_cuerpo_frames
    if ruta == "/clasificar_video":
        return ajustes.max_bytes_cuerpo_video
    return ajustes.max_bytes_cuerpo


def crear_app(ajustes: Ajustes | None = None) -> FastAPI:
    """
    Arma la aplicación. Sin `ajustes`, se leen del entorno al arrancar; las
    pruebas pasan los suyos.
    """
    aplicacion = FastAPI(title="SeñaPlay IA de Señas", version="0.4.0",
                         lifespan=_ciclo_de_vida)
    aplicacion.state.ajustes_fijos = ajustes
    aplicacion.add_exception_handler(entrada.EntradaInvalida, _responder_entrada_invalida)
    # Se agrega antes que CORS para que CORS quede por fuera y también los 413
    # lleven sus encabezados.
    aplicacion.add_middleware(entrada.LimiteCuerpo, limite_para=_limite_cuerpo)
    # Permitir peticiones desde cualquier origen (WebView de React Native incluida)
    aplicacion.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    aplicacion.include_router(rutas)
    return aplicacion


app = crear_app()


# ── Funciones de cálculo de similitud ─────────────────────────────────────────

def _normalizar_mano(landmarks: np.ndarray) -> np.ndarray:
    """
    Centra la mano en la muñeca (landmark 0) y escala
    por la distancia muñeca–base del dedo medio (landmark 9).
    Esto hace la comparación invariante a posición y tamaño de mano.
    """
    centrada = landmarks - landmarks[0]
    escala = np.linalg.norm(centrada[9])
    if escala > 1e-6:
        centrada = centrada / escala
    return centrada


def _similitud_coseno_hueso(u: np.ndarray, r: np.ndarray, i: int, j: int) -> float:
    """
    Calcula qué tan parecida es la dirección del hueso (i→j)
    entre la mano del usuario (u) y la referencia (r).
    Devuelve un valor entre 0 (completamente diferente) y 1 (idéntico).
    """
    vector_usuario = u[j] - u[i]
    vector_referencia = r[j] - r[i]
    norma_u = np.linalg.norm(vector_usuario)
    norma_r = np.linalg.norm(vector_referencia)

    if norma_u < 1e-6 or norma_r < 1e-6:
        return 1.0  # Hueso degenerado → lo consideramos correcto

    coseno = float(np.dot(vector_usuario / norma_u, vector_referencia / norma_r))
    return (coseno + 1.0) / 2.0  # Mapear [-1, 1] → [0, 1]


def _calcular_similitud(landmarks_usuario: np.ndarray, landmarks_referencia: np.ndarray) -> dict:
    """
    Compara todas las falanges de cada dedo y devuelve una puntuación
    global y por dedo. La nota A/B/C/D facilita mostrarla en la UI.
    """
    u = _normalizar_mano(landmarks_usuario)
    r = _normalizar_mano(landmarks_referencia)

    puntuaciones_por_dedo: dict[str, float] = {}
    todas_las_puntuaciones: list[float] = []

    for nombre_dedo, huesos in HUESOS_POR_DEDO.items():
        similitudes = [_similitud_coseno_hueso(u, r, a, b) for a, b in huesos]
        promedio = float(np.mean(similitudes))
        puntuaciones_por_dedo[nombre_dedo] = round(promedio, 3)
        todas_las_puntuaciones.extend(similitudes)

    puntuacion_global = round(float(np.mean(todas_las_puntuaciones)), 3)

    if puntuacion_global > 0.92:
        nota = "A"
    elif puntuacion_global > 0.82:
        nota = "B"
    elif puntuacion_global > 0.70:
        nota = "C"
    else:
        nota = "D"

    return {
        "puntuacion": puntuacion_global,
        "porcentaje": int(puntuacion_global * 100),
        "nota": nota,
        "dedos": puntuaciones_por_dedo,
    }
