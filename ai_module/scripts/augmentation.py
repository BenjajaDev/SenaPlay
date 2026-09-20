"""
Augmentación de secuencias (T, 527) para entrenamiento de señas dinámicas.

Se aplica SOLO al split de entrenamiento (nunca a val/test, para no inflar
las métricas). Cada copia aumentada de una secuencia usa una única elección
de rotación/escala/espejo para TODOS sus frames (simula una toma con una
cámara/signante fijos), pero ruido gaussiano independiente por frame
(simula jitter de detección frame a frame).

── Nota sobre el espejado de pose y cara ───────────────────────────────────
Para las MANOS, espejar intercambia los segmentos mano_izq ↔ mano_der (además
de negar X): son dos bloques de 63 valores con identidad clara, así que el
intercambio es barato y exacto.

Para pose_superior, además se permutan los índices izquierda↔derecha
(PERMUTACION_ESPEJO_POSE) porque son solo 17 puntos y el mapeo es conocido.

Para la cara reducida (116 puntos) NO se remapean índices — solo se niega X.
Esto es una simplificación deliberada: la Conv1d de `model/tcn.py` NO
convoluciona sobre el eje de 527 features (esas son "canales" de entrada a
una proyección aprendida por frame), a diferencia de una imagen donde voltear
píxeles interactúa con la localidad espacial de un kernel. Por eso, igual que
un flip horizontal de imagen no reetiqueta píxeles por "cuál era la oreja
izquierda del perro", negar X sin remapear identidades de landmarks faciales
sigue siendo una transformación válida y consistente para esta arquitectura.
"""

import numpy as np

from scripts.holistic_pipeline import (
    N_LANDMARKS_MANO,
    N_POSE_SUPERIOR,
    N_CARA_REDUCIDA,
    PERMUTACION_ESPEJO_POSE,
    SLICE_CARA,
    SLICE_MANO_DER,
    SLICE_MANO_IZQ,
    SLICE_POSE,
    SLICE_PRESENCIA,
)


def _rotar_xy(puntos: np.ndarray, angulo_rad: float) -> np.ndarray:
    """Rota un array (..., 3) alrededor del eje Z (plano XY)."""
    cos_a, sin_a = np.cos(angulo_rad), np.sin(angulo_rad)
    x, y = puntos[..., 0].copy(), puntos[..., 1].copy()
    resultado = puntos.copy()
    resultado[..., 0] = x * cos_a - y * sin_a
    resultado[..., 1] = x * sin_a + y * cos_a
    return resultado


def _espejar_secuencia(secuencia: np.ndarray) -> np.ndarray:
    """Espeja horizontalmente (X → -X) una secuencia (T, 527) completa."""
    seq = secuencia.copy()
    T = seq.shape[0]

    mano_izq = seq[:, SLICE_MANO_IZQ].reshape(T, N_LANDMARKS_MANO, 3)
    mano_der = seq[:, SLICE_MANO_DER].reshape(T, N_LANDMARKS_MANO, 3)
    mano_izq[..., 0] *= -1
    mano_der[..., 0] *= -1
    # Intercambiar mano_izq ↔ mano_der (y sus flags de presencia)
    seq[:, SLICE_MANO_IZQ] = mano_der.reshape(T, -1)
    seq[:, SLICE_MANO_DER] = mano_izq.reshape(T, -1)
    seq[:, SLICE_PRESENCIA] = seq[:, SLICE_PRESENCIA][:, ::-1]

    pose = seq[:, SLICE_POSE].reshape(T, N_POSE_SUPERIOR, 3)
    pose[..., 0] *= -1
    pose = pose[:, PERMUTACION_ESPEJO_POSE, :]
    seq[:, SLICE_POSE] = pose.reshape(T, -1)

    cara = seq[:, SLICE_CARA].reshape(T, N_CARA_REDUCIDA, 3)
    cara[..., 0] *= -1  # sin remapeo de índices — ver docstring del módulo
    seq[:, SLICE_CARA] = cara.reshape(T, -1)

    return seq


def aumentar_secuencia(secuencia: np.ndarray, config_aug: dict) -> np.ndarray:
    """
    Genera UNA variación aumentada de `secuencia` (T, 527) según los
    parámetros de la sección `augmentacion` de dataset_config.yaml.
    """
    seq = secuencia.copy()
    T = seq.shape[0]

    # ── Rotación (aplicada solo a los bloques de coordenadas x,y,z) ──
    angulo_max = np.radians(config_aug["rotacion_max_grados"])
    angulo = np.random.uniform(-angulo_max, angulo_max)
    for s in (SLICE_MANO_IZQ, SLICE_MANO_DER, SLICE_POSE, SLICE_CARA):
        n_puntos = (s.stop - s.start) // 3
        bloque = seq[:, s].reshape(T, n_puntos, 3)
        seq[:, s] = _rotar_xy(bloque, angulo).reshape(T, -1)

    # ── Escalado — ver docstring: simula ruido en la estimación de escala,
    # no una distancia real a cámara (eso ya lo neutraliza la normalización).
    factor = np.random.uniform(config_aug["escalado_min"], config_aug["escalado_max"])
    for s in (SLICE_MANO_IZQ, SLICE_MANO_DER, SLICE_POSE, SLICE_CARA):
        seq[:, s] *= factor

    # ── Espejado (probabilidad) ──
    if np.random.rand() < config_aug["probabilidad_espejo"]:
        seq = _espejar_secuencia(seq)

    # ── Ruido gaussiano por frame (no toca los flags de presencia) ──
    sigma = config_aug["ruido_gaussiano_sigma"]
    for s in (SLICE_MANO_IZQ, SLICE_MANO_DER, SLICE_POSE, SLICE_CARA):
        seq[:, s] += np.random.normal(0, sigma, seq[:, s].shape).astype(np.float32)

    return seq.astype(np.float32)
