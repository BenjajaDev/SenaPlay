"""
Dataset sintético para pruebas y verificaciones de extremo a extremo.

Genera, para cada (clase, signer), una `SecuenciaCruda` con una trayectoria
de muñeca propia de la clase (círculo, línea, zigzag, …), una forma de mano
propia de la clase, y variación por signer (posición, tamaño, velocidad) y
por repetición (ruido, frames sin mano). Escribe los .npz, el manifest.csv
y un manifest.yaml que apunta a ellos, con la misma estructura que el
dataset real, así el entrenamiento no distingue uno de otro.

    python -m tests.sintetico --salida /tmp/sintetico --clases 4 --signers 10
"""

from __future__ import annotations

import argparse
import os
import sys

import numpy as np
import pandas as pd
import yaml

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from preprocessing.extraction import SecuenciaCruda  # noqa: E402


def _trayectoria(clase: int, u: np.ndarray) -> np.ndarray:
    """Desplazamiento 2D de la muñeca (en anchos de hombro) para la fase u ∈ [0, 1]."""
    k = clase % 6
    if k == 0:
        return np.stack([0.3 * np.cos(2 * np.pi * u), 0.3 * np.sin(2 * np.pi * u)], 1)
    if k == 1:
        return np.stack([0.6 * u - 0.3, 0 * u], 1)
    if k == 2:
        return np.stack([0.6 * u - 0.3, 0.2 * np.sign(np.sin(6 * np.pi * u))], 1)
    if k == 3:
        return np.stack([0 * u, 0.6 * u - 0.3], 1)
    if k == 4:
        return np.stack([0.3 * np.sin(4 * np.pi * u), 0.6 * u - 0.3], 1)
    return np.stack([0.3 * np.cos(np.pi * u), -0.3 * np.sin(np.pi * u)], 1)


def secuencia_sintetica(clase: int, signer: int, rng: np.random.Generator) -> SecuenciaCruda:
    largo = int(rng.integers(40, 70))
    seq = SecuenciaCruda.vacia(largo, 30.0)
    rs = np.random.default_rng(1000 + signer)             # rasgos fijos del signer
    centro = np.array([0.5, 0.45]) + rs.normal(0, 0.03, 2)
    ancho = 0.2 * rs.uniform(0.85, 1.15)
    ritmo = rs.uniform(0.8, 1.25)

    u = np.clip(np.linspace(0, 1, largo) ** ritmo, 0, 1)
    muneca = centro + np.array([0.1, -0.1]) + _trayectoria(clase, u) * ancho

    forma_clase = np.random.default_rng(clase).normal(0, 0.03, (21, 2))
    base_mano = np.stack([np.linspace(0, 0.06, 21), np.linspace(0, -0.08, 21)], 1) + forma_clase

    hombro_izq = np.array([centro[0] - ancho / 2, centro[1] + 0.15])
    hombro_der = np.array([centro[0] + ancho / 2, centro[1] + 0.15])
    for t in range(largo):
        seq.pose[t, :, :2] = centro + rng.normal(0, 0.05, (33, 2))
        seq.pose[t, 11, :2], seq.pose[t, 12, :2] = hombro_izq, hombro_der
        seq.pose[t, :, :2] += rng.normal(0, 0.002, (33, 2))
        seq.presencia_pose[t] = 1.0
        seq.cara[t, :, :2] = centro + np.array([0, -0.15]) + rng.normal(0, 0.02, (478, 2))
        seq.presencia_cara[t] = 1.0
        if rng.random() > 0.08:                              # algunos frames sin mano
            seq.manos[t, 1, :, :2] = muneca[t] + base_mano + rng.normal(0, 0.003, (21, 2))
            seq.presencia_manos[t, 1] = 1.0
    seq.info = {"fps_fuente": 30.0, "n_frames_fuente": largo, "duracion_s": largo / 30,
                "dispositivo": "sintetico"}
    return seq


def generar(salida: str, n_clases: int = 4, n_signers: int = 10, semilla: int = 0,
            prefijo_clase: str = "C", lote: str = "lote_00", signers_desde: int = 0) -> dict:
    """Escribe el dataset y devuelve la configuración de manifiesto que apunta a él."""
    rng = np.random.default_rng(semilla)
    dir_videos = os.path.join(salida, "raw_videos")
    dir_lm = os.path.join(salida, "processed_landmarks")
    ruta_manifiesto = os.path.join(salida, "manifest.csv")
    previas = pd.read_csv(ruta_manifiesto, dtype=str) if os.path.exists(ruta_manifiesto) else None

    filas = []
    for c in range(n_clases):
        clase = f"{prefijo_clase}{c}"
        for s in range(signers_desde, signers_desde + n_signers):
            signer = f"s{s:02d}"
            nombre = f"{clase}_{signer}_01"
            video_path = os.path.join(dir_videos, clase, nombre + ".mp4")
            os.makedirs(os.path.dirname(video_path), exist_ok=True)
            open(video_path, "a").close()                     # marcador (no es un video real)
            seq = secuencia_sintetica(c, s, rng)
            seq.guardar(os.path.join(dir_lm, clase, nombre + ".npz"))
            filas.append({"video_path": video_path, "sign_class": clase, "sign_type": "dynamic",
                          "signer_id": signer, "session_id": "", "batch_id": lote,
                          "n_frames": len(seq), "fps": 30.0, "duration_s": len(seq) / 30,
                          "device": "sintetico", "status": "ok", "discard_reason": ""})
    df = pd.DataFrame(filas)
    if previas is not None:
        df = pd.concat([previas, df.astype(str)], ignore_index=True)
    df.to_csv(ruta_manifiesto, index=False)

    cfg_manifiesto = {
        "hereda": "config/datos/manifest.yaml",
        "rutas": {"videos": dir_videos, "landmarks": dir_lm, "manifiesto": ruta_manifiesto,
                  "signers": os.path.join(salida, "signers.csv"),
                  "plantilla_signers": os.path.join(salida, "signers_template.csv")},
    }
    ruta_cfg = os.path.join(salida, "manifest.yaml")
    with open(ruta_cfg, "w", encoding="utf-8") as f:
        yaml.safe_dump(cfg_manifiesto, f)
    return {"manifiesto": ruta_manifiesto, "config_manifiesto": ruta_cfg}


def experimento_rapido(datos: dict, salida_resultados: str, epocas: int = 3,
                       semillas=(0,), n_pliegues: int = 3, n_val: int = 2) -> dict:
    """Configuración del experimento principal reducida para pruebas."""
    from common.config import fusionar, resolver_experimento

    base = resolver_experimento("config/experimentos/comparacion_temporal.yaml")
    return fusionar(base, {
        "nombre": "prueba_sintetica",
        "datos": {**datos, "min_muestras_clase": 2},
        "validacion": {"n_pliegues": n_pliegues, "n_signers_validacion": n_val},
        "entrenamiento": {"semillas": list(semillas), "max_epocas": epocas, "paciencia": 2,
                          "batch_size": 8},
        "latencia": {"calentamiento": 2, "mediciones": 5},
        "salidas": {"directorio": salida_resultados, "dpi": 60},
    })


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Genera un dataset sintético de señas dinámicas")
    parser.add_argument("--salida", required=True)
    parser.add_argument("--clases", type=int, default=4)
    parser.add_argument("--signers", type=int, default=10)
    parser.add_argument("--semilla", type=int, default=0)
    args = parser.parse_args()
    print(generar(args.salida, args.clases, args.signers, args.semilla))
