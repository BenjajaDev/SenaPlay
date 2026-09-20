"""
Módulo de inferencia (predicción) para señas estáticas y dinámicas.

ClasificadorEstatico  → modelo scikit-learn (RandomForest/SVM) guardado en .pkl.
                        Recibe 21 landmarks CRUDOS de MediaPipe (x,y,z ~0-1).
ClasificadorDinamico  → TCN de PyTorch (model/tcn.py) guardado en .pt.
                        Recibe una secuencia YA VECTORIZADA por
                        scripts/holistic_pipeline.frame_a_vector (T, 527) —
                        NO landmarks crudos. Ver ai_module/README.md, sección
                        "De captura en vivo a clasificación dinámica", para
                        por qué esto todavía no está conectado a la app.
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
    Carga el TCN entrenado con scripts/train_model.py y lo usa para predecir
    señas dinámicas a partir de una secuencia YA VECTORIZADA (ver
    scripts/holistic_pipeline.frame_a_vector), no de landmarks crudos.
    """

    def __init__(self, ruta_modelo: str):
        if not os.path.exists(ruta_modelo):
            raise FileNotFoundError(f"Modelo dinámico no encontrado en: {ruta_modelo}")

        import torch
        payload = torch.load(ruta_modelo, map_location="cpu")
        self._etiquetas: list[str] = payload["etiquetas"]
        self._longitud_secuencia: int = payload["longitud_secuencia"]
        self._entrada: int = payload["entrada"]

        from model.tcn import ModeloTCN
        self._modelo = ModeloTCN(entrada=self._entrada, clases=len(self._etiquetas))
        self._modelo.load_state_dict(payload["estado"])
        self._modelo.eval()
        print(f"[ClasificadorDinamico] Cargado. Clases: {self._etiquetas}")

    def _ajustar_longitud(self, secuencia: np.ndarray) -> np.ndarray:
        """Interpola/trunca la secuencia (T, F) a la longitud que espera el modelo."""
        from scripts.holistic_pipeline import remuestrear_temporal
        return remuestrear_temporal(secuencia, self._longitud_secuencia)

    def predecir(self, secuencia_features: np.ndarray) -> tuple[str, float]:
        """
        secuencia_features: array (T, entrada) ya producido por
        scripts.holistic_pipeline.frame_a_vector / secuencia_a_matriz para
        cada frame de la seña (NO landmarks crudos de mano).
        Devuelve: (nombre_seña, confianza)
        """
        import torch
        import torch.nn.functional as F

        secuencia = self._ajustar_longitud(secuencia_features)
        tensor = torch.tensor(secuencia, dtype=torch.float32).unsqueeze(0)  # (1, T, entrada)

        with torch.no_grad():
            logits = self._modelo(tensor)
            probabilidades = F.softmax(logits, dim=-1)[0]
            indice = probabilidades.argmax().item()
            confianza = float(probabilidades[indice])

        nombre = self._etiquetas[indice]
        return nombre, confianza
