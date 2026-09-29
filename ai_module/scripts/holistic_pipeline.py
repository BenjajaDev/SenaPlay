"""
Capa de compatibilidad del pipeline holístico legado (vector de 527 valores).

La lógica vive ahora en `preprocessing/` (extracción, normalización y
remuestreo compartidos por el entrenamiento y el servidor). Este módulo solo
conserva la API que usan los scripts legados (`scripts/extract_landmarks.py`,
`scripts/train_model.py`, `scripts/augmentation.py`,
`scripts/visualize_results.py`), traduciéndola a `FeatureSpec.v1()`, que
reproduce exactamente el vector de la versión 1.0 (ver
`tests/test_preprocessing.py::test_reproduce_vector_legado`).

Layout (estable, versión 1.0), N_FEATURES_FRAME = 527:
    [  0 : 63 ]  mano_izq  forma centrada en la muñeca
    [ 63 : 126]  mano_der
    [126], [127] presencia mano_izq, mano_der
    [128 : 179]  pose 0-16 en el marco de hombros
    [179 : 527]  cara reducida (116 puntos) en el marco de hombros
Detalle completo: docs/ai/feature_spec.md
"""

import numpy as np

from preprocessing import extraction
from preprocessing.augmentation import permutacion_espejo_pose
from preprocessing.extraction import frames_a_secuencia
from preprocessing.normalization import a_matriz_base, normalizar
from preprocessing.resampling import remuestrear
from preprocessing.spec import (
    GRUPOS_CARA_V1, MANO_BASE_MEDIO, MANO_MUNECA, N_CARA_TOTAL, N_MANO, N_POSE_TOTAL,
    POSE_HOMBRO_DER, POSE_HOMBRO_IZQ, FeatureSpec, indices_cara,
)

_SPEC_V1 = FeatureSpec.v1()

RUTA_MODELO_HOLISTIC = extraction.RUTA_MODELO_HOLISTIC
N_LANDMARKS_MANO = N_MANO
MANO_MUÑECA = MANO_MUNECA
N_POSE_SUPERIOR = 17
ÍNDICES_CARA: list[int] = indices_cara(GRUPOS_CARA_V1)
N_CARA_REDUCIDA = len(ÍNDICES_CARA)
N_FEATURES_FRAME = _SPEC_V1.dim_base  # 527

SLICE_MANO_IZQ = slice(0, 63)
SLICE_MANO_DER = slice(63, 126)
SLICE_PRESENCIA = slice(126, 128)
SLICE_POSE = slice(128, 128 + N_POSE_SUPERIOR * 3)
SLICE_CARA = slice(128 + N_POSE_SUPERIOR * 3, N_FEATURES_FRAME)

PERMUTACION_ESPEJO_POSE = permutacion_espejo_pose(list(range(N_POSE_SUPERIOR)))

__all__ = [
    "N_FEATURES_FRAME", "ÍNDICES_CARA", "crear_detector_holistic", "detectar_frame",
    "frame_a_vector", "presencia_manos", "secuencia_a_matriz", "remuestrear_temporal",
    "POSE_HOMBRO_IZQ", "POSE_HOMBRO_DER", "MANO_BASE_MEDIO",
]


def crear_detector_holistic(modo_video: bool = True, confianza_deteccion: float = 0.5,
                            confianza_landmarks: float = 0.5):
    return extraction.crear_detector(
        {"confianza_deteccion": confianza_deteccion, "confianza_landmarks": confianza_landmarks},
        modo_video=modo_video,
    )


def detectar_frame(detector, imagen_bgr, timestamp_ms: int | None = None) -> dict:
    """Devuelve el dict legado: mano_izq, mano_der, pose_superior (17×3), cara (116×3)."""
    f = extraction.detectar_frame(detector, imagen_bgr, timestamp_ms)
    return {
        "mano_izq": f["mano_izq"],
        "mano_der": f["mano_der"],
        "pose_superior": None if f["pose"] is None else f["pose"][:N_POSE_SUPERIOR],
        "cara": None if f["cara"] is None else f["cara"][ÍNDICES_CARA],
    }


def _a_frame_completo(frame: dict) -> dict:
    """Dict legado (pose 17, cara 116) → dict de extracción (pose 33, cara 478)."""
    completo = {"mano_izq": frame.get("mano_izq"), "mano_der": frame.get("mano_der"),
                "pose": None, "cara": None}
    for clave in ("mano_izq", "mano_der"):
        if completo[clave] is not None and len(completo[clave]) != N_MANO:
            completo[clave] = None
    pose = frame.get("pose_superior")
    if pose is not None and len(pose) == N_POSE_SUPERIOR:
        completo["pose"] = np.zeros((N_POSE_TOTAL, 3), np.float32)
        completo["pose"][:N_POSE_SUPERIOR] = pose
    cara = frame.get("cara")
    if cara is not None and len(cara) == N_CARA_REDUCIDA:
        completo["cara"] = np.zeros((N_CARA_TOTAL, 3), np.float32)
        completo["cara"][ÍNDICES_CARA] = cara
    return completo


def secuencia_a_matriz(frames: list[dict]) -> np.ndarray:
    """Lista de frames (dict legado) → (T, 527)."""
    if not frames:
        return np.zeros((0, N_FEATURES_FRAME), dtype=np.float32)
    cruda = frames_a_secuencia([_a_frame_completo(f) for f in frames], fps_muestreo=30)
    return a_matriz_base(normalizar(cruda, _SPEC_V1))


def frame_a_vector(frame: dict) -> np.ndarray:
    return secuencia_a_matriz([frame])[0]


def presencia_manos(frame: dict) -> tuple[bool, bool]:
    izq, der = frame.get("mano_izq"), frame.get("mano_der")
    return (izq is not None and len(izq) == N_MANO, der is not None and len(der) == N_MANO)


def remuestrear_temporal(secuencia: np.ndarray, t_objetivo: int) -> np.ndarray:
    if len(secuencia) == 0 and secuencia.ndim < 2:
        return np.zeros((t_objetivo, N_FEATURES_FRAME), dtype=np.float32)
    return remuestrear(secuencia, t_objetivo)
