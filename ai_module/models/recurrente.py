"""Base de LSTM y GRU: misma configuración, solo cambia la celda recurrente."""

from __future__ import annotations

import torch
import torch.nn as nn

from models.base import ModeloSecuencial, construir_clasificador


class ModeloRecurrente(ModeloSecuencial):
    celda: type[nn.RNNBase]

    def __init__(self, entrada: int, clases: int,
                 oculto: int = 64,
                 capas: int = 2,
                 bidireccional: bool = True,
                 dropout: float = 0.3,
                 proyeccion: int | None = 64,
                 pooling: str = "media",
                 cabeza_oculta: int | None = None):
        super().__init__(entrada, proyeccion, dropout)
        if pooling not in ("media", "ultimo"):
            raise ValueError("pooling debe ser 'media' o 'ultimo'")
        self.pooling = pooling
        self.rnn = self.celda(
            input_size=self.dim_nucleo, hidden_size=oculto, num_layers=capas, batch_first=True,
            bidirectional=bidireccional, dropout=dropout if capas > 1 else 0.0,
        )
        self.direcciones = 2 if bidireccional else 1
        self.clasificador = construir_clasificador(oculto * self.direcciones, clases,
                                                   cabeza_oculta, dropout)

    def codificar(self, h: torch.Tensor) -> torch.Tensor:
        salida, estado = self.rnn(h)
        if self.pooling == "media":
            return salida.mean(dim=1)
        h_n = estado[0] if isinstance(estado, tuple) else estado   # LSTM → (h, c)
        # último estado de la última capa, en cada dirección
        return torch.cat(list(h_n[-self.direcciones:]), dim=-1)
