"""GRU con la misma configuración que la LSTM (tiene 3 compuertas en vez de 4)."""

import torch.nn as nn

from models.factory import registrar
from models.recurrente import ModeloRecurrente


@registrar("gru")
class ModeloGRU(ModeloRecurrente):
    arquitectura = "gru"
    celda = nn.GRU
