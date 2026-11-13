"""
Normalización espacial de una secuencia cruda.

  - Marco corporal: origen en el punto medio entre hombros (pose 11 y 12),
    escala por la distancia entre hombros. Se aplica a la pose y a la cara
    y, con `marco_manos: corporal`, también a las manos.
  - Marco local de mano (`marco_manos: local`, versión 1.0): origen en la
    muñeca y escala muñeca→base del dedo medio. Codifica la forma de la mano.
  - Partes ausentes: ceros, con su flag de presencia en 0.

Si en un frame falta la pose, el marco corporal se toma del frame con pose
más cercano (`vecino`) o de un marco neutro centrado en la imagen
(`neutral`, igual que la versión 1.0). Con `vecino`, la ubicación de la cara
y de las manos no salta cuando MediaPipe pierde el torso por un frame.
"""

from __future__ import annotations

from dataclasses import dataclass, fields, replace

import numpy as np

from preprocessing.extraction import SecuenciaCruda
from preprocessing.spec import (
    MANO_BASE_MEDIO, MANO_MUNECA, N_MANO, POSE_HOMBRO_DER, POSE_HOMBRO_IZQ, FeatureSpec,
)

ORIGEN_NEUTRO = np.array([0.5, 0.5, 0.0], dtype=np.float32)
EPS = 1e-6


@dataclass
class SecuenciaNormalizada:
    """Partes ya normalizadas, con la selección de puntos de la FeatureSpec."""

    manos: np.ndarray            # (L, 2, 21, 3)
    presencia_manos: np.ndarray  # (L, 2)
    pose: np.ndarray             # (L, Np, 3)
    presencia_pose: np.ndarray   # (L,)
    cara: np.ndarray             # (L, Nf, 3)
    presencia_cara: np.ndarray   # (L,)

    def __len__(self) -> int:
        return len(self.manos)

    def mapear(self, funcion) -> "SecuenciaNormalizada":
        """Aplica `funcion(array)` a cada arreglo (útil para remuestrear o recortar)."""
        return SecuenciaNormalizada(**{f.name: funcion(getattr(self, f.name)) for f in fields(self)})

    def copia(self) -> "SecuenciaNormalizada":
        return self.mapear(np.copy)

    def con(self, **cambios) -> "SecuenciaNormalizada":
        return replace(self, **cambios)


def marco_corporal(pose: np.ndarray, presencia_pose: np.ndarray, modo: str
                   ) -> tuple[np.ndarray, np.ndarray]:
    """
    Origen (L, 3) y escala (L,) por frame a partir de la pose completa (L, 33, 3).
    """
    largo = len(pose)
    hombro_izq = pose[:, POSE_HOMBRO_IZQ]
    hombro_der = pose[:, POSE_HOMBRO_DER]
    origen = ((hombro_izq + hombro_der) / 2.0).astype(np.float32)
    ancho = np.linalg.norm(hombro_izq - hombro_der, axis=1).astype(np.float32)
    # Igual que la versión 1.0: con pose pero ancho degenerado, escala 1.
    escala = np.where(ancho < EPS, 1.0, ancho).astype(np.float32)

    con_pose = presencia_pose > 0.5
    if con_pose.all():
        return origen, escala
    if modo == "vecino" and con_pose.any():
        indices_con = np.flatnonzero(con_pose)
        for t in np.flatnonzero(~con_pose):
            vecino = indices_con[np.argmin(np.abs(indices_con - t))]
            origen[t], escala[t] = origen[vecino], escala[vecino]
        return origen, escala

    origen[~con_pose] = ORIGEN_NEUTRO
    escala[~con_pose] = 1.0
    return origen, escala


def _forma_local(manos: np.ndarray) -> np.ndarray:
    """(L, 2, 21, 3) → centradas en su muñeca y escaladas por muñeca→base del dedo medio."""
    centradas = manos - manos[:, :, MANO_MUNECA:MANO_MUNECA + 1]
    escala = np.linalg.norm(centradas[:, :, MANO_BASE_MEDIO], axis=-1)  # (L, 2)
    escala = np.where(escala > EPS, escala, 1.0)
    return centradas / escala[..., None, None]


def normalizar(cruda: SecuenciaCruda, spec: FeatureSpec) -> SecuenciaNormalizada:
    """Aplica la normalización de la `spec` a una secuencia cruda."""
    origen, escala = marco_corporal(cruda.pose, cruda.presencia_pose, spec.referencia_sin_pose)
    o = origen[:, None, :]
    e = escala[:, None, None]

    pres_manos = (cruda.presencia_manos > 0.5).astype(np.float32)
    if spec.marco_manos == "local":
        manos = _forma_local(cruda.manos)
    else:
        manos = (cruda.manos - o[:, None]) / e[:, None]
    manos = manos * pres_manos[..., None, None]

    pres_pose = (cruda.presencia_pose > 0.5).astype(np.float32)
    pose = (cruda.pose[:, list(spec.pose_indices)] - o) / e * pres_pose[:, None, None]

    pres_cara = (cruda.presencia_cara > 0.5).astype(np.float32)
    cara = (cruda.cara[:, spec.cara_indices] - o) / e * pres_cara[:, None, None]

    return SecuenciaNormalizada(
        manos=manos.astype(np.float32), presencia_manos=pres_manos,
        pose=pose.astype(np.float32), presencia_pose=pres_pose,
        cara=cara.astype(np.float32), presencia_cara=pres_cara,
    )


# ── Conversión al vector base (layout 1.0) y de vuelta ───────────────────────

def a_matriz_base(sn: SecuenciaNormalizada) -> np.ndarray:
    """(L, dim_base): [mano_izq 63 | mano_der 63 | presencia 2 | pose | cara]."""
    largo = len(sn)
    return np.concatenate([
        sn.manos[:, 0].reshape(largo, -1),
        sn.manos[:, 1].reshape(largo, -1),
        sn.presencia_manos,
        sn.pose.reshape(largo, -1),
        sn.cara.reshape(largo, -1),
    ], axis=1).astype(np.float32)


def desde_matriz_base(matriz: np.ndarray, spec: FeatureSpec) -> SecuenciaNormalizada:
    """Inversa de `a_matriz_base`. Sirve para aceptar vectores legados de 527 valores."""
    matriz = np.asarray(matriz, dtype=np.float32)
    if matriz.ndim != 2 or matriz.shape[1] != spec.dim_base:
        raise ValueError(f"Se esperaba una matriz (T, {spec.dim_base}); llegó {matriz.shape}")
    largo = len(matriz)
    seg = {nombre: matriz[:, i:f] for nombre, i, f in spec.layout_base()}
    manos = np.stack([seg["mano_izq"], seg["mano_der"]], axis=1).reshape(largo, 2, N_MANO, 3)
    pose = seg["pose"].reshape(largo, spec.n_pose, 3)
    cara = seg["cara"].reshape(largo, spec.n_cara, 3)
    return SecuenciaNormalizada(
        manos=manos, presencia_manos=(seg["presencia"] > 0.5).astype(np.float32),
        pose=pose, presencia_pose=(np.abs(pose).sum(axis=(1, 2)) > 0).astype(np.float32),
        cara=cara, presencia_cara=(np.abs(cara).sum(axis=(1, 2)) > 0).astype(np.float32),
    )
