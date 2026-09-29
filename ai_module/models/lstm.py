"""LSTM (capas, tamaño oculto y dirección configurables)."""

import torch.nn as nn

from models.factory import registrar
from models.recurrente import ModeloRecurrente


@registrar("lstm")
class ModeloLSTM(ModeloRecurrente):
    arquitectura = "lstm"
    celda = nn.LSTM
