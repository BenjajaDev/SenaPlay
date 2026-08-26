"""
Extracción de landmarks BILATERALES (dos manos + pose) con MediaPipe Holistic.

Este módulo es el núcleo compartido del pipeline dinámico: lo usan tanto la
captura por webcam (`capturar_dinamicas.py`) como la extracción por lotes
(`extract_dinamicas.py`) y la inferencia en el servidor.

Diferencia clave con `extract_landmarks.py` (pipeline estático):
  - Aquel detecta UNA mano y devuelve (21, 3).
  - Este detecta AMBAS manos + el torso, y devuelve un frame estructurado que
    conserva DÓNDE se hace la seña respecto al cuerpo. Eso importa: en lengua
    de señas la ubicación es fonológica — la misma configuración de mano a la
    altura de la frente y a la altura del pecho son señas distintas.

Sobre la "visibilidad" por landmark: MediaPipe NO entrega un valor de
visibilidad confiable para los landmarks de mano (solo lo llena para pose).
La señal útil es la PRESENCIA de la mano completa: si Holistic no la detectó,
la lista viene vacía. Por eso el vector de features lleva flags de presencia
por mano en vez de 21 visibilidades inventadas.
"""

import os

import cv2
import mediapipe as mp
import numpy as np

# ── Configuración ──────────────────────────────────────────────────────────────

_DIR_AI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # carpeta ai_module
RUTA_MODELO_HOLISTIC = os.path.join(_DIR_AI, "models_mediapipe", "holistic_landmarker.task")

# Índices de pose de MediaPipe que usamos como marco de referencia del cuerpo
POSE_HOMBRO_IZQ = 11
POSE_HOMBRO_DER = 12
POSE_CADERA_IZQ = 23
POSE_CADERA_DER = 24

# Índices dentro de una mano (21 landmarks de MediaPipe)
MANO_MUÑECA = 0
MANO_BASE_MEDIO = 9  # usado para escalar el tamaño de la mano

N_LANDMARKS_MANO = 21

# Tamaño del vector de features por frame (ver `frame_a_vector`)
#   por mano: 63 forma + 3 ubicación + 1 presencia = 67
#   dos manos: 134
#   + 3 de referencia corporal (ancho de hombros, inclinación, distancia entre muñecas)
N_FEATURES_FRAME = 137


# ── Creación del detector ─────────────────────────────────────────────────────

def crear_detector_holistic(
    modo_video: bool = True,
    confianza_pose: float = 0.5,
    confianza_manos: float = 0.5,
):
    """
    Crea un HolisticLandmarker (MediaPipe Tasks API).

    modo_video=True usa RunningMode.VIDEO, que mantiene seguimiento temporal
    entre frames (mejor para secuencias). En ese modo hay que llamar
    `detectar_frame` con timestamps ESTRICTAMENTE crecientes.
    """
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    if not os.path.exists(RUTA_MODELO_HOLISTIC):
        raise FileNotFoundError(
            f"No se encontró el modelo en {RUTA_MODELO_HOLISTIC}.\n"
            "Descárgalo con:\n"
            "  curl -L -o models_mediapipe/holistic_landmarker.task \\\n"
            "  https://storage.googleapis.com/mediapipe-models/holistic_landmarker/"
            "holistic_landmarker/float16/latest/holistic_landmarker.task"
        )

    opciones = vision.HolisticLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=RUTA_MODELO_HOLISTIC),
        running_mode=vision.RunningMode.VIDEO if modo_video else vision.RunningMode.IMAGE,
        min_pose_detection_confidence=confianza_pose,
        min_pose_landmarks_confidence=confianza_pose,
        min_hand_landmarks_confidence=confianza_manos,
    )
    return vision.HolisticLandmarker.create_from_options(opciones)


def _lista_a_array(landmarks) -> np.ndarray | None:
    """Convierte una lista de NormalizedLandmark a array (N, 3), o None si viene vacía."""
    if not landmarks:
        return None
    return np.array([[p.x, p.y, p.z] for p in landmarks], dtype=np.float32)


def detectar_frame(detector, imagen_bgr, timestamp_ms: int | None = None) -> dict:
    """
    Procesa un frame BGR (OpenCV) y devuelve un dict con las partes detectadas.

    OJO: 'izquierda'/'derecha' son desde la perspectiva de la IMAGEN, no del
    signante. Como el pipeline es consistente entre entrenamiento e inferencia
    no hace falta corregirlo, pero sí hay que espejar coherentemente si algún
    día se hace augmentation por espejo.

    Devuelve:
        {
          "mano_izq": (21, 3) | None,
          "mano_der": (21, 3) | None,
          "pose":     (33, 3) | None,
        }
    """
    imagen_rgb = cv2.cvtColor(imagen_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=imagen_rgb)

    if timestamp_ms is None:
        resultado = detector.detect(mp_image)
    else:
        resultado = detector.detect_for_video(mp_image, timestamp_ms)

    return {
        "mano_izq": _lista_a_array(resultado.left_hand_landmarks),
        "mano_der": _lista_a_array(resultado.right_hand_landmarks),
        "pose": _lista_a_array(resultado.pose_landmarks),
    }


# ── Normalización ─────────────────────────────────────────────────────────────

def _normalizar_forma_mano(mano: np.ndarray) -> np.ndarray:
    """
    Normaliza la CONFIGURACIÓN de la mano: centra en la muñeca y escala por la
    distancia muñeca→base del dedo medio. Invariante a posición y a tamaño de
    mano, así que solo codifica la forma. Devuelve 63 valores planos.

    Es la misma normalización que usa el pipeline estático, a propósito: así
    ambos modelos ven la forma de la mano en el mismo espacio.
    """
    centrada = mano - mano[MANO_MUÑECA]
    escala = np.linalg.norm(centrada[MANO_BASE_MEDIO])
    if escala > 1e-6:
        centrada = centrada / escala
    return centrada.flatten().astype(np.float32)


def _marco_corporal(pose: np.ndarray | None) -> tuple[np.ndarray, float]:
    """
    Calcula el origen y la escala del cuerpo a partir de la pose.

    Origen = punto medio entre hombros. Escala = ancho de hombros.
    Sirve para expresar DÓNDE está la mano en unidades de cuerpo, de modo que
    la ubicación de la seña no dependa de la distancia a la cámara ni del
    tamaño del signante.

    Si no hay pose, cae a un marco neutro centrado en la imagen.
    """
    if pose is None or len(pose) <= POSE_CADERA_DER:
        return np.array([0.5, 0.5, 0.0], dtype=np.float32), 1.0

    hombro_izq = pose[POSE_HOMBRO_IZQ]
    hombro_der = pose[POSE_HOMBRO_DER]
    origen = (hombro_izq + hombro_der) / 2.0
    ancho = float(np.linalg.norm(hombro_izq - hombro_der))

    if ancho < 1e-6:
        ancho = 1.0
    return origen.astype(np.float32), ancho


def frame_a_vector(frame: dict) -> np.ndarray:
    """
    Convierte un frame detectado en el vector de features de longitud
    N_FEATURES_FRAME (137).

    Composición, por mano (67 c/u):
        [0:63]   forma de la mano normalizada en la muñeca
        [63:66]  ubicación de la muñeca respecto al centro de hombros,
                 en unidades de ancho de hombros
        [66]     flag de presencia (1.0 detectada / 0.0 ausente)

    Cola corporal (3):
        ancho de hombros, inclinación del torso, distancia entre muñecas

    Las manos ausentes se rellenan con ceros y su flag en 0. El modelo aprende
    a usar el flag; NO se descarta el frame, porque muchas señas de LSCh son
    legítimamente monomanuales.
    """
    pose = frame.get("pose")
    origen, escala = _marco_corporal(pose)

    partes: list[np.ndarray] = []
    muñecas: dict[str, np.ndarray | None] = {}

    for clave in ("mano_izq", "mano_der"):
        mano = frame.get(clave)
        if mano is None or len(mano) != N_LANDMARKS_MANO:
            partes.append(np.zeros(67, dtype=np.float32))
            muñecas[clave] = None
            continue

        forma = _normalizar_forma_mano(mano)
        ubicacion = (mano[MANO_MUÑECA] - origen) / escala
        partes.append(np.concatenate([forma, ubicacion, [1.0]]).astype(np.float32))
        muñecas[clave] = ubicacion.astype(np.float32)

    # ── Cola con contexto corporal ──
    if pose is not None and len(pose) > POSE_CADERA_DER:
        torso = (pose[POSE_HOMBRO_IZQ] + pose[POSE_HOMBRO_DER]) / 2.0 - \
                (pose[POSE_CADERA_IZQ] + pose[POSE_CADERA_DER]) / 2.0
        inclinacion = float(np.arctan2(torso[0], -torso[1] + 1e-6))
    else:
        inclinacion = 0.0

    if muñecas["mano_izq"] is not None and muñecas["mano_der"] is not None:
        separacion = float(np.linalg.norm(muñecas["mano_izq"] - muñecas["mano_der"]))
    else:
        separacion = 0.0

    partes.append(np.array([escala, inclinacion, separacion], dtype=np.float32))
    return np.concatenate(partes).astype(np.float32)


def presencia_manos(frame: dict) -> tuple[bool, bool]:
    """Devuelve (hay_mano_izq, hay_mano_der) para un frame detectado."""
    izq = frame.get("mano_izq")
    der = frame.get("mano_der")
    return (
        izq is not None and len(izq) == N_LANDMARKS_MANO,
        der is not None and len(der) == N_LANDMARKS_MANO,
    )


# ── Secuencias ────────────────────────────────────────────────────────────────

def secuencia_a_matriz(frames: list[dict]) -> np.ndarray:
    """Convierte una lista de frames detectados en una matriz (T, N_FEATURES_FRAME)."""
    if not frames:
        return np.zeros((0, N_FEATURES_FRAME), dtype=np.float32)
    return np.stack([frame_a_vector(f) for f in frames]).astype(np.float32)


def remuestrear_temporal(secuencia: np.ndarray, t_objetivo: int) -> np.ndarray:
    """
    Remuestrea una secuencia (T, F) a (t_objetivo, F) por interpolación lineal.

    Este paso es el que da invarianza a la VELOCIDAD de ejecución: una seña
    hecha en 1.2 s y la misma en 2.5 s terminan como la misma matriz.
    """
    n = len(secuencia)
    if n == 0:
        return np.zeros((t_objetivo, secuencia.shape[1] if secuencia.ndim > 1 else N_FEATURES_FRAME),
                        dtype=np.float32)
    if n == t_objetivo:
        return secuencia.astype(np.float32)

    indices = np.linspace(0, n - 1, t_objetivo)
    bajo = np.floor(indices).astype(int)
    alto = np.minimum(bajo + 1, n - 1)
    peso = (indices - bajo).reshape(-1, 1).astype(np.float32)
    return (secuencia[bajo] * (1.0 - peso) + secuencia[alto] * peso).astype(np.float32)


def añadir_velocidades(secuencia: np.ndarray) -> np.ndarray:
    """
    Concatena la derivada temporal a cada frame: (T, F) → (T, 2F).

    El movimiento es la mitad de la información de una seña dinámica; darle la
    velocidad explícita al modelo le ahorra tener que derivarla con las
    convoluciones y acelera mucho la convergencia con datasets pequeños.
    """
    if len(secuencia) == 0:
        return np.zeros((0, secuencia.shape[1] * 2), dtype=np.float32)
    delta = np.diff(secuencia, axis=0, prepend=secuencia[:1])
    return np.concatenate([secuencia, delta], axis=1).astype(np.float32)
