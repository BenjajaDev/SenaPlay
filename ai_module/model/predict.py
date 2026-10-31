"""
Módulo de inferencia (predicción) para señas estáticas y dinámicas.

ClasificadorEstatico  → modelo scikit-learn (RandomForest/SVM) guardado en .pkl.
                        Recibe 21 landmarks CRUDOS de MediaPipe (x,y,z ~0-1).
ClasificadorDinamico  → TCN, LSTM o GRU de PyTorch (models/), según el meta
                        del modelo exportado. Recibe landmarks crudos
                        (SecuenciaCruda: /clasificar_frames, /clasificar_video)
                        o vectores de 527 valores en formato 1.0
                        (/clasificar_secuencia).
  TCNLegado           → adaptador de la TCN de producción (con «ninguna»).
  LSTMExportado       → adaptador de la LSTM exportada (sin clase de rechazo).
"""

from __future__ import annotations

import logging
import os
from collections.abc import Mapping
from typing import TYPE_CHECKING

import joblib
import numpy as np

if TYPE_CHECKING:
    from preprocessing.extraction import SecuenciaCruda
    from preprocessing.spec import FeatureSpec

logger = logging.getLogger("senaplay.ia.modelos")

# Clase de rechazo del modelo dinámico legado: "esto no es una seña con movimiento".
CLASE_SIN_SEÑA = "ninguna"


# ── Clasificador estático (señas que no tienen movimiento) ────────────────────

class ClasificadorEstatico:
    """
    Carga un clasificador scikit-learn entrenado con train_static.py
    y lo usa para predecir señas estáticas.
    """

    def __init__(self, ruta_modelo: str):
        if not os.path.exists(ruta_modelo):
            raise FileNotFoundError(f"Modelo estático no encontrado en: {ruta_modelo}")

        # joblib guarda el pipeline completo (preprocesador + clasificador)
        payload = joblib.load(ruta_modelo)
        self._pipeline = payload["pipeline"]
        self._etiquetas = payload["etiquetas"]  # lista de nombres de señas
        logger.info("Modelo estático cargado. Clases: %s", self._etiquetas)

    def _extraer_caracteristicas(self, landmarks: np.ndarray) -> np.ndarray:
        """
        Convierte 21 landmarks (21×3) en el MISMO vector de características que
        usa el entrenamiento (63 coordenadas normalizadas + 16 ángulos de flexión).

        IMPORTANTE: debe ser idéntico a train_static.extraer_caracteristicas, de lo
        contrario el modelo recibe un número de features distinto y falla. Por eso
        reutilizamos esa misma función en vez de duplicar la lógica.

        Se esperan landmarks CRUDOS de MediaPipe (x, y, z en rango ~0-1).
        """
        from model.train_static import extraer_caracteristicas
        return extraer_caracteristicas(landmarks)

    def predecir(self, landmarks: np.ndarray) -> tuple[str, float]:
        """
        landmarks: array (21, 3) en coordenadas Three.js world
        Devuelve: (nombre_seña, confianza)
        """
        caracteristicas = self._extraer_caracteristicas(landmarks).reshape(1, -1)
        indice = self._pipeline.predict(caracteristicas)[0]
        probabilidades = self._pipeline.predict_proba(caracteristicas)[0]
        confianza = float(probabilidades[indice])
        nombre = self._etiquetas[indice]
        return nombre, confianza


# ── Clasificador dinámico (señas con movimiento) ──────────────────────────────

class ModeloInvalido(ValueError):
    """El checkpoint no es el modelo que dice la configuración."""


class ClasificadorDinamico:
    """
    Carga el modelo dinámico exportado por training/select_model.py
    (models_saved/dinamico.pt + dinamico.meta.json) o el TCN legado de
    scripts/train_model.py. La arquitectura (TCN, LSTM o GRU) y el
    preprocesamiento se reconstruyen desde el meta; el preprocesamiento es el
    mismo módulo compartido que usó el entrenamiento (preprocessing/).

    Implementa el puerto `inferencia.puerto.ModeloDinamico`. El servidor usa
    los adaptadores `TCNLegado` y `LSTMExportado`, que además verifican que el
    archivo sea el modelo esperado.
    """

    nombre: str = ""

    def __init__(self, ruta_modelo: str):
        if not os.path.exists(ruta_modelo):
            raise FileNotFoundError(f"Modelo dinámico no encontrado en: {ruta_modelo}")

        from models import checkpoint
        from preprocessing.pipeline import Preprocesador
        from preprocessing.spec import FeatureSpec

        self._modelo, self.meta = checkpoint.cargar(ruta_modelo)
        self._etiquetas: list[str] = list(self.meta["clases"])
        spec = FeatureSpec.desde_config(self.meta["preprocesamiento"])
        self._preprocesador = Preprocesador(spec)
        self._longitud_secuencia = spec.T

    @property
    def spec(self) -> FeatureSpec:
        return self._preprocesador.spec

    @property
    def clases(self) -> tuple[str, ...]:
        return tuple(self._etiquetas)

    @property
    def clase_rechazo(self) -> str | None:
        """Clase que significa «no es una seña dinámica», o None si el modelo no tiene."""
        return CLASE_SIN_SEÑA if CLASE_SIN_SEÑA in self._etiquetas else None

    @property
    def cfg_extraccion(self) -> Mapping[str, float]:
        """Parámetros de MediaPipe con los que se extrajo el dataset de entrenamiento."""
        return dict(self._preprocesador.spec.extraccion)

    def _ranking(self, entrada: np.ndarray) -> list[tuple[str, float]]:
        import torch
        import torch.nn.functional as F

        tensor = torch.from_numpy(entrada).unsqueeze(0)  # (1, T, dim_entrada)
        with torch.no_grad():
            probabilidades = F.softmax(self._modelo(tensor), dim=-1)[0].tolist()
        # sorted es estable: ante un empate gana la clase de menor índice, igual que argmax.
        return sorted(zip(self._etiquetas, probabilidades), key=lambda par: -par[1])

    def ranking(self, cruda: SecuenciaCruda) -> list[tuple[str, float]]:
        """Todas las clases con su probabilidad, de mayor a menor (/clasificar_frames y _video)."""
        return self._ranking(self._preprocesador.desde_cruda(cruda))

    def ranking_vectores_v1(self, matriz: np.ndarray) -> list[tuple[str, float]]:
        """
        Igual que `ranking`, desde vectores (N, 527) en formato 1.0 (el contrato
        de /clasificar_secuencia). Lanza ValueError si la matriz no tiene esa
        forma o si el modelo usa features que no se derivan de ese formato.
        """
        matriz = np.asarray(matriz, dtype=np.float32)
        if matriz.ndim != 2 or len(matriz) == 0 or matriz.shape[1] != self.spec.dim_base:
            raise ValueError(f"Se esperaba una matriz (N, {self.spec.dim_base}) con N ≥ 1; "
                             f"llegó {matriz.shape}")
        return self._ranking(self._preprocesador.desde_vectores_v1(matriz))

    def describir(self) -> str:
        return (f"{self.meta['arquitectura'].upper()} (features {self.spec.version}, "
                f"T={self.spec.T}, entrada {self.spec.dim_entrada}). Clases: {self._etiquetas}")

    def _exigir(self, condicion: bool, problema: str) -> None:
        if not condicion:
            raise ModeloInvalido(f"El archivo no es el modelo «{self.nombre}» esperado: {problema}")


class TCNLegado(ClasificadorDinamico):
    """
    TCN de scripts/train_model.py (data/models/dinamico_tcn.pt), la de
    producción: FeatureSpec 1.0 (527 valores, T = 60) y clase de rechazo
    «ninguna». Los parámetros de MediaPipe salen de config/dataset_config.yaml,
    la misma fuente que usaba el servidor para este modelo.
    """

    nombre = "tcn"

    def __init__(self, ruta_modelo: str, cfg_extraccion: Mapping[str, float]):
        super().__init__(ruta_modelo)
        self._exigir(self.meta["arquitectura"] == "tcn",
                     f"arquitectura {self.meta['arquitectura']!r}, no 'tcn'")
        self._exigir(self.spec.version == "1.0", f"features {self.spec.version}, no 1.0")
        self._exigir(CLASE_SIN_SEÑA in self._etiquetas,
                     f"no tiene la clase de rechazo {CLASE_SIN_SEÑA!r}")
        self._cfg_extraccion = {clave: cfg_extraccion[clave] for clave in
                                ("fps_muestreo", "confianza_deteccion", "confianza_landmarks")}

    @property
    def clase_rechazo(self) -> str:
        return CLASE_SIN_SEÑA

    @property
    def cfg_extraccion(self) -> Mapping[str, float]:
        return dict(self._cfg_extraccion)


class LSTMExportado(ClasificadorDinamico):
    """
    LSTM exportada por training/select_model.py (models_saved/dinamico.pt):
    FeatureSpec 2.0 (1577 valores, T = 30), 9 clases y SIN clase de rechazo.
    Solo para pruebas locales: sin «ninguna», la barrera modelo_sin_seña no
    existe y cualquier tramo con movimiento recibe alguna seña.
    """

    nombre = "lstm"

    def __init__(self, ruta_modelo: str):
        super().__init__(ruta_modelo)
        self._exigir(self.meta["arquitectura"] == "lstm",
                     f"arquitectura {self.meta['arquitectura']!r}, no 'lstm'")
        self._exigir(self.spec.version == "2.0", f"features {self.spec.version}, no 2.0")
        self._exigir(CLASE_SIN_SEÑA not in self._etiquetas,
                     f"trae la clase {CLASE_SIN_SEÑA!r}, que este adaptador no contempla")

    @property
    def clase_rechazo(self) -> None:
        return None
