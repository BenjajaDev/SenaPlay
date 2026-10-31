"""
Features temporales: posición, velocidad y aceleración.

    posición     x[t]                      (vector base, incluye flags de presencia)
    velocidad    v[t] = x[t] − x[t−1],  v[0] = 0
    aceleración  a[t] = v[t] − v[t−1],  a[0] = 0

Las derivadas excluyen los flags de presencia y valen 0 para una parte
(cada mano, pose, cara) cuando no está presente en t o en t−1. Sin esa
máscara, la aparición de una mano (ceros → coordenadas reales) se vería como
una velocidad enorme que no corresponde a ningún movimiento.

Cada bloque se activa desde `bloques_temporales` en features.yaml, para la
ablación.
"""

from __future__ import annotations

import numpy as np

from preprocessing.normalization import SecuenciaNormalizada, a_matriz_base
from preprocessing.spec import FeatureSpec


def _mascara_coordenadas(sn: SecuenciaNormalizada, spec: FeatureSpec) -> np.ndarray:
    """(T, dim_derivada): 1 donde la parte dueña de esa columna está presente."""
    largo = len(sn)
    columnas = [
        np.repeat(sn.presencia_manos[:, 0:1], 63, axis=1),
        np.repeat(sn.presencia_manos[:, 1:2], 63, axis=1),
        np.repeat(sn.presencia_pose[:, None], spec.n_pose * 3, axis=1),
        np.repeat(sn.presencia_cara[:, None], spec.n_cara * 3, axis=1),
    ]
    mascara = np.concatenate(columnas, axis=1) if largo else np.zeros((0, spec.dim_derivada))
    return (mascara > 0.5).astype(np.float32)


def _derivar(x: np.ndarray, mascara: np.ndarray) -> np.ndarray:
    d = np.zeros_like(x)
    if len(x) > 1:
        d[1:] = (x[1:] - x[:-1]) * mascara[1:] * mascara[:-1]
    return d


def matriz_entrada(sn: SecuenciaNormalizada, spec: FeatureSpec) -> np.ndarray:
    """(T, dim_entrada) con los bloques activos concatenados en orden pos, vel, acc."""
    base = a_matriz_base(sn)
    inicio_pres = 126
    coords = np.delete(base, [inicio_pres, inicio_pres + 1], axis=1)

    bloques = []
    if spec.posicion:
        bloques.append(base)
    if spec.velocidad or spec.aceleracion:
        mascara = _mascara_coordenadas(sn, spec)
        velocidad = _derivar(coords, mascara)
        if spec.velocidad:
            bloques.append(velocidad)
        if spec.aceleracion:
            bloques.append(_derivar(velocidad, mascara))
    return np.concatenate(bloques, axis=1).astype(np.float32)
