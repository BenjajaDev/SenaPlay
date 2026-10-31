"""
Evaluación del Random Forest de señas estáticas con StratifiedGroupKFold,
agrupado por imagen fuente (ver config/experimentos/estatico_rf.yaml).

No cambia la lógica de entrenamiento: usa `construir_pipeline`,
`aumentar_landmarks` y `extraer_caracteristicas` de model/train_static.py
tal cual. Lo único distinto es la partición:

  - train_static.py: train_test_split por muestra (80/20) + cross_val_score
    por muestra, donde las copias de Roboflow de una misma foto pueden caer
    en entrenamiento y prueba a la vez.
  - aquí: 5 pliegues sin imágenes fuente compartidas; el aumento se aplica
    solo al entrenamiento de cada pliegue.

Los landmarks se vuelven a extraer (con el mismo detector de
data/extract_landmarks.py) porque los .npy de data/landmarks_estaticos/ no
guardan de qué imagen salieron. Quedan en caché para las corridas siguientes.

    cd ai_module
    python -m training.eval_static
"""

from __future__ import annotations

import argparse
import io
import os
import re
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sklearn.model_selection import StratifiedGroupKFold  # noqa: E402

from common.config import cargar_yaml  # noqa: E402
from common.rutas import resolver  # noqa: E402
from training import evaluate  # noqa: E402

EXTENSIONES = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
_PREFIJO_SPLIT = re.compile(r"^(train|valid|test)_")
_SUFIJO_ROBOFLOW = re.compile(r"\.rf\.[0-9a-f]+(\.[a-z]+)$", re.IGNORECASE)


def imagen_fuente(clase: str, archivo: str) -> str:
    """'train_A1_jpg.rf.3ded….jpg' → 'A/A1_jpg' (todas las copias de Roboflow comparten fuente)."""
    base = _SUFIJO_ROBOFLOW.sub("", _PREFIJO_SPLIT.sub("", archivo))
    return f"{clase}/{os.path.splitext(base)[0] if base == archivo else base}"


def extraer_landmarks_imagenes(cfg_datos: dict, forzar: bool = False) -> pd.DataFrame:
    """Devuelve un DataFrame (ruta, clase, grupo, landmarks) solo con imágenes con mano detectada."""
    cache = resolver(cfg_datos["cache"])
    if os.path.exists(cache) and not forzar:
        with np.load(cache, allow_pickle=False) as d:
            return pd.DataFrame({"ruta": d["ruta"], "clase": d["clase"], "grupo": d["grupo"],
                                 "landmarks": list(d["landmarks"])})

    from data.extract_landmarks import crear_detector_manos, extraer_de_imagen

    dir_imagenes = resolver(cfg_datos["imagenes"])
    detector = crear_detector_manos(confianza_deteccion=cfg_datos.get("confianza_deteccion", 0.6))
    filas, sin_mano = [], 0
    try:
        for clase in sorted(os.listdir(dir_imagenes)):
            carpeta = os.path.join(dir_imagenes, clase)
            if not os.path.isdir(carpeta):
                continue
            for archivo in sorted(os.listdir(carpeta)):
                if not archivo.lower().endswith(EXTENSIONES):
                    continue
                lm = extraer_de_imagen(os.path.join(carpeta, archivo), detector)
                if lm is None:
                    sin_mano += 1
                    continue
                filas.append({"ruta": f"{clase}/{archivo}", "clase": clase,
                              "grupo": imagen_fuente(clase, archivo), "landmarks": lm})
    finally:
        detector.close()
    print(f"[Estático] {len(filas)} imágenes con mano, {sin_mano} sin mano detectada")

    df = pd.DataFrame(filas)
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    np.savez_compressed(cache, ruta=df["ruta"].to_numpy(str), clase=df["clase"].to_numpy(str),
                        grupo=df["grupo"].to_numpy(str),
                        landmarks=np.stack(df["landmarks"]).astype(np.float32))
    return df


def evaluar_estatico(cfg: dict, forzar_extraccion: bool = False, verbose: bool = True) -> dict:
    from model.train_static import (
        _features_de_lote, aumentar_landmarks, construir_pipeline, extraer_caracteristicas,
    )

    df = extraer_landmarks_imagenes(cfg["datos"], forzar=forzar_extraccion)
    clases = sorted(df["clase"].unique())
    mapa = {c: i for i, c in enumerate(clases)}
    X_raw = np.stack(df["landmarks"]).astype(np.float32)
    y = df["clase"].map(mapa).to_numpy(np.int64)
    grupos = df["grupo"].to_numpy()

    cv = cfg["validacion"]
    divisor = StratifiedGroupKFold(n_splits=cv["n_pliegues"], shuffle=True,
                                   random_state=cv["semilla_particion"])
    predicciones, entrenamiento, pipeline_latencia = [], [], None
    for pliegue, (idx_ent, idx_prueba) in enumerate(divisor.split(X_raw, y, grupos)):
        comunes = set(grupos[idx_ent]) & set(grupos[idx_prueba])
        if comunes:
            raise AssertionError(f"Pliegue {pliegue}: imágenes fuente compartidas {sorted(comunes)[:3]}")
        X_ent, y_ent = X_raw[idx_ent], y[idx_ent]
        if cfg["aumento"]["n_aug"] > 0:
            X_ent, y_ent = aumentar_landmarks(X_ent, y_ent, n_aug=cfg["aumento"]["n_aug"])
        pipeline = construir_pipeline(cfg.get("modelo", "rf"))
        pipeline.fit(_features_de_lote(X_ent), y_ent)
        probs = pipeline.predict_proba(_features_de_lote(X_raw[idx_prueba]))
        pred = pipeline.classes_[probs.argmax(1)]
        predicciones.append(pd.DataFrame({
            "pliegue": pliegue, "semilla": 42, "ruta": df["ruta"].to_numpy()[idx_prueba],
            "grupo": grupos[idx_prueba], "clase_real": [clases[i] for i in y[idx_prueba]],
            "clase_predicha": [clases[i] for i in pred], "y_true": y[idx_prueba], "y_pred": pred,
            "confianza": probs.max(1),
        }))
        entrenamiento.append({"pliegue": pliegue, "semilla": 42, "n_entrenamiento": len(idx_ent),
                              "n_entrenamiento_aumentado": len(y_ent), "n_prueba": len(idx_prueba)})
        if pipeline_latencia is None:
            pipeline_latencia = pipeline
        if verbose:
            aciertos = (pred == y[idx_prueba]).mean()
            print(f"  [RF] pliegue {pliegue}: accuracy {aciertos:.3f} ({len(idx_prueba)} imágenes)")

    muestra = X_raw[0]
    lat = evaluate.medir_latencia(
        lambda: pipeline_latencia.predict_proba(extraer_caracteristicas(muestra).reshape(1, -1)),
        cfg["latencia"]["calentamiento"], cfg["latencia"]["mediciones"])
    import joblib
    buffer = io.BytesIO()
    joblib.dump({"pipeline": pipeline_latencia, "etiquetas": clases}, buffer)
    lat.update(batch=1, dispositivo="cpu", incluye="extracción de features + predict_proba",
               tamano_mb=buffer.tell() / (1024 ** 2))
    nodos = sum(a.tree_.node_count for a in pipeline_latencia.named_steps["clasificador"].estimators_) \
        if hasattr(pipeline_latencia.named_steps["clasificador"], "estimators_") else 0

    directorio = os.path.join(resolver(cfg["salidas"]["directorio"]),
                              evaluate.nombre_corrida("rf_estatico", evaluate.EXPERIMENTO_PRINCIPAL,
                                                      "kfold"))
    info = evaluate.escribir_corrida(
        directorio, cfg=cfg, arquitectura="Random Forest", esquema=cv["esquema"], clases=clases,
        predicciones=pd.concat(predicciones, ignore_index=True), historial=None,
        entrenamiento=pd.DataFrame(entrenamiento), latencia=lat, parametros=nodos,
        n_videos=len(df), n_signers=len(set(grupos)), tipo="estatica",
    )
    if verbose:
        f1 = info["metricas"]["f1_macro"]
        print(f"[Estático] F1 macro {f1['media']:.3f} ± {f1['desviacion']:.3f} · "
              f"{len(set(grupos))} imágenes fuente · → {info['directorio']}")
    return info


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Evalúa el RF estático con validación agrupada")
    parser.add_argument("--config", default="config/experimentos/estatico_rf.yaml")
    parser.add_argument("--reextraer", action="store_true", help="Ignora la caché de landmarks")
    args = parser.parse_args(argv)
    cfg = cargar_yaml(args.config)
    evaluar_estatico(cfg, forzar_extraccion=args.reextraer)
    evaluate.resumir_todo(cfg["salidas"]["directorio"], cfg["salidas"].get("dpi", 300))
    return 0


if __name__ == "__main__":
    sys.exit(main())
