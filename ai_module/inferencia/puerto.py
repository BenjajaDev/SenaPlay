"""
Puerto `ModeloDinamico`: lo único que el servidor sabe del modelo dinámico.

Las rutas reciben landmarks crudos (`SecuenciaCruda`) y deciden con el ranking
completo de clases; no conocen la arquitectura, la FeatureSpec ni el largo T.
Los adaptadores concretos están en model/predict.py (`TCNLegado`,
`LSTMExportado`) y solo `inferencia.modelos.cargar_modelo_dinamico` elige uno.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Literal, Protocol, runtime_checkable

import numpy as np

from preprocessing.extraction import SecuenciaCruda

NombreModelo = Literal["tcn", "lstm"]


@runtime_checkable
class ModeloDinamico(Protocol):
    @property
    def nombre(self) -> NombreModelo: ...

    @property
    def clases(self) -> tuple[str, ...]: ...

    @property
    def clase_rechazo(self) -> str | None:
        """Clase «no es una seña dinámica» («ninguna»), o None si el modelo no tiene."""
        ...

    @property
    def cfg_extraccion(self) -> Mapping[str, float]:
        """fps_muestreo y confianzas de MediaPipe con que se extrajo su dataset."""
        ...

    def ranking(self, cruda: SecuenciaCruda) -> list[tuple[str, float]]:
        """Todas las clases con su probabilidad, de mayor a menor."""
        ...

    def ranking_vectores_v1(self, matriz: np.ndarray) -> list[tuple[str, float]]:
        """Igual que `ranking`, desde vectores (N, 527) en formato 1.0. ValueError si no calza."""
        ...

    def describir(self) -> str: ...
