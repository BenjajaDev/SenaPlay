"""
TCN legada (checkpoint `data/models/dinamico_tcn.pt` de scripts/train_model.py).

La implementación vive ahora en `models/tcn.py`, adaptada a la interfaz común
de la comparación (TCN, LSTM, GRU). Este módulo la reexporta con los
hiperparámetros de la versión legada, así `scripts/train_model.py`,
`scripts/visualize_results.py` y los checkpoints ya entrenados siguen
funcionando sin cambios: sin proyección por frame, canales (64, 64, 96, 96),
dropout 0,4, cabeza oculta de 64 y relleno simétrico.
"""

from models.tcn import BloqueTCN  # noqa: F401  (API legada)
from models.tcn import ModeloTCN as _ModeloTCN

CONFIG_LEGADA = {
    "arquitectura": "tcn",
    "canales": [64, 64, 96, 96],
    "kernel_size": 3,
    "dropout": 0.4,
    "causal": False,
    "proyeccion": None,
    "pooling": "media",
    "cabeza_oculta": 64,
}


class ModeloTCN(_ModeloTCN):
    def __init__(self, entrada: int, clases: int, canales: tuple[int, ...] = (64, 64, 96, 96),
                 kernel_size: int = 3, dropout: float = 0.4):
        super().__init__(entrada, clases, canales=canales, kernel_size=kernel_size,
                         dropout=dropout, causal=False, proyeccion=None, pooling="media",
                         cabeza_oculta=64)
