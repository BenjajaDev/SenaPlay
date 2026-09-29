"""
Formato del modelo dinámico exportado.

    models_saved/dinamico.pt         {"estado": state_dict, "meta": {...}}
    models_saved/dinamico.meta.json  el mismo "meta", legible

El meta lleva todo lo necesario para reconstruir el modelo y su
preprocesamiento sin mirar el código de entrenamiento: arquitectura,
hiperparámetros, clases en orden, T, feature_spec_version y parámetros de
normalización (la FeatureSpec completa).

También sabe cargar el checkpoint legado de scripts/train_model.py
(`data/models/dinamico_tcn.pt`), traduciéndolo a un meta equivalente:
TCN legada + FeatureSpec 1.0.
"""

from __future__ import annotations

import json
import os

FORMATO = "oratiolingo-dinamico/1"


def ruta_meta(ruta_pt: str) -> str:
    return os.path.splitext(ruta_pt)[0] + ".meta.json"


def meta_legado(payload: dict) -> dict:
    from model.tcn import CONFIG_LEGADA
    from preprocessing.spec import FeatureSpec

    spec = FeatureSpec.v1(T=int(payload["longitud_secuencia"]))
    return {
        "formato": "legado",
        "arquitectura": "tcn",
        "hiperparametros": {k: v for k, v in CONFIG_LEGADA.items() if k != "arquitectura"},
        "clases": list(payload["etiquetas"]),
        "T": spec.T,
        "dim_entrada": int(payload.get("entrada", spec.dim_base)),
        "feature_spec_version": spec.version,
        "preprocesamiento": spec.a_config(),
    }


def construir_desde_meta(meta: dict):
    from models.factory import construir_modelo

    cfg = {"arquitectura": meta["arquitectura"], **meta["hiperparametros"]}
    return construir_modelo(cfg, entrada=int(meta["dim_entrada"]), clases=len(meta["clases"]))


def cargar(ruta_pt: str):
    """Devuelve (modelo en modo eval, meta)."""
    import torch

    payload = torch.load(ruta_pt, map_location="cpu", weights_only=False)
    if "meta" in payload:
        meta = payload["meta"]
    elif os.path.exists(ruta_meta(ruta_pt)):
        with open(ruta_meta(ruta_pt), encoding="utf-8") as f:
            meta = json.load(f)
    else:
        meta = meta_legado(payload)
    modelo = construir_desde_meta(meta)
    modelo.load_state_dict(payload["estado"])
    return modelo.eval(), meta


def guardar(modelo, meta: dict, ruta_pt: str) -> None:
    import torch

    meta = {"formato": FORMATO, **meta}
    os.makedirs(os.path.dirname(os.path.abspath(ruta_pt)), exist_ok=True)
    torch.save({"estado": modelo.state_dict(), "meta": meta}, ruta_pt)
    with open(ruta_meta(ruta_pt), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
