"""
Barreras de rechazo de los tramos dinámicos, calculadas sobre landmarks
crudos (`SecuenciaCruda`) y no sobre el vector de features: así valen igual
para la TCN (FeatureSpec 1.0) y para la LSTM (2.0).

    sin_mano          menos de RATIO_MIN_CON_MANO de cuadros con alguna mano
    poco_movimiento   la muñeca más activa recorre menos de MOVIMIENTO_MIN_MUÑECA
                      anchos de hombro (solo si hay pose en la mitad de los cuadros)
    modelo_sin_seña   el modelo responde su clase de rechazo («ninguna»); solo
                      existe si el modelo la tiene: la LSTM exportada no

Se evalúan en ese orden y gana la primera. Las constantes son las que fijó el
servidor con la TCN legada; cambiarlas es recalibrar (tarea 5 de
docs/ai/pendientes_integracion.md).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np

from preprocessing.extraction import SecuenciaCruda
from preprocessing.normalization import marco_corporal

Motivo = Literal["sin_mano", "poco_movimiento", "modelo_sin_seña"]

# Por debajo de esta fracción de cuadros con mano, el tramo no se clasifica:
# el modelo rellenaría la seña con ceros y respondería cualquier cosa.
RATIO_MIN_CON_MANO = 0.3

# Desplazamiento mínimo de la muñeca más activa (en anchos de hombro) para
# considerar el tramo una seña dinámica. En el dataset real el mínimo es ~0.09
# (J/G) y la mediana 0.3–1.0; la mano quieta o un cambio entre letras
# estáticas quedan bajo ~0.05. Es una barrera determinista que complementa a
# la clase "ninguna" de la TCN, que con un dataset tan chico todavía deja
# pasar parte de esos tramos.
MOVIMIENTO_MIN_MUÑECA = 0.08
# Si la pose (hombros) se ve en menos de esta fracción de cuadros, no hay marco
# corporal fiable para medir el desplazamiento y decide solo el modelo.
RATIO_MIN_CON_POSE = 0.5

POSE_MUÑECA_IZQ = 15
POSE_MUÑECA_DER = 16


@dataclass(frozen=True)
class Evaluacion:
    motivo: Motivo | None
    movimiento_muñeca: float | None   # sin redondear
    ratio_con_mano: float             # redondeado a 3 decimales, como se informa

    @property
    def es_seña(self) -> bool:
        return self.motivo is None


def barreras_activas(clase_rechazo: str | None) -> dict[str, bool]:
    return {"sin_mano": True, "poco_movimiento": True,
            "modelo_sin_seña": clase_rechazo is not None}


def ratio_con_mano(cruda: SecuenciaCruda) -> float:
    """
    Fracción de cuadros con alguna mano, redondeada a 3 decimales.

    Se calcula como con_mano / L, igual que el servidor legado, y no como
    1 − ratio_sin_manos(): en coma flotante 1 − (1 − x) no siempre es x, y
    en valores como 1/80 = 0,0125 el redondeo caería al otro lado.
    """
    largo = len(cruda)
    if largo == 0:
        return 0.0
    con_mano = int((cruda.presencia_manos.max(axis=1) > 0.5).sum())
    return round(con_mano / largo, 3)


def movimiento_muñecas(cruda: SecuenciaCruda) -> float | None:
    """
    Rango máximo (x o y) que recorre la muñeca más activa en el marco de
    hombros de cada cuadro, o None si la pose se vio en menos de la mitad de
    los cuadros (cuadro muy cerrado sobre la cara).
    """
    con_pose = cruda.presencia_pose > 0.5
    if len(cruda) == 0 or con_pose.mean() < RATIO_MIN_CON_POSE:
        return None
    # Mismo marco que la pose del vector 1.0: origen entre los hombros y escala
    # por su distancia (1 si es degenerada). Solo se usan cuadros con pose, así
    # que el modo de relleno da igual.
    origen, escala = marco_corporal(cruda.pose, cruda.presencia_pose, "neutral")
    muñecas = cruda.pose[:, [POSE_MUÑECA_IZQ, POSE_MUÑECA_DER], :2]          # (L, 2, 2)
    normalizadas = (muñecas - origen[:, None, :2]) / escala[:, None, None]
    return float(np.ptp(normalizadas[con_pose], axis=0).max())


def evaluar(cruda: SecuenciaCruda, mejor: str, clase_rechazo: str | None) -> Evaluacion:
    """`mejor`: la clase más probable del modelo. `clase_rechazo`: la del modelo, o None."""
    ratio = ratio_con_mano(cruda)
    movimiento = movimiento_muñecas(cruda)

    motivo: Motivo | None = None
    if ratio < RATIO_MIN_CON_MANO:
        motivo = "sin_mano"
    elif movimiento is not None and movimiento < MOVIMIENTO_MIN_MUÑECA:
        motivo = "poco_movimiento"
    elif clase_rechazo is not None and mejor == clase_rechazo:
        motivo = "modelo_sin_seña"
    return Evaluacion(motivo=motivo, movimiento_muñeca=movimiento, ratio_con_mano=ratio)
