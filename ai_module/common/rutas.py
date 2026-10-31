"""
Rutas del módulo de IA.

Todas las rutas de los archivos YAML son relativas a `ai_module/`, para que
los comandos funcionen igual sin importar desde dónde se invoquen.
"""

import os

DIR_AI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # ai_module/
DIR_CONFIG = os.path.join(DIR_AI, "config")
DIR_RESULTADOS = os.path.join(DIR_AI, "results")
DIR_MODELOS_GUARDADOS = os.path.join(DIR_AI, "models_saved")
DIR_MODELOS_MEDIAPIPE = os.path.join(DIR_AI, "models_mediapipe")


def resolver(ruta: str) -> str:
    """Convierte una ruta relativa a `ai_module/` en absoluta (las absolutas pasan igual)."""
    if os.path.isabs(ruta):
        return ruta
    return os.path.normpath(os.path.join(DIR_AI, ruta))


def relativa(ruta: str) -> str:
    """Expresa una ruta absoluta como relativa a `ai_module/` (con '/' como separador)."""
    return os.path.relpath(os.path.abspath(ruta), DIR_AI).replace(os.sep, "/")
