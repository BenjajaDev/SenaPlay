"""
Módulo de inferencia (predicción) para señas estáticas y dinámicas.

ClasificadorEstatico  → usa un modelo scikit-learn (RandomForest/SVM) guardado en .pkl
ClasificadorDinamico  → usa un modelo PyTorch LSTM guardado en .pt

Ambas clases reciben landmarks ya normalizados en coordenadas Three.js world
y devuelven (nombre_seña, confianza_0_a_1).
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
    Carga un modelo LSTM PyTorch entrenado con train_dynamic.py
    y lo usa para predecir señas que involucran movimiento.

    Recibe una secuencia de N frames de 21 landmarks y devuelve la seña.
    """

    def __init__(self, ruta_modelo: str):
        if not os.path.exists(ruta_modelo):
            raise FileNotFoundError(f"Modelo dinámico no encontrado en: {ruta_modelo}")

        import torch
        payload = torch.load(ruta_modelo, map_location="cpu")
        self._etiquetas: list[str] = payload["etiquetas"]
        self._longitud_secuencia: int = payload["longitud_secuencia"]

        from model.train_dynamic import ModeloLSTM
        self._modelo = ModeloLSTM(
            entrada=63,
            oculto=payload["oculto"],
            capas=payload["capas"],
            clases=len(self._etiquetas),
        )
        self._modelo.load_state_dict(payload["estado"])
        self._modelo.eval()
        print(f"[ClasificadorDinamico] Cargado. Clases: {self._etiquetas}")

    def _normalizar_secuencia(self, frames: np.ndarray) -> np.ndarray:
        """
        frames: (N, 21, 3)
        Normaliza cada frame relativo a su propia muñeca y escala,
        luego interpola/trunca a la longitud esperada por el modelo.
        """
        normalizados = []
        for frame in frames:
            centrado = frame - frame[0]
            escala = np.linalg.norm(centrado[9])
            if escala > 1e-6:
                centrado = centrado / escala
            normalizados.append(centrado.flatten())

        secuencia = np.array(normalizados, dtype=np.float32)  # (N, 63)

        # Interpolar a la longitud que espera el modelo
        n_actual = len(secuencia)
        n_objetivo = self._longitud_secuencia
        if n_actual != n_objetivo:
            indices = np.linspace(0, n_actual - 1, n_objetivo)
            secuencia = np.array([
                secuencia[int(i)] * (1 - (i % 1)) + secuencia[min(int(i) + 1, n_actual - 1)] * (i % 1)
                for i in indices
            ], dtype=np.float32)

        return secuencia  # (longitud_secuencia, 63)

    def predecir(self, frames: np.ndarray) -> tuple[str, float]:
        """
        frames: array (N, 21, 3) con N frames de la seña
        Devuelve: (nombre_seña, confianza)
        """
        import torch
        import torch.nn.functional as F

        secuencia = self._normalizar_secuencia(frames)
        tensor = torch.tensor(secuencia).unsqueeze(0)  # (1, T, 63)

        with torch.no_grad():
            logits = self._modelo(tensor)
            probabilidades = F.softmax(logits, dim=-1)[0]
            indice = probabilidades.argmax().item()
            confianza = float(probabilidades[indice])

        nombre = self._etiquetas[indice]
        return nombre, confianza
