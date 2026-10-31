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
from inferencia.respuestas import (
    RespuestaDinamica,
    RespuestaEstatica,
    respuesta_dinamica,
    respuesta_estatica,
)
from preprocessing import extraction
from preprocessing.extraction import SecuenciaCruda

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


@rutas.post("/clasificar", response_model=RespuestaEstatica)
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
    return respuesta_estatica(*modelo.predecir(landmarks))


@rutas.post("/clasificar_secuencia", response_model=RespuestaEstatica)
def clasificar_seña_dinamica(req: SecuenciaMano, request: Request):
    """
    Clasifica una seña con movimiento a partir de una secuencia de vectores
    holísticos en formato 1.0 (ver SecuenciaMano). Sin barreras de rechazo:
    con vectores ya normalizados no hay landmarks crudos para calcularlas.
    """
    modelo = _modelo_dinamico(request)
    maximo = request.app.state.ajustes.max_cuadros_tramo
    if len(req.frames) > maximo:
        raise HTTPException(422, f"La secuencia trae {len(req.frames)} cuadros; el máximo es {maximo}")
    try:
        seña, confianza = modelo.ranking_vectores_v1(np.array(req.frames, dtype=np.float32))[0]
    except ValueError as e:  # filas de distinto largo, ancho ≠ 527 o secuencia vacía
        raise HTTPException(422, str(e))
    return respuesta_estatica(seña, confianza)


@rutas.post("/clasificar_video", response_model=RespuestaDinamica)
def clasificar_seña_video(req: VideoSena, request: Request):
    """
    Clasifica una seña con movimiento a partir de un clip de video (grabado en
    el WebView). Extrae los landmarks con el mismo módulo que generó el dataset
    de entrenamiento (preprocessing.extraction), con los parámetros de MediaPipe
    del modelo activo, y responde igual que /clasificar_frames.
    """
    modelo = _modelo_dinamico(request)
    ajustes = request.app.state.ajustes

    datos, sufijo = entrada.validar_video(req.video_base64, req.mime, ajustes.max_bytes_video)
    ruta_temp = None
    try:
        with tempfile.NamedTemporaryFile(suffix=sufijo, delete=False) as archivo_temp:
            archivo_temp.write(datos)
            ruta_temp = archivo_temp.name
        # Sin ffprobe: no se ejecuta un programa externo sobre un archivo del cliente.
        cruda = extraction.extraer_video(ruta_temp, modelo.cfg_extraccion, con_dispositivo=False,
                                         max_cuadros=ajustes.max_cuadros_video)
    except extraction.DemasiadosCuadros as error:
        raise entrada.EntradaInvalida(
            413, f"El video tiene más de {error.maximo} cuadros; el máximo es {error.maximo}")
    except Exception:
        # El detalle (que puede traer la ruta del archivo temporal) va al log, no al cliente.
        logger.warning("No se pudo procesar el video", exc_info=True)
        raise HTTPException(422, "No se pudo procesar el video")
    finally:
        if ruta_temp and os.path.exists(ruta_temp):
            os.remove(ruta_temp)

    if len(cruda) == 0:
        raise HTTPException(422, "No se detectaron frames válidos en el video")

    return _respuesta_dinamica(modelo, cruda)


@rutas.post("/clasificar_frames", response_model=RespuestaDinamica)
def clasificar_tramo_movimiento(req: TramoMovimiento, request: Request):
    """
    Clasifica con el modelo dinámico un tramo de movimiento capturado en vivo
    como cuadros JPEG. Los pasa por MediaPipe con los parámetros con que se
    extrajo el dataset del modelo activo (preprocessing.extraction).

    `es_seña` es False cuando el tramo no pasa una barrera (`motivo`): casi no
    hubo mano en cuadro, la mano no se movió, o el modelo respondió su clase de
    rechazo («ninguna», solo si la tiene). La app lo trata como "no era una
    seña con movimiento" y sigue con el modelo estático.
    """
    modelo = _modelo_dinamico(request)
    ajustes = request.app.state.ajustes
    # Todo el tramo se valida antes de crear el detector o decodificar nada.
    jpegs = entrada.validar_cuadros(req.frames, ajustes.max_cuadros_tramo, ajustes.max_bytes_cuadro)
    cuadros = entrada.decodificar_cuadros(jpegs)

    cruda = extraction.extraer_cuadros(cuadros, req.fps, modelo.cfg_extraccion)
    return _respuesta_dinamica(modelo, cruda)


def _respuesta_dinamica(modelo: ModeloDinamico, cruda: SecuenciaCruda) -> RespuestaDinamica:
    """
    Respuesta común de los endpoints dinámicos: mejor clase + las 2
    alternativas siguientes, y las barreras de rechazo calculadas sobre los
    landmarks crudos (inferencia/barreras.py).
    """
    ranking = modelo.ranking(cruda)
    evaluacion = barreras.evaluar(cruda, ranking[0][0], modelo.clase_rechazo)
    return respuesta_dinamica(ranking, evaluacion, len(cruda))


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
