"""
Servidor FastAPI para el módulo de IA de OratioLingo.

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

import json
import os

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="OratioLingo IA de Señas", version="0.2.0")

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
        "app": "OratioLingo IA de Señas",
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
