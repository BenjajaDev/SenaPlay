"""
Carga/guardado de `config/dataset_config.yaml` y helpers compartidos de rutas.

Todo lo que toca el dataset (extracción, entrenamiento, alta de señas nuevas)
pasa por aquí para no duplicar la lógica de "dónde está cada carpeta" ni el
formato del YAML.
"""

import os

import yaml

_DIR_AI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # ai_module/
RUTA_CONFIG = os.path.join(_DIR_AI, "config", "dataset_config.yaml")

DIR_RAW_VIDEOS = os.path.join(_DIR_AI, "data", "raw_videos")
DIR_PROCESSED_LANDMARKS = os.path.join(_DIR_AI, "data", "processed_landmarks")
DIR_MODELOS = os.path.join(_DIR_AI, "data", "models")


def cargar_config(ruta: str = RUTA_CONFIG) -> dict:
    with open(ruta, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f) or {}
    config.setdefault("señas", {})
    return config


def guardar_config(config: dict, ruta: str = RUTA_CONFIG) -> None:
    with open(ruta, "w", encoding="utf-8") as f:
        yaml.safe_dump(config, f, allow_unicode=True, sort_keys=False, default_flow_style=False)


def señas_activas(config: dict) -> list[str]:
    """Nombres de carpeta de las señas marcadas `activa: true` (default true si no se especifica)."""
    return [
        nombre for nombre, datos in config.get("señas", {}).items()
        if (datos or {}).get("activa", True)
    ]


def registrar_seña(config: dict, nombre: str, nombre_visible: str | None = None,
                    dificultad: int = 1, descripcion: str = "") -> bool:
    """
    Agrega `nombre` al repertorio si no existe todavía. Devuelve True si se
    agregó una entrada nueva, False si ya existía (no la pisa).
    """
    señas = config.setdefault("señas", {})
    if nombre in señas:
        return False
    señas[nombre] = {
        "nombre_visible": nombre_visible or nombre.replace("_", " ").capitalize(),
        "descripcion": descripcion,
        "dificultad": dificultad,
        "activa": True,
    }
    return True


def carpetas_de_señas(directorio: str) -> list[str]:
    """Subcarpetas de primer nivel dentro de `directorio` (ignora archivos sueltos)."""
    if not os.path.isdir(directorio):
        return []
    return sorted([
        nombre for nombre in os.listdir(directorio)
        if os.path.isdir(os.path.join(directorio, nombre)) and not nombre.startswith(".")
    ])
