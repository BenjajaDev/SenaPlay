"""
TCN: bloques residuales de convolución 1D dilatada (dilataciones 1, 2, 4, 8
y kernel 3 por defecto), dropout y pooling temporal al final.

Reutiliza la TCN del repo (antes en `model/tcn.py`): `BloqueTCN` y los
nombres de capas son los mismos, así los checkpoints legados siguen
cargando (`model/tcn.py` reexporta esta clase con los hiperparámetros
legados). Cambios para la comparación:

  - `causal`: con `true`, cada frame solo ve el pasado (relleno a la
    izquierda de dilatación·(kernel−1)). Con `false` (por defecto, igual que
    la versión legada), el relleno es simétrico: la seña se clasifica ya
    grabada completa, así que no hay motivo para ocultar el futuro. Para que
    la comparación sea justa, la LSTM y la GRU son bidireccionales por
    defecto; la variante causal/unidireccional está en
    config/experimentos/ablaciones/causal.yaml.
  - Proyección por frame compartida con LSTM y GRU (ver models/base.py).
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

from models.base import ModeloSecuencial, construir_clasificador
from models.factory import registrar


class BloqueTCN(nn.Module):
    """Dos convoluciones 1D dilatadas + BatchNorm + atajo residual."""

    def __init__(self, canales_in: int, canales_out: int, kernel_size: int = 3,
                 dilation: int = 1, dropout: float = 0.3, causal: bool = False):
        super().__init__()
        total = dilation * (kernel_size - 1)
        self.relleno = (total, 0) if causal else (total // 2, total - total // 2)

        self.conv1 = nn.Conv1d(canales_in, canales_out, kernel_size, dilation=dilation)
        self.bn1 = nn.BatchNorm1d(canales_out)
        self.conv2 = nn.Conv1d(canales_out, canales_out, kernel_size, dilation=dilation)
        self.bn2 = nn.BatchNorm1d(canales_out)
        self.relu = nn.ReLU()
        self.drop = nn.Dropout(dropout)
        self.atajo = (nn.Conv1d(canales_in, canales_out, 1)
                      if canales_in != canales_out else nn.Identity())

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = self.atajo(x)
        h = self.relu(self.bn1(self.conv1(F.pad(x, self.relleno))))
        h = self.drop(h)
        h = self.bn2(self.conv2(F.pad(h, self.relleno)))
        return self.relu(h + residual)


@registrar("tcn")
class ModeloTCN(ModeloSecuencial):
    arquitectura = "tcn"

    def __init__(self, entrada: int, clases: int,
                 canales: tuple[int, ...] = (64, 64, 64, 64),
                 kernel_size: int = 3,
                 dilataciones: tuple[int, ...] | None = None,
                 dropout: float = 0.3,
                 causal: bool = False,
                 proyeccion: int | None = 64,
                 pooling: str = "media",
                 cabeza_oculta: int | None = None):
        super().__init__(entrada, proyeccion, dropout)
        dilataciones = list(dilataciones or [2 ** i for i in range(len(canales))])
        if len(dilataciones) != len(canales):
            raise ValueError("`dilataciones` y `canales` deben tener el mismo largo")
        if pooling not in ("media", "ultimo"):
            raise ValueError("pooling debe ser 'media' o 'ultimo'")
        self.pooling = pooling

        bloques, canales_in = [], self.dim_nucleo
        for canales_out, d in zip(canales, dilataciones):
            bloques.append(BloqueTCN(canales_in, canales_out, kernel_size, d, dropout, causal))
            canales_in = canales_out
        self.tcn = nn.Sequential(*bloques)
        self.clasificador = construir_clasificador(canales_in, clases, cabeza_oculta, dropout)

    def codificar(self, h: torch.Tensor) -> torch.Tensor:
        h = self.tcn(h.transpose(1, 2))           # [B, C, T]
        return h.mean(dim=-1) if self.pooling == "media" else h[:, :, -1]
