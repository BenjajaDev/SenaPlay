"""
TCN (Temporal Convolutional Network) para clasificar señas dinámicas a
partir de secuencias del vector holístico de `scripts/holistic_pipeline.py`
(527 features/frame: manos + pose superior + cara reducida).

── Por qué TCN y no LSTM ni CNN 2D sobre (T, F) ─────────────────────────────
Es "CNN pura" (solo convoluciones 1D, sin recurrencia) pero con dilatación
creciente entre capas, lo que le da un campo receptivo temporal grande sin
el costo de entrenar una LSTM. Se descartó CNN2D-sobre-(T,F) porque mezclaría
en la misma convolución dos ejes de naturaleza distinta (tiempo vs.
articulación); aquí el eje "canal" nace de una proyección 1×1 aprendida
sobre las 527 features de cada frame, no de una grilla espacial arbitraria.
Entrena bien en CPU (paraleliza sobre el eje temporal, a diferencia de una
LSTM que es secuencial), que es la restricción dura del entorno: no hay GPU
y el dataset es chico (25 videos/seña).

── Padding "same" en vez de causal ──────────────────────────────────────────
La clasificación ocurre sobre una secuencia YA GRABADA completa (no es
streaming en vivo), así que no hay motivo para restringir cada paso a ver
solo el pasado. Se usa padding simétrico (`dilation*(kernel-1)//2`, kernel
impar) en vez del "chomp" causal típico del paper de TCN — cada frame puede
usar contexto de ambos lados, lo cual mejora la clasificación offline.

Entrada:  (batch, T, 527)  — T = longitud_secuencia de dataset_config.yaml
Salida:   (batch, clases)  — logits
"""

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


class ModeloTCN(nn.Module):
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
