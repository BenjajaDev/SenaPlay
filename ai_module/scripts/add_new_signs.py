"""
Flujo guiado para agregar una seña nueva al repertorio.

Uso:
    cd ai_module
    python scripts/add_new_signs.py --seña hola
    python scripts/add_new_signs.py --seña hola --reentrenar   # además reentrena el modelo completo

Qué hace:
    1. Si no existe, crea data/raw_videos/<seña>/ y se detiene ahí (avisando
       que hay que llenarla con videos antes de continuar).
    2. Si ya tiene videos, la registra en config/dataset_config.yaml (si no
       estaba) y corre scripts/extract_landmarks.py solo para esa seña.
    3. Con --reentrenar, reentrena el modelo COMPLETO (todas las señas
       activas) — no existe fine-tuning incremental: el dataset es chico y
       el modelo es rápido de entrenar en CPU, así que reentrenar desde cero
       cada vez es más simple y más confiable que mantener un modelo
       "parcheado". Para agregar varias señas de una, pásalas todas antes
       de reentrenar una sola vez (más rápido que reentrenar por cada una).
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.dataset_config_utils import (
    DIR_RAW_VIDEOS,
    cargar_config,
    guardar_config,
    registrar_seña,
)
from scripts.extract_landmarks import extraer_todo


def agregar_seña(nombre: str, reentrenar: bool = False) -> None:
    carpeta_videos = os.path.join(DIR_RAW_VIDEOS, nombre)

    if not os.path.isdir(carpeta_videos):
        os.makedirs(carpeta_videos, exist_ok=True)
        print(f"[Alta de seña] Creada data/raw_videos/{nombre}/ (vacía).")
        print(f"[Alta de seña] Copia ahí los videos (.mp4/.mov) de '{nombre}' y vuelve a "
              f"correr: python scripts/add_new_signs.py --seña {nombre}")
        return

    config = cargar_config()
    formatos = tuple(ext.lower() for ext in config["extraccion"]["formatos_video"])
    videos = [f for f in os.listdir(carpeta_videos) if f.lower().endswith(formatos)]

    if not videos:
        print(f"[Alta de seña] data/raw_videos/{nombre}/ existe pero está vacía. "
              f"Agrega videos y vuelve a correr este comando.")
        return

    if registrar_seña(config, nombre):
        guardar_config(config)
        print(f"[Alta de seña] '{nombre}' registrada en config/dataset_config.yaml")

    print(f"[Alta de seña] Extrayendo landmarks de {len(videos)} video(s) de '{nombre}'...")
    extraer_todo(señas_filtro=[nombre])

    if reentrenar:
        print(f"\n[Alta de seña] Reentrenando el modelo completo con el repertorio actualizado...")
        from scripts.dataset_config_utils import señas_activas
        from scripts.train_model import entrenar
        config = cargar_config()  # recargar por si extraer_todo la modificó
        entrenar(config, señas_filtro=señas_activas(config))
    else:
        print(f"\n[Alta de seña] Landmarks listos. Para entrenar con el repertorio actualizado:")
        print(f"  python scripts/train_model.py")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Agrega una seña nueva al repertorio dinámico")
    parser.add_argument("--seña", required=True, help="Nombre de la seña (nombre de carpeta, ej: hola)")
    parser.add_argument("--reentrenar", action="store_true",
                        help="Reentrenar el modelo completo después de extraer landmarks")
    args = parser.parse_args()

    agregar_seña(args.seña, reentrenar=args.reentrenar)
