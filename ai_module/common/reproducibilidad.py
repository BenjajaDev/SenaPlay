"""Semillas, hash de git y datos del entorno para dejar cada corrida reproducible."""

import platform
import random
import subprocess

import numpy as np

from common.rutas import DIR_AI


def fijar_semilla(semilla: int) -> np.random.Generator:
    """
    Fija las semillas de Python, NumPy y PyTorch, y activa los algoritmos
    deterministas de PyTorch. Devuelve un generador NumPy propio para el
    aumento de datos (así no depende del estado global).
    """
    import torch

    random.seed(semilla)
    np.random.seed(semilla)
    torch.manual_seed(semilla)
    torch.use_deterministic_algorithms(True, warn_only=True)
    return np.random.default_rng(semilla)


def commit_actual() -> str:
    """Hash de HEAD; agrega '-dirty' si hay cambios sin commitear."""
    try:
        commit = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=DIR_AI, text=True, stderr=subprocess.DEVNULL
        ).strip()
        sucio = subprocess.check_output(
            # Código y configuración (incluidos archivos nuevos); no datos ni resultados.
            ["git", "status", "--porcelain", "--untracked-files=all", "--", "*.py", "*.yaml"],
            cwd=DIR_AI, text=True, stderr=subprocess.DEVNULL,
        ).strip()
        return f"{commit}-dirty" if sucio else commit
    except (OSError, subprocess.CalledProcessError):
        return "desconocido"


def nombre_cpu() -> str:
    """Modelo de CPU (Linux: /proc/cpuinfo; otros: platform.processor)."""
    try:
        with open("/proc/cpuinfo", encoding="utf-8") as f:
            for linea in f:
                if linea.startswith("model name"):
                    return linea.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor() or platform.machine()


def info_entorno() -> dict:
    """Versiones de las librerías relevantes para la sección de metodología."""
    import sklearn
    import torch

    info = {
        "python": platform.python_version(),
        "sistema": platform.platform(),
        "cpu": nombre_cpu(),
        "numpy": np.__version__,
        "torch": torch.__version__,
        "scikit_learn": sklearn.__version__,
    }
    for modulo, clave in (("mediapipe", "mediapipe"), ("cv2", "opencv"), ("fastapi", "fastapi")):
        try:
            info[clave] = __import__(modulo).__version__
        except ImportError:
            info[clave] = "no instalado"
    return info
