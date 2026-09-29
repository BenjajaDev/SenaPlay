"""
`Preprocesador`: fachada única del preprocesamiento.

Entrenamiento, evaluación, exportación y servidor pasan por aquí, así la
lógica de normalización, remuestreo y features vive en un solo lugar:

    cruda ──normalizar──▶ normalizada ──[time warp]──▶ remuestreo a T
          ──[aumento espacial]──▶ features temporales ──▶ (T, dim_entrada)

Los pasos entre corchetes solo se aplican con `entrenar=True`.
"""

from __future__ import annotations

import numpy as np

from preprocessing.augmentation import Aumentador
from preprocessing.extraction import SecuenciaCruda
from preprocessing.features import matriz_entrada
from preprocessing.normalization import SecuenciaNormalizada, desde_matriz_base, normalizar
from preprocessing.resampling import remuestrear_normalizada
from preprocessing.spec import FeatureSpec


class Preprocesador:
    def __init__(self, spec: FeatureSpec, cfg_aumento: dict | None = None):
        self.spec = spec
        self.aumentador = Aumentador(cfg_aumento, spec)

    @classmethod
    def desde_config(cls, cfg_preprocesamiento: dict, cfg_aumento: dict | None = None
                     ) -> "Preprocesador":
        return cls(FeatureSpec.desde_config(cfg_preprocesamiento), cfg_aumento)

    @property
    def dim_entrada(self) -> int:
        return self.spec.dim_entrada

    @property
    def T(self) -> int:
        return self.spec.T

    def normalizar(self, cruda: SecuenciaCruda) -> SecuenciaNormalizada:
        return normalizar(cruda, self.spec)

    def desde_normalizada(self, sn: SecuenciaNormalizada, rng: np.random.Generator | None = None,
                          entrenar: bool = False) -> np.ndarray:
        aumentar = entrenar and self.aumentador.activo
        if aumentar:
            if rng is None:
                raise ValueError("El aumento de datos requiere un generador `rng` sembrado")
            sn = self.aumentador.temporal(sn, rng)
        sn = remuestrear_normalizada(sn, self.spec.T)
        if aumentar:
            sn = self.aumentador.espacial(sn, rng)
        return matriz_entrada(sn, self.spec)

    def desde_cruda(self, cruda: SecuenciaCruda, rng: np.random.Generator | None = None,
                    entrenar: bool = False) -> np.ndarray:
        return self.desde_normalizada(self.normalizar(cruda), rng, entrenar)

    def desde_vectores_v1(self, matriz: np.ndarray) -> np.ndarray:
        """
        Acepta la entrada legada de `/clasificar_secuencia`: (N, 527) vectores
        de la versión 1.0. Solo es posible si la spec usa manos en marco local
        y los mismos puntos de pose y cara (ver `FeatureSpec.es_compatible_v1`).
        """
        if not self.spec.es_compatible_v1():
            raise ValueError(
                "El modelo activo usa una especificación de features incompatible con los "
                "vectores de 527 valores (versión 1.0); usa /clasificar_video."
            )
        return self.desde_normalizada(desde_matriz_base(matriz, self.spec))

    def a_meta(self) -> dict:
        return {"feature_spec_version": self.spec.version,
                "preprocesamiento": self.spec.a_config(),
                "dim_entrada": self.dim_entrada}
