"""
Fábrica del modelo dinámico: el único lugar que conoce los adaptadores concretos.
"""

from __future__ import annotations

from inferencia.ajustes import Ajustes
from inferencia.puerto import ModeloDinamico


def cargar_modelo_dinamico(ajustes: Ajustes) -> ModeloDinamico:
    """
    Carga el modelo que pide MODELO_DINAMICO. Lanza model.predict.ModeloInvalido
    si el archivo no es ese modelo (por ejemplo, RUTA_MODELO_TCN apunta a la LSTM).
    """
    from model.predict import LSTMExportado, TCNLegado

    ruta = str(ajustes.ruta_modelo_dinamico)
    if ajustes.modelo_dinamico == "tcn":
        from scripts.dataset_config_utils import cargar_config
        return TCNLegado(ruta, cargar_config()["extraccion"])
    return LSTMExportado(ruta)
