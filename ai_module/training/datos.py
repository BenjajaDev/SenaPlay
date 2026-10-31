"""
Carga del dataset dinámico a partir del manifiesto (patrón Repository: el
resto del entrenamiento no sabe dónde ni cómo están guardados los .npz).
"""

from __future__ import annotations

import os
from dataclasses import dataclass

import numpy as np
import pandas as pd
import torch

from common.config import cargar_yaml
from common.rutas import resolver
from preprocessing.extraction import SecuenciaCruda
from preprocessing.normalization import SecuenciaNormalizada
from preprocessing.pipeline import Preprocesador


def ruta_npz(video_path: str, cfg_manifiesto: dict) -> str:
    from data.manifest import ruta_landmarks
    return ruta_landmarks(video_path, cfg_manifiesto)


def cargar_filas(cfg_exp: dict) -> tuple[pd.DataFrame, list[str]]:
    """Filas del manifiesto que entran al experimento, y las clases en orden."""
    datos = cfg_exp["datos"]
    ruta = resolver(datos["manifiesto"])
    if not os.path.exists(ruta):
        raise FileNotFoundError(f"No existe {datos['manifiesto']}. Corre: python -m data.manifest")
    df = pd.read_csv(ruta, dtype={"signer_id": str, "session_id": str, "batch_id": str})
    df = df[(df["status"] == "ok") & (df["sign_type"] == "dynamic")]

    clases = datos.get("clases")
    if clases:
        faltan = sorted(set(clases) - set(df["sign_class"]))
        if faltan:
            raise ValueError(f"Clases pedidas sin videos útiles en el manifiesto: {faltan}")
        df = df[df["sign_class"].isin(clases)]
    clases = sorted(df["sign_class"].unique())

    minimo = datos.get("min_muestras_clase", 1)
    conteo = df["sign_class"].value_counts()
    pocas = conteo[conteo < minimo]
    if len(pocas):
        raise ValueError(f"Clases con menos de {minimo} videos útiles: {pocas.to_dict()}")
    if len(clases) < 2:
        raise ValueError(f"Se necesitan al menos 2 clases dinámicas; hay {clases}")
    return df.sort_values(["sign_class", "signer_id", "video_path"]).reset_index(drop=True), clases


@dataclass
class DatasetDinamico:
    filas: pd.DataFrame
    normalizadas: list[SecuenciaNormalizada]
    y: np.ndarray            # índices de clase
    grupos: np.ndarray       # signer_id
    clases: list[str]
    preprocesador: Preprocesador

    def __len__(self) -> int:
        return len(self.y)

    def lote(self, indices, rng: np.random.Generator | None = None, entrenar: bool = False
             ) -> torch.Tensor:
        """Tensor [n, T, F]. Con `entrenar=True` cada llamada genera una variante aumentada nueva."""
        X = np.stack([self.preprocesador.desde_normalizada(self.normalizadas[i], rng, entrenar)
                      for i in indices])
        return torch.from_numpy(X)

    def etiquetas(self, indices) -> torch.Tensor:
        return torch.from_numpy(self.y[np.asarray(indices)]).long()


def cargar_dataset(cfg_exp: dict, preprocesador: Preprocesador) -> DatasetDinamico:
    filas, clases = cargar_filas(cfg_exp)
    cfg_manifiesto = cargar_yaml(cfg_exp["datos"]["config_manifiesto"])
    mapa = {c: i for i, c in enumerate(clases)}

    normalizadas = []
    for video_path in filas["video_path"]:
        ruta = ruta_npz(video_path, cfg_manifiesto)
        if not os.path.exists(ruta):
            raise FileNotFoundError(f"Falta {ruta}. Vuelve a correr: python -m data.manifest")
        normalizadas.append(preprocesador.normalizar(SecuenciaCruda.cargar(ruta)))

    return DatasetDinamico(
        filas=filas,
        normalizadas=normalizadas,
        y=filas["sign_class"].map(mapa).to_numpy(np.int64),
        grupos=filas["signer_id"].astype(str).to_numpy(),
        clases=clases,
        preprocesador=preprocesador,
    )
