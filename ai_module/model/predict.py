"""
Módulo de inferencia (predicción) para señas estáticas y dinámicas.

ClasificadorEstatico  → modelo scikit-learn (RandomForest/SVM) guardado en .pkl.
                        Recibe 21 landmarks CRUDOS de MediaPipe (x,y,z ~0-1).
ClasificadorDinamico  → TCN, LSTM o GRU de PyTorch (models/), según el meta
                        del modelo exportado. Recibe landmarks crudos de un
                        video (/clasificar_video) o vectores de 527 valores en
                        formato 1.0 (/clasificar_secuencia).
"""

import numpy as np
import joblib
import os


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
        print(f"[ClasificadorEstatico] Cargado. Clases: {self._etiquetas}")

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

class ClasificadorDinamico:
    """
    Carga el modelo dinámico exportado por training/select_model.py
    (models_saved/dinamico.pt + dinamico.meta.json) o el TCN legado de
    scripts/train_model.py. La arquitectura (TCN, LSTM o GRU) y el
    preprocesamiento se reconstruyen desde el meta; el preprocesamiento es el
    mismo módulo compartido que usó el entrenamiento (preprocessing/).
    """

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
        print(f"[ClasificadorDinamico] {self.meta['arquitectura'].upper()} "
              f"(features {spec.version}, T={spec.T}). Clases: {self._etiquetas}")

    @property
    def cfg_extraccion(self) -> dict:
        """Parámetros de MediaPipe con los que se extrajo el dataset de entrenamiento."""
        return dict(self._preprocesador.spec.extraccion)

    def _clasificar(self, entrada: np.ndarray) -> tuple[str, float]:
        import torch
        import torch.nn.functional as F

        tensor = torch.from_numpy(entrada).unsqueeze(0)  # (1, T, dim_entrada)
        with torch.no_grad():
            probabilidades = F.softmax(self._modelo(tensor), dim=-1)[0]
        indice = int(probabilidades.argmax().item())
        return self._etiquetas[indice], float(probabilidades[indice])

    def predecir(self, secuencia_features: np.ndarray) -> tuple[str, float]:
        """
        secuencia_features: (N, 527) vectores en formato 1.0 (el contrato de
        /clasificar_secuencia). Lanza ValueError si el modelo usa una
        especificación de features que no se puede derivar de ese formato.
        """
        return self._clasificar(self._preprocesador.desde_vectores_v1(secuencia_features))

    def predecir_cruda(self, secuencia) -> tuple[str, float]:
        """secuencia: preprocessing.extraction.SecuenciaCruda (lo que usa /clasificar_video)."""
        return self._clasificar(self._preprocesador.desde_cruda(secuencia))
