"""
Interfaz común de los modelos temporales.

Todos reciben `x` con forma [B, T, F] y devuelven logits [B, C], con tres
etapas que se comparten para que la comparación aísle el núcleo temporal:

    proyeccion   Linear(F → d) + LayerNorm + ReLU + Dropout, frame a frame
                 (el mismo "embedding por frame" para las tres arquitecturas;
                 con `proyeccion: null` se omite, como en la TCN legada)
    núcleo       TCN | LSTM | GRU  → [B, D] tras el pooling temporal
    clasificador Dropout + Linear(D → C)  (o una capa oculta, en la TCN legada)

La última capa de `clasificador` es siempre la de salida: es la que se
reinicializa en el warm start cuando cambian las clases.
"""

from __future__ import annotations

import torch
import torch.nn as nn


class ProyeccionFrame(nn.Sequential):
    def __init__(self, entrada: int, salida: int, dropout: float):
        super().__init__(nn.Linear(entrada, salida), nn.LayerNorm(salida), nn.ReLU(),
                         nn.Dropout(dropout))


def construir_clasificador(dim: int, clases: int, oculta: int | None, dropout: float) -> nn.Sequential:
    if oculta:
        return nn.Sequential(nn.Linear(dim, oculta), nn.ReLU(), nn.Dropout(dropout),
                             nn.Linear(oculta, clases))
    return nn.Sequential(nn.Dropout(dropout), nn.Linear(dim, clases))


class ModeloSecuencial(nn.Module):
    """Clase base. Las subclases implementan `codificar(h [B,T,d]) -> [B,D]`."""

    arquitectura: str = ""

    def __init__(self, entrada: int, proyeccion: int | None, dropout: float):
        super().__init__()
        self.entrada = entrada
        self.proyeccion = ProyeccionFrame(entrada, proyeccion, dropout) if proyeccion else nn.Identity()
        self.dim_nucleo = proyeccion or entrada

    def codificar(self, h: torch.Tensor) -> torch.Tensor:
        raise NotImplementedError

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.dim() != 3 or x.shape[-1] != self.entrada:
            raise ValueError(f"Se esperaba x con forma [B, T, {self.entrada}], llegó {tuple(x.shape)}")
        return self.clasificador(self.codificar(self.proyeccion(x)))

    @property
    def capa_salida(self) -> nn.Linear:
        return self.clasificador[-1]
