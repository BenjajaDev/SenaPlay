"""
Núcleo de extracción HOLÍSTICA (manos + pose superior + cara reducida) con
MediaPipe Holistic (Tasks API, `HolisticLandmarker`).

Reemplaza a `data/holistic_landmarks.py` (que solo extraía manos + pose,
sin cara). Lo usan `scripts/extract_landmarks.py`, `scripts/train_model.py`
y `model/predict.py`.

── Por qué HolisticLandmarker y no `mp.solutions` ──────────────────────────
`mp.solutions.holistic.Holistic` (API antigua, basada en grafos) fue removida
en mediapipe >= 0.10.3x. Esta instalación (0.10.35) solo trae la Tasks API,
por eso se usa `vision.HolisticLandmarker`, que corre los tres submodelos
(manos, pose, cara) EN PARALELO sobre el mismo frame y expone
`resultado.face_landmarks`, `resultado.pose_landmarks`,
`resultado.left_hand_landmarks`, `resultado.right_hand_landmarks` — los
cuatro campos existen siempre en `HolisticLandmarkerResult`, no hace falta
ningún flag para "activar" la cara: basta con leer el campo.

── Vector por frame: composición y orden (ESTABLE, no reordenar) ───────────
    N_FEATURES_FRAME = 527

    [  0 : 63 ]  mano_izq   — forma normalizada (21×3), centrada en la
                              muñeca y escalada por muñeca→base dedo medio.
                              Ceros si no se detectó.
    [ 63 : 126]  mano_der   — igual que arriba, mano derecha.
    [126]        presencia mano_izq (1.0 detectada / 0.0 ausente)
    [127]        presencia mano_der (1.0 detectada / 0.0 ausente)
    [128 : 179]  pose_superior (17×3) — landmarks 0-16 del modelo Pose de
                              MediaPipe (nariz, ojos, orejas, boca, hombros,
                              codos, muñecas — "torso superior sin piernas").
                              Centrados en el punto medio de hombros y
                              escalados por el ancho de hombros.
    [179 : 527]  cara_reducida (116×3) — subset de FaceMesh: labios + ojos +
                              cejas + nariz (ver ÍNDICES_CARA). MISMO marco
                              que pose_superior (centrado/escalado por
                              hombros), para que "dónde" de la cara y del
                              cuerpo compartan una sola unidad.

Las manos usan su PROPIO marco (centrado en su propia muñeca) porque ahí
importa la FORMA de la mano, no su ubicación — la ubicación ya la aporta
`pose_superior` (landmarks 15/16, muñecas, en el marco corporal).

── Subset de cara: por qué 116 puntos y no los 468/478 completos ───────────
Se tomó la UNIÓN de los grupos canónicos de FaceMesh relevantes para
marcadores no-manuales de lengua de señas (cejas, ojos y boca cambian el
significado gramatical: preguntas, negación, intensidad) más la nariz como
referencia estable de orientación de cabeza:
    FACE_LANDMARKS_LIPS + LEFT_EYE + RIGHT_EYE + LEFT_EYEBROW +
    RIGHT_EYEBROW + NOSE  →  116 índices únicos.
Se excluye FACE_OVAL (contorno de mejilla/frente, +36 puntos) por no aportar
información gramatical y encarecer el vector en móvil sin beneficio claro.

Los índices se calculan en tiempo de importación a partir de las constantes
de topología reales de la instalación de mediapipe (`FaceLandmarksConnections`
en `mediapipe.tasks.python.vision.face_landmarker`), en vez de escribirlos a
mano — así nunca quedan desincronizados de la versión de mediapipe instalada.
El orden es SIEMPRE ascendente por índice de FaceMesh (ver ÍNDICES_CARA), lo
que lo hace determinista y estable entre corridas.
"""

import os

import cv2
import mediapipe as mp
import numpy as np

# ── Rutas y constantes ───────────────────────────────────────────────────────

_DIR_AI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # ai_module/
RUTA_MODELO_HOLISTIC = os.path.join(_DIR_AI, "models_mediapipe", "holistic_landmarker.task")

N_LANDMARKS_MANO = 21

# Índices de mano usados para normalizar la FORMA (no cambian con el frame)
MANO_MUÑECA = 0
MANO_BASE_MEDIO = 9

# Índices de pose (0-16 = "torso superior sin piernas": cabeza + hombros +
# codos + muñecas). Ver mediapipe.tasks.python.vision.pose_landmarker.PoseLandmark.
POSE_HOMBRO_IZQ = 11
POSE_HOMBRO_DER = 12
N_POSE_SUPERIOR = 17  # índices 0..16 inclusive


def _indices_cara_reducida() -> list[int]:
    """
    Calcula, a partir de la topología real instalada, la unión ordenada de
    índices de FaceMesh para labios + ojos + cejas + nariz.
    """
    from mediapipe.tasks.python.vision import face_landmarker as _fl

    grupos = (
        _fl.FaceLandmarksConnections.FACE_LANDMARKS_LIPS,
        _fl.FaceLandmarksConnections.FACE_LANDMARKS_LEFT_EYE,
        _fl.FaceLandmarksConnections.FACE_LANDMARKS_RIGHT_EYE,
        _fl.FaceLandmarksConnections.FACE_LANDMARKS_LEFT_EYEBROW,
        _fl.FaceLandmarksConnections.FACE_LANDMARKS_RIGHT_EYEBROW,
        _fl.FaceLandmarksConnections.FACE_LANDMARKS_NOSE,
    )
    indices: set[int] = set()
    for conexiones in grupos:
        for c in conexiones:
            indices.add(c.start)
            indices.add(c.end)
    return sorted(indices)


ÍNDICES_CARA: list[int] = _indices_cara_reducida()
N_CARA_REDUCIDA = len(ÍNDICES_CARA)  # 116 con mediapipe 0.10.35

# Tamaño total del vector por frame — ver docstring del módulo para el layout
N_FEATURES_FRAME = (
    N_LANDMARKS_MANO * 3 * 2       # mano_izq + mano_der (forma)
    + 2                            # presencia por mano
    + N_POSE_SUPERIOR * 3          # pose_superior
    + N_CARA_REDUCIDA * 3          # cara_reducida
)  # 63*2 + 2 + 51 + 348 = 527

# Slices del vector por frame — usados por scripts/augmentation.py y por
# cualquier código que necesite operar sobre un segmento en particular sin
# recalcular offsets a mano.
SLICE_MANO_IZQ = slice(0, 63)
SLICE_MANO_DER = slice(63, 126)
SLICE_PRESENCIA = slice(126, 128)
SLICE_POSE = slice(128, 128 + N_POSE_SUPERIOR * 3)          # 128:179
SLICE_CARA = slice(128 + N_POSE_SUPERIOR * 3, N_FEATURES_FRAME)  # 179:527

# Permutación de índices de pose (0-16) al espejar horizontalmente: cada
# landmark "izquierdo" se intercambia por su contraparte "derecho". El índice
# 0 (nariz) no tiene par y queda fijo. Ver PoseLandmark en
# mediapipe.tasks.python.vision.pose_landmarker para el orden 0-16.
PERMUTACION_ESPEJO_POSE = [0, 4, 5, 6, 1, 2, 3, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15]


# ── Creación del detector ─────────────────────────────────────────────────────

def crear_detector_holistic(
    modo_video: bool = True,
    confianza_deteccion: float = 0.5,
    confianza_landmarks: float = 0.5,
):
    """
    Crea un HolisticLandmarker con los tres submodelos (manos, pose, cara)
    habilitados en paralelo — es el comportamiento por defecto de la Tasks
    API, no existe un flag "activar cara" separado.

    modo_video=True usa RunningMode.VIDEO (mantiene seguimiento temporal
    entre frames de un mismo video; exige timestamps estrictamente
    crecientes en `detectar_frame`).
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
        min_face_detection_confidence=confianza_deteccion,
        min_face_landmarks_confidence=confianza_landmarks,
        min_pose_detection_confidence=confianza_deteccion,
        min_pose_landmarks_confidence=confianza_landmarks,
        min_hand_landmarks_confidence=confianza_landmarks,
    )
    return vision.HolisticLandmarker.create_from_options(opciones)


def _lista_a_array(landmarks, indices: list[int] | None = None) -> np.ndarray | None:
    """
    Convierte una lista de NormalizedLandmark a array (N, 3), o None si viene
    vacía. Si se pasa `indices`, selecciona solo esas posiciones (para la
    cara reducida) en ESE orden.
    """
    if not landmarks:
        return None
    if indices is not None:
        return np.array([[landmarks[i].x, landmarks[i].y, landmarks[i].z] for i in indices],
                         dtype=np.float32)
    return np.array([[p.x, p.y, p.z] for p in landmarks], dtype=np.float32)


def detectar_frame(detector, imagen_bgr, timestamp_ms: int | None = None) -> dict:
    """
    Procesa un frame BGR (OpenCV) y devuelve un dict con las partes crudas
    detectadas (aún sin normalizar):

        {
          "mano_izq":       (21, 3)  | None,
          "mano_der":       (21, 3)  | None,
          "pose_superior":  (17, 3)  | None,   # índices 0-16 del modelo Pose
          "cara":           (116, 3) | None,   # ver ÍNDICES_CARA
        }

    OJO: 'izquierda'/'derecha' son desde la perspectiva de la IMAGEN, no del
    signante. El pipeline es consistente entre extracción e inferencia, pero
    si se espeja como augmentation hay que intercambiar mano_izq ↔ mano_der.
    """
    imagen_rgb = cv2.cvtColor(imagen_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=imagen_rgb)

    if timestamp_ms is None:
        resultado = detector.detect(mp_image)
    else:
        resultado = detector.detect_for_video(mp_image, timestamp_ms)

    pose_completa = _lista_a_array(resultado.pose_landmarks)
    pose_superior = pose_completa[:N_POSE_SUPERIOR] if pose_completa is not None else None

    return {
        "mano_izq": _lista_a_array(resultado.left_hand_landmarks),
        "mano_der": _lista_a_array(resultado.right_hand_landmarks),
        "pose_superior": pose_superior,
        "cara": _lista_a_array(resultado.face_landmarks, indices=ÍNDICES_CARA),
    }


# ── Normalización ─────────────────────────────────────────────────────────────

def _normalizar_forma_mano(mano: np.ndarray) -> np.ndarray:
    """
    Normaliza la CONFIGURACIÓN de la mano: centra en la muñeca y escala por
    la distancia muñeca→base del dedo medio. Invariante a posición y a
    tamaño de mano (y por lo tanto a distancia a la cámara). 63 valores.
    """
    centrada = mano - mano[MANO_MUÑECA]
    escala = np.linalg.norm(centrada[MANO_BASE_MEDIO])
    if escala > 1e-6:
        centrada = centrada / escala
    return centrada.flatten().astype(np.float32)


def _marco_corporal(pose_superior: np.ndarray | None) -> tuple[np.ndarray, float]:
    """
    Origen = punto medio entre hombros. Escala = ancho de hombros.
    Usado para poner pose y cara en unidades de cuerpo, invariantes a
    distancia a la cámara y a la contextura del signante.

    Si no hay pose, cae a un marco neutro centrado en la imagen.
    """
    if pose_superior is None or len(pose_superior) <= POSE_HOMBRO_DER:
        return np.array([0.5, 0.5, 0.0], dtype=np.float32), 1.0

    hombro_izq = pose_superior[POSE_HOMBRO_IZQ]
    hombro_der = pose_superior[POSE_HOMBRO_DER]
    origen = (hombro_izq + hombro_der) / 2.0
    ancho = float(np.linalg.norm(hombro_izq - hombro_der))

    if ancho < 1e-6:
        ancho = 1.0
    return origen.astype(np.float32), ancho


def frame_a_vector(frame: dict) -> np.ndarray:
    """
    Convierte un frame detectado (dict de `detectar_frame`) en el vector de
    features de longitud N_FEATURES_FRAME (527). Ver el layout documentado
    en el docstring del módulo.
    """
    origen, escala = _marco_corporal(frame.get("pose_superior"))

    partes: list[np.ndarray] = []
    presencias: list[float] = []

    for clave in ("mano_izq", "mano_der"):
        mano = frame.get(clave)
        if mano is None or len(mano) != N_LANDMARKS_MANO:
            partes.append(np.zeros(N_LANDMARKS_MANO * 3, dtype=np.float32))
            presencias.append(0.0)
        else:
            partes.append(_normalizar_forma_mano(mano))
            presencias.append(1.0)

    partes.append(np.array(presencias, dtype=np.float32))

    pose_superior = frame.get("pose_superior")
    if pose_superior is not None and len(pose_superior) == N_POSE_SUPERIOR:
        pose_norm = ((pose_superior - origen) / escala).flatten().astype(np.float32)
    else:
        pose_norm = np.zeros(N_POSE_SUPERIOR * 3, dtype=np.float32)
    partes.append(pose_norm)

    cara = frame.get("cara")
    if cara is not None and len(cara) == N_CARA_REDUCIDA:
        cara_norm = ((cara - origen) / escala).flatten().astype(np.float32)
    else:
        cara_norm = np.zeros(N_CARA_REDUCIDA * 3, dtype=np.float32)
    partes.append(cara_norm)

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
    Remuestrea una secuencia (T, F) a (t_objetivo, F) por interpolación
    lineal. Da invarianza a la VELOCIDAD de ejecución de la seña.
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
