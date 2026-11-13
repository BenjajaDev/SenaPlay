"""
Remuestreo temporal por interpolación lineal, coordenada por coordenada.

Lleva cualquier secuencia a T frames sin importar su duración original; es
lo que da invarianza a la velocidad global de ejecución. Es la misma fórmula
del pipeline legado (`remuestrear_temporal`), generalizada a arreglos de
cualquier forma (el eje 0 es siempre el tiempo).
"""

from __future__ import annotations

import numpy as np


def muestrear_en(arreglo: np.ndarray, tiempos: np.ndarray) -> np.ndarray:
    """Interpola `arreglo` (L, ...) en los instantes fraccionarios `tiempos` (en frames)."""
    largo = len(arreglo)
    tiempos = np.clip(np.asarray(tiempos, dtype=np.float64), 0, max(largo - 1, 0))
    bajo = np.floor(tiempos).astype(int)
    alto = np.minimum(bajo + 1, largo - 1)
    peso = (tiempos - bajo).astype(np.float32).reshape((-1,) + (1,) * (arreglo.ndim - 1))
    return (arreglo[bajo] * (1.0 - peso) + arreglo[alto] * peso).astype(np.float32)


def remuestrear(arreglo: np.ndarray, T: int) -> np.ndarray:
    """(L, ...) → (T, ...). Una secuencia vacía devuelve ceros."""
    largo = len(arreglo)
    if largo == 0:
        return np.zeros((T,) + arreglo.shape[1:], dtype=np.float32)
    if largo == T:
        return arreglo.astype(np.float32)
    return muestrear_en(arreglo, np.linspace(0, largo - 1, T))


def remuestrear_normalizada(sn, T: int):
    """Remuestrea todas las partes de una `SecuenciaNormalizada` a T frames."""
    return sn.mapear(lambda a: remuestrear(a, T))
