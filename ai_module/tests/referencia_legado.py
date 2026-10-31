"""
Oráculo de pruebas: copia literal de las funciones del pipeline legado
(scripts/holistic_pipeline.py antes de la refactorización, commit a666e73).
Solo se usa para verificar que preprocessing/ reproduce el vector 1.0.
"""

import numpy as np

N_LANDMARKS_MANO = 21
MANO_MUÑECA = 0
MANO_BASE_MEDIO = 9
POSE_HOMBRO_IZQ = 11
POSE_HOMBRO_DER = 12
N_POSE_SUPERIOR = 17
N_CARA_REDUCIDA = 116
N_FEATURES_FRAME = 527

def _normalizar_forma_mano(mano: np.ndarray) -> np.ndarray:
    """
    Normaliza la CONFIGURACIÓN de la mano: centra en la muñeca y escala por
    la distancia muñeca→base del dedo medio. Invariante a posición y a
    tamaño de mano (y por lo tanto a distancia a la cámara). 63 valores.
    """
    centrada = mano - mano[MANO_MUÑECA]
    escala = np.linalg.norm(centrada[MANO_BASE_MEDIO])
    if escala > 1e-6:
        centrada = centrada / escala
    return centrada.flatten().astype(np.float32)


def _marco_corporal(pose_superior: np.ndarray | None) -> tuple[np.ndarray, float]:
    """
    Origen = punto medio entre hombros. Escala = ancho de hombros.
    Usado para poner pose y cara en unidades de cuerpo, invariantes a
    distancia a la cámara y a la contextura del signante.

    Si no hay pose, cae a un marco neutro centrado en la imagen.
    """
    if pose_superior is None or len(pose_superior) <= POSE_HOMBRO_DER:
        return np.array([0.5, 0.5, 0.0], dtype=np.float32), 1.0

    hombro_izq = pose_superior[POSE_HOMBRO_IZQ]
    hombro_der = pose_superior[POSE_HOMBRO_DER]
    origen = (hombro_izq + hombro_der) / 2.0
    ancho = float(np.linalg.norm(hombro_izq - hombro_der))

    if ancho < 1e-6:
        ancho = 1.0
    return origen.astype(np.float32), ancho


def frame_a_vector(frame: dict) -> np.ndarray:
    """
    Convierte un frame detectado (dict de `detectar_frame`) en el vector de
    features de longitud N_FEATURES_FRAME (527). Ver el layout documentado
    en el docstring del módulo.
    """
    origen, escala = _marco_corporal(frame.get("pose_superior"))

    partes: list[np.ndarray] = []
    presencias: list[float] = []

    for clave in ("mano_izq", "mano_der"):
        mano = frame.get(clave)
        if mano is None or len(mano) != N_LANDMARKS_MANO:
            partes.append(np.zeros(N_LANDMARKS_MANO * 3, dtype=np.float32))
            presencias.append(0.0)
        else:
            partes.append(_normalizar_forma_mano(mano))
            presencias.append(1.0)

    partes.append(np.array(presencias, dtype=np.float32))

    pose_superior = frame.get("pose_superior")
    if pose_superior is not None and len(pose_superior) == N_POSE_SUPERIOR:
        pose_norm = ((pose_superior - origen) / escala).flatten().astype(np.float32)
    else:
        pose_norm = np.zeros(N_POSE_SUPERIOR * 3, dtype=np.float32)
    partes.append(pose_norm)

    cara = frame.get("cara")
    if cara is not None and len(cara) == N_CARA_REDUCIDA:
        cara_norm = ((cara - origen) / escala).flatten().astype(np.float32)
    else:
        cara_norm = np.zeros(N_CARA_REDUCIDA * 3, dtype=np.float32)
    partes.append(cara_norm)

    return np.concatenate(partes).astype(np.float32)


def secuencia_a_matriz(frames: list[dict]) -> np.ndarray:
    """Convierte una lista de frames detectados en una matriz (T, N_FEATURES_FRAME)."""
    if not frames:
        return np.zeros((0, N_FEATURES_FRAME), dtype=np.float32)
    return np.stack([frame_a_vector(f) for f in frames]).astype(np.float32)


def remuestrear_temporal(secuencia: np.ndarray, t_objetivo: int) -> np.ndarray:
    """
    Remuestrea una secuencia (T, F) a (t_objetivo, F) por interpolación
    lineal. Da invarianza a la VELOCIDAD de ejecución de la seña.
    """
    n = len(secuencia)
    if n == 0:
        return np.zeros((t_objetivo, secuencia.shape[1] if secuencia.ndim > 1 else N_FEATURES_FRAME),
                        dtype=np.float32)
    if n == t_objetivo:
        return secuencia.astype(np.float32)

    indices = np.linspace(0, n - 1, t_objetivo)
    bajo = np.floor(indices).astype(int)
    alto = np.minimum(bajo + 1, n - 1)
    peso = (indices - bajo).reshape(-1, 1).astype(np.float32)
    return (secuencia[bajo] * (1.0 - peso) + secuencia[alto] * peso).astype(np.float32)


# ── TCN legada (model/tcn.py de gestilingo-dev@d9f6cd4, copia literal) ──────
# Rellena con el `padding` de Conv1d; models/tcn.py usa F.pad. Sirve para
# verificar que el checkpoint de producción da los mismos números.

import torch
import torch.nn as nn


class BloqueTCN(nn.Module):
    """Dos convoluciones 1D dilatadas + BatchNorm + atajo residual (estilo ResNet)."""

    def __init__(self, canales_in: int, canales_out: int, kernel_size: int = 3,
                 dilation: int = 1, dropout: float = 0.3):
        super().__init__()
        padding = dilation * (kernel_size - 1) // 2  # padding "same" (kernel impar)

        self.conv1 = nn.Conv1d(canales_in, canales_out, kernel_size,
                                padding=padding, dilation=dilation)
        self.bn1 = nn.BatchNorm1d(canales_out)
        self.conv2 = nn.Conv1d(canales_out, canales_out, kernel_size,
                                padding=padding, dilation=dilation)
        self.bn2 = nn.BatchNorm1d(canales_out)
        self.relu = nn.ReLU()
        self.drop = nn.Dropout(dropout)

        # Proyección 1×1 en el atajo cuando cambia el nº de canales entre bloques
        self.atajo = (nn.Conv1d(canales_in, canales_out, 1)
                      if canales_in != canales_out else nn.Identity())

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = self.atajo(x)
        h = self.relu(self.bn1(self.conv1(x)))
        h = self.drop(h)
        h = self.bn2(self.conv2(h))
        return self.relu(h + residual)


class ModeloTCNLegado(nn.Module):
    """
    Pila de BloqueTCN con dilatación 1, 2, 4, 8, ... (dobla por bloque),
    seguida de average-pooling global sobre el tiempo y una cabeza densa.

    `canales` controla tanto la profundidad (nº de bloques) como el ancho.
    Con el dataset actual (25 videos/seña) conviene mantenerlo chico para no
    sobreajustar; subir canales/bloques cuando el dataset crezca.
    """

    def __init__(self, entrada: int, clases: int,
                 canales: tuple[int, ...] = (64, 64, 96, 96),
                 kernel_size: int = 3, dropout: float = 0.4):
        super().__init__()
        bloques = []
        canales_in = entrada
        for i, canales_out in enumerate(canales):
            bloques.append(BloqueTCN(canales_in, canales_out, kernel_size,
                                      dilation=2 ** i, dropout=dropout))
            canales_in = canales_out

        self.tcn = nn.Sequential(*bloques)
        self.pool = nn.AdaptiveAvgPool1d(1)
        self.clasificador = nn.Sequential(
            nn.Linear(canales_in, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, clases),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, T, F) → Conv1d espera (batch, canales, T)
        x = x.transpose(1, 2)
        h = self.tcn(x)                    # (batch, C, T)
        h = self.pool(h).squeeze(-1)        # (batch, C)
        return self.clasificador(h)


# ── Barreras de server.py de gestilingo-dev@d9f6cd4 ───────────────────────────
# _movimiento_muñecas es copia literal; las otras dos reproducen el código en
# línea de /clasificar_frames y _respuesta_dinamica.

SLICE_POSE = slice(128, 128 + N_POSE_SUPERIOR * 3)
POSE_MUÑECA_IZQ = 15
POSE_MUÑECA_DER = 16
RATIO_MIN_CON_MANO = 0.3
MOVIMIENTO_MIN_MUÑECA = 0.08
RATIO_MIN_CON_POSE = 0.5


def _movimiento_muñecas(matriz: np.ndarray) -> float | None:
    """
    Rango máximo (x/y) recorrido por la muñeca más activa en el marco corporal,
    o None si la pose casi no se detectó (cuadro muy cerrado sobre la cara).
    """
    T = len(matriz)
    pose = matriz[:, SLICE_POSE].reshape(T, -1, 3)
    con_pose = np.abs(pose).sum(axis=(1, 2)) > 0
    if T == 0 or con_pose.mean() < RATIO_MIN_CON_POSE:
        return None
    muñecas = pose[con_pose][:, [POSE_MUÑECA_IZQ, POSE_MUÑECA_DER], :2]  # (T', 2, 2)
    return float(np.ptp(muñecas, axis=0).max())


def ratio_con_mano_legado(detectados: list[dict]) -> float:
    """El cálculo de /clasificar_frames (con_mano / len, redondeado a 3)."""
    con_mano = sum(1 for f in detectados
                   if f.get("mano_izq") is not None or f.get("mano_der") is not None)
    return round(con_mano / len(detectados), 3)


def motivo_legado(seña: str, matriz: np.ndarray, ratio: float) -> str | None:
    """Las condiciones de _respuesta_dinamica, en el mismo orden."""
    movimiento = _movimiento_muñecas(matriz)
    if ratio < RATIO_MIN_CON_MANO:
        return "sin_mano"
    if movimiento is not None and movimiento < MOVIMIENTO_MIN_MUÑECA:
        return "poco_movimiento"
    if seña == "ninguna":
        return "modelo_sin_seña"
    return None


# ── Adaptación para las pruebas (no es código legado) ─────────────────────────

def frames_legados(cruda) -> list[dict]:
    """
    SecuenciaCruda → lista de dicts como los devolvía `detectar_frame` del
    pipeline legado: pose 0-16 y cara reducida a los 116 puntos de la 1.0.
    """
    from preprocessing.spec import GRUPOS_CARA_V1, indices_cara

    cara_v1 = indices_cara(GRUPOS_CARA_V1)
    frames = []
    for t in range(len(cruda)):
        frames.append({
            "mano_izq": cruda.manos[t, 0] if cruda.presencia_manos[t, 0] > 0.5 else None,
            "mano_der": cruda.manos[t, 1] if cruda.presencia_manos[t, 1] > 0.5 else None,
            "pose_superior": cruda.pose[t, :N_POSE_SUPERIOR] if cruda.presencia_pose[t] > 0.5 else None,
            "cara": cruda.cara[t, cara_v1] if cruda.presencia_cara[t] > 0.5 else None,
        })
    return frames
