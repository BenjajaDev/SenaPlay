"""
Oráculo de pruebas: copia literal de las funciones del pipeline legado
(scripts/holistic_pipeline.py antes de la refactorización, commit a666e73).
Solo se usa para verificar que preprocessing/ reproduce el vector 1.0.
"""

import numpy as np

N_LANDMARKS_MANO = 21
MANO_MUÑECA = 0
MANO_BASE_MEDIO = 9
POSE_HOMBRO_IZQ = 11
POSE_HOMBRO_DER = 12
N_POSE_SUPERIOR = 17
N_CARA_REDUCIDA = 116
N_FEATURES_FRAME = 527

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
