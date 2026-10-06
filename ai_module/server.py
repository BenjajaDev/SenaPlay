"""
Servidor FastAPI para el módulo de IA de SeñaPlay.

Ofrece:
  - Clasificación de señas estáticas (foto instantánea de mano)
  - Clasificación de señas con movimiento (secuencia de frames)
  - Comparación de pose del usuario vs. pose de referencia
  - Servicio de poses de referencia para el modo práctica del app

Cómo iniciar:
    uvicorn server:app --host 0.0.0.0 --port 8000 --reload

Usar 0.0.0.0 en lugar de localhost permite que el celular
conecte al servidor a través de la red local (WiFi compartida).
"""

import base64
import json
import os
import tempfile

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from model.predict import CLASE_SIN_SEÑA
from scripts.dataset_config_utils import cargar_config
from scripts.extract_landmarks import _extraer_video
from scripts.holistic_pipeline import (
    POSE_MUÑECA_DER,
    POSE_MUÑECA_IZQ,
    SLICE_POSE,
    crear_detector_holistic,
    detectar_frame,
    presencia_manos,
    secuencia_a_matriz,
)

app = FastAPI(title="SeñaPlay IA de Señas", version="0.2.0")

# Permitir peticiones desde cualquier origen (WebView de React Native incluida)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# Los modelos se cargan solo cuando se necesitan para no bloquear el arranque
_modelo_estatico = None
_modelo_dinamico = None


def _obtener_modelo_estatico():
    """Carga el clasificador estático (RandomForest) si aún no está en memoria."""
    global _modelo_estatico
    if _modelo_estatico is None:
        try:
            from model.predict import ClasificadorEstatico
            ruta = os.path.join(_DIRECTORIO, "models_saved", "estatico.pkl")
            _modelo_estatico = ClasificadorEstatico(ruta)
        except Exception as e:
            print(f"[IA] No se pudo cargar el modelo estático: {e}")
    return _modelo_estatico


def _obtener_modelo_dinamico():
    """Carga el clasificador dinámico (TCN) si aún no está en memoria."""
    global _modelo_dinamico
    if _modelo_dinamico is None:
        try:
            from model.predict import ClasificadorDinamico
            ruta = os.path.join(_DIRECTORIO, "data", "models", "dinamico_tcn.pt")
            _modelo_dinamico = ClasificadorDinamico(ruta)
        except Exception as e:
            print(f"[IA] No se pudo cargar el modelo dinámico: {e}")
    return _modelo_dinamico


# ── Esquemas de entrada/salida (Pydantic) ─────────────────────────────────────

class FrameMano(BaseModel):
    # 21 landmarks CRUDOS de MediaPipe (x, y, z en rango ~0-1), igual que el
    # entrenamiento. El cliente (app) los manda tal cual los entrega MediaPipe.
    landmarks: list[list[float]]


class SecuenciaMano(BaseModel):
    # Para señas con movimiento: N frames YA VECTORIZADOS con
    # scripts.holistic_pipeline.frame_a_vector (manos + pose superior + cara
    # reducida, 527 valores/frame) — NO landmarks crudos de mano. La app
    # todavía no arma este vector en vivo (ver ai_module/README.md); este
    # endpoint queda listo para cuando el WebView capture holístico también.
    frames: list[list[float]]
    fps: Optional[float] = 15.0  # Cuadros por segundo de la captura


class VideoSena(BaseModel):
    # Clip corto grabado en el WebView (MediaRecorder) con la misma cámara que
    # ya usa el visor de manos. Se procesa con el mismo pipeline Python que
    # generó el dataset de entrenamiento (holistic_pipeline / extract_landmarks),
    # así que no hay riesgo de desajuste entre captura en vivo y entrenamiento.
    video_base64: str
    mime: str = "video/webm"


class TramoMovimiento(BaseModel):
    # Cuadros JPEG (base64, con o sin prefijo "data:image/jpeg;base64,") del
    # tramo en que el visor detectó la mano en movimiento, con un poco de
    # margen antes y después. Los manda la captura automática del WebView
    # (ver handTrackingHtml.js, sección 9b) para que el modelo dinámico
    # clasifique en sincronía con el estático, sin botón de grabar.
    frames: list[str]
    fps: float = 15.0


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

@app.get("/")
def inicio():
    """Estado general del servidor y modelos."""
    return {
        "app": "SeñaPlay IA de Señas",
        "modelo_estatico_listo": _obtener_modelo_estatico() is not None,
        "modelo_dinamico_listo": _obtener_modelo_dinamico() is not None,
        "total_señas": len(SEÑAS_REFERENCIA),
    }


@app.get("/señas")
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


@app.get("/seña/{seña_id}")
def obtener_seña(seña_id: str):
    """Devuelve una seña con todos sus landmarks de referencia."""
    if seña_id not in SEÑAS_REFERENCIA:
        raise HTTPException(404, f"Seña '{seña_id}' no encontrada")
    return SEÑAS_REFERENCIA[seña_id]


@app.post("/clasificar")
def clasificar_seña_estatica(req: FrameMano):
    """
    Clasifica una seña estática a partir de 21 landmarks CRUDOS de MediaPipe.
    (A diferencia de /comparar, que usa poses de referencia en coordenadas world.)
    Requiere haber entrenado el modelo: python model/train_static.py
    """
    modelo = _obtener_modelo_estatico()
    if modelo is None:
        raise HTTPException(
            503,
            "Modelo estático no disponible. "
            "Primero entrénalo ejecutando: python model/train_static.py"
        )

    landmarks = np.array(req.landmarks, dtype=np.float32)
    seña, confianza = modelo.predecir(landmarks)
    return {"seña": seña, "confianza": round(float(confianza), 4)}


@app.post("/clasificar_secuencia")
def clasificar_seña_dinamica(req: SecuenciaMano):
    """
    Clasifica una seña con movimiento a partir de una secuencia de vectores
    holísticos (ver SecuenciaMano). Requiere haber entrenado el modelo:
    python scripts/train_model.py
    """
    modelo = _obtener_modelo_dinamico()
    if modelo is None:
        raise HTTPException(
            503,
            "Modelo dinámico no disponible. "
            "Primero entrénalo ejecutando: python scripts/train_model.py"
        )

    frames = np.array(req.frames, dtype=np.float32)
    seña, confianza = modelo.predecir(frames)
    return {"seña": seña, "confianza": round(float(confianza), 4)}


@app.post("/clasificar_video")
def clasificar_seña_video(req: VideoSena):
    """
    Clasifica una seña con movimiento a partir de un clip de video (grabado en
    el WebView). Extrae los landmarks holísticos con el mismo pipeline que
    generó el dataset de entrenamiento (scripts.extract_landmarks) y clasifica
    con el modelo dinámico. Requiere haberlo entrenado: python scripts/train_model.py
    """
    modelo = _obtener_modelo_dinamico()
    if modelo is None:
        raise HTTPException(
            503,
            "Modelo dinámico no disponible. "
            "Primero entrénalo ejecutando: python scripts/train_model.py"
        )

    sufijo = ".webm" if "webm" in req.mime else ".mp4"
    ruta_temp = None
    try:
        with tempfile.NamedTemporaryFile(suffix=sufijo, delete=False) as archivo_temp:
            archivo_temp.write(base64.b64decode(req.video_base64))
            ruta_temp = archivo_temp.name

        config = cargar_config()
        cfg_extraccion = config["extraccion"]
        matriz, stats = _extraer_video(
            ruta_temp,
            fps_muestreo=cfg_extraccion["fps_muestreo"],
            confianza_deteccion=cfg_extraccion["confianza_deteccion"],
            confianza_landmarks=cfg_extraccion["confianza_landmarks"],
        )
    except Exception as e:
        raise HTTPException(422, f"No se pudo procesar el video: {e}")
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


@app.post("/clasificar_frames")
def clasificar_tramo_movimiento(req: TramoMovimiento):
    """
    Clasifica con el modelo dinámico un tramo de movimiento capturado en vivo
    como cuadros JPEG. Usa el mismo pipeline holístico que generó el dataset
    de entrenamiento. `es_seña` es False cuando el modelo responde la clase de
    rechazo (CLASE_SIN_SEÑA) o casi no hubo mano en cuadro: la app lo trata
    como "no era una seña con movimiento" y sigue con el modelo estático.
    """
    import cv2

    modelo = _obtener_modelo_dinamico()
    if modelo is None:
        raise HTTPException(503, "Modelo dinámico no disponible.")
    if not req.frames:
        raise HTTPException(422, "El tramo no trae cuadros")

    config = cargar_config()["extraccion"]
    detector = crear_detector_holistic(
        modo_video=True,
        confianza_deteccion=config["confianza_deteccion"],
        confianza_landmarks=config["confianza_landmarks"],
    )
    paso_ms = max(1, round(1000 / (req.fps or 15.0)))
    detectados = []
    try:
        for i, datos in enumerate(req.frames):
            crudo = np.frombuffer(base64.b64decode(datos.split(",", 1)[-1]), dtype=np.uint8)
            imagen = cv2.imdecode(crudo, cv2.IMREAD_COLOR)
            if imagen is not None:
                detectados.append(detectar_frame(detector, imagen, i * paso_ms))
    except ValueError as e:
        raise HTTPException(422, f"Cuadro inválido: {e}")
    finally:
        detector.close()

    if not detectados:
        raise HTTPException(422, "Ningún cuadro se pudo decodificar")

    con_mano = sum(1 for f in detectados if any(presencia_manos(f)))
    stats = {"frames": len(detectados), "ratio_con_mano": round(con_mano / len(detectados), 3)}
    return _respuesta_dinamica(modelo, secuencia_a_matriz(detectados), stats)


def _respuesta_dinamica(modelo, matriz: np.ndarray, stats: dict) -> dict:
    """
    Respuesta común de los endpoints dinámicos: mejor clase + alternativas, y
    si el tramo cuenta como seña dinámica (`es_seña`, con `motivo` si no).
    """
    ranking = modelo.probabilidades(matriz)
    seña, confianza = ranking[0]
    movimiento = _movimiento_muñecas(matriz)

    motivo = None
    if stats["ratio_con_mano"] < RATIO_MIN_CON_MANO:
        motivo = "sin_mano"
    elif movimiento is not None and movimiento < MOVIMIENTO_MIN_MUÑECA:
        motivo = "poco_movimiento"
    elif seña == CLASE_SIN_SEÑA:
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


@app.post("/comparar")
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
