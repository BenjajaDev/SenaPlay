"""
Fábrica de modelos (patrón Registry + Factory, como `ExerciseFactory` y el
registro de ejercicios de la app).

Cada arquitectura se registra con `@registrar("<nombre>")`; el YAML elige
cuál construir con la clave `arquitectura` y el resto de claves son los
hiperparámetros del constructor. Agregar una arquitectura nueva no toca el
entrenamiento, la evaluación ni el servidor.

    modelo = construir_modelo(cargar_yaml("config/modelos/tcn.yaml"), entrada=1577, clases=9)
"""

from __future__ import annotations

import importlib

import torch.nn as nn

_REGISTRO: dict[str, type[nn.Module]] = {}
_MODULOS = ("models.tcn", "models.lstm", "models.gru")


def registrar(nombre: str):
    def decorador(cls):
        _REGISTRO[nombre] = cls
        return cls
    return decorador


def _cargar_registro() -> None:
    for modulo in _MODULOS:
        importlib.import_module(modulo)


def arquitecturas_disponibles() -> list[str]:
    _cargar_registro()
    return sorted(_REGISTRO)


def hiperparametros(cfg_modelo: dict) -> dict:
    return {k: v for k, v in cfg_modelo.items() if k not in ("arquitectura", "descripcion")}


def construir_modelo(cfg_modelo: dict, entrada: int, clases: int) -> nn.Module:
    _cargar_registro()
    nombre = cfg_modelo.get("arquitectura")
    if nombre not in _REGISTRO:
        raise ValueError(f"Arquitectura desconocida {nombre!r}. Disponibles: {sorted(_REGISTRO)}")
    kwargs = hiperparametros(cfg_modelo)
    for clave in ("canales", "dilataciones"):
        if kwargs.get(clave) is not None:
            kwargs[clave] = tuple(kwargs[clave])
    return _REGISTRO[nombre](entrada=entrada, clases=clases, **kwargs)


def contar_parametros(modelo: nn.Module) -> int:
    return sum(p.numel() for p in modelo.parameters() if p.requires_grad)
