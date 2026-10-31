"""
Protocolo de entrenamiento común a las tres arquitecturas.

  - AdamW, mismo máximo de épocas y mismo batch.
  - Detención temprana por F1 macro de validación (paciencia configurable);
    se restauran los pesos de la mejor época.
  - Tres semillas por pliegue (0, 1 y 2): la semilla fija la inicialización,
    el orden de los lotes y el aumento de datos. Las particiones no dependen
    de la semilla (ver training/cv.py).
  - Pesos por clase (inverso de la frecuencia en el entrenamiento del
    pliegue) si el desbalance supera `umbral_desbalance`.
  - Aumento de datos solo en la partición de entrenamiento, en línea.

    cd ai_module
    python -m training.train --arquitectura tcn            # una arquitectura
    python -m training.train --arquitectura lstm --loso
    python -m training.run_all                             # las tres + resumen
"""

from __future__ import annotations

import argparse
import copy
import os
import sys
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import torch  # noqa: E402
import torch.nn as nn  # noqa: E402
from sklearn.metrics import f1_score  # noqa: E402

from common.config import fusionar, resolver_experimento  # noqa: E402
from common.reproducibilidad import fijar_semilla  # noqa: E402
from common.rutas import resolver  # noqa: E402
from models.factory import construir_modelo, contar_parametros  # noqa: E402
from preprocessing.pipeline import Preprocesador  # noqa: E402
from training import evaluate  # noqa: E402
from training.cv import esquema_de, generar_particiones, guardar_particiones  # noqa: E402
from training.datos import DatasetDinamico, cargar_dataset  # noqa: E402


@dataclass
class ResultadoEntrenamiento:
    estado: dict
    epoca_mejor: int
    f1_val_mejor: float
    epocas: int
    historial: list[dict] = field(default_factory=list)


def pesos_de_clase(y: np.ndarray, n_clases: int, cfg: dict) -> torch.Tensor | None:
    modo = cfg.get("pesos_clase", "auto")
    conteo = np.bincount(y, minlength=n_clases).astype(float)
    if modo == "nunca":
        return None
    desbalance = conteo.max() / max(conteo[conteo > 0].min(), 1)
    if modo == "auto" and desbalance <= cfg.get("umbral_desbalance", 1.5):
        return None
    pesos = np.where(conteo > 0, conteo.sum() / (n_clases * np.maximum(conteo, 1)), 0.0)
    return torch.tensor(pesos, dtype=torch.float32)


def crear_optimizador(modelo: nn.Module, cfg_opt: dict) -> torch.optim.Optimizer:
    nombre = cfg_opt.get("nombre", "adamw").lower()
    if nombre != "adamw":
        raise ValueError(f"Optimizador no soportado: {nombre} (el protocolo usa AdamW)")
    return torch.optim.AdamW(modelo.parameters(), lr=cfg_opt["lr"],
                             weight_decay=cfg_opt.get("weight_decay", 0.01))


@torch.no_grad()
def predecir(modelo: nn.Module, X: torch.Tensor, batch: int = 256) -> torch.Tensor:
    modelo.eval()
    return torch.cat([modelo(X[i:i + batch]) for i in range(0, len(X), batch)])


def entrenar_modelo(modelo: nn.Module, datos: DatasetDinamico, idx_ent: np.ndarray,
                    idx_val: np.ndarray, cfg_ent: dict, rng: np.random.Generator,
                    X_val: torch.Tensor | None = None, verbose: bool = False
                    ) -> ResultadoEntrenamiento:
    """Entrena con detención temprana y devuelve el estado de la mejor época."""
    X_val = X_val if X_val is not None else datos.lote(idx_val)
    y_val = datos.y[idx_val]
    pesos = pesos_de_clase(datos.y[idx_ent], len(datos.clases), cfg_ent)
    criterio = nn.CrossEntropyLoss(weight=pesos)
    optimizador = crear_optimizador(modelo, cfg_ent["optimizador"])
    batch, paciencia = int(cfg_ent["batch_size"]), int(cfg_ent["paciencia"])
    clip = cfg_ent.get("clip_grad")

    mejor = ResultadoEntrenamiento(copy.deepcopy(modelo.state_dict()), 0, -1.0, 0)
    sin_mejora = 0
    for epoca in range(1, int(cfg_ent["max_epocas"]) + 1):
        modelo.train()
        orden = rng.permutation(idx_ent)
        perdida_total = 0.0
        for i in range(0, len(orden), batch):
            lote = orden[i:i + batch]
            if len(lote) < 2:          # BatchNorm necesita más de una muestra
                continue
            X, y = datos.lote(lote, rng, entrenar=True), datos.etiquetas(lote)
            optimizador.zero_grad()
            perdida = criterio(modelo(X), y)
            perdida.backward()
            if clip:
                nn.utils.clip_grad_norm_(modelo.parameters(), max_norm=clip)
            optimizador.step()
            perdida_total += perdida.item() * len(lote)

        logits = predecir(modelo, X_val)
        perdida_val = criterio(logits, torch.from_numpy(y_val).long()).item()
        f1_val = f1_score(y_val, logits.argmax(1).numpy(), average="macro",
                          labels=list(range(len(datos.clases))), zero_division=0)
        mejor.historial.append({"epoca": epoca, "perdida_ent": perdida_total / len(orden),
                                "perdida_val": perdida_val, "f1_val": f1_val})
        mejor.epocas = epoca
        if f1_val > mejor.f1_val_mejor:
            mejor.estado = copy.deepcopy(modelo.state_dict())
            mejor.epoca_mejor, mejor.f1_val_mejor = epoca, f1_val
            sin_mejora = 0
        else:
            sin_mejora += 1
        if verbose and (epoca % 10 == 0 or sin_mejora == 0):
            print(f"      época {epoca:3d} | pérdida {perdida_total / len(orden):.4f} | "
                  f"val {perdida_val:.4f} | F1 val {f1_val:.3f}")
        if sin_mejora >= paciencia:
            break

    modelo.load_state_dict(mejor.estado)
    return mejor


def preparar(cfg: dict) -> tuple[Preprocesador, DatasetDinamico]:
    pre = Preprocesador.desde_config(cfg["preprocesamiento"], cfg.get("aumento"))
    return pre, cargar_dataset(cfg, pre)


def correr_arquitectura(cfg: dict, cfg_modelo: dict, datos: DatasetDinamico,
                        loso: bool = False, verbose: bool = True) -> dict:
    """Validación cruzada completa (pliegues × semillas) de una arquitectura."""
    esquema = esquema_de(cfg["validacion"], loso)
    arq = cfg_modelo["arquitectura"]
    particiones = generar_particiones(datos.y, datos.grupos, cfg["validacion"], loso=loso)
    cfg_ent = cfg["entrenamiento"]
    if cfg_ent.get("hilos_torch"):
        torch.set_num_threads(int(cfg_ent["hilos_torch"]))

    directorio = os.path.join(resolver(cfg["salidas"]["directorio"]),
                              evaluate.nombre_corrida(arq, cfg.get("nombre", "comparacion_temporal"),
                                                      esquema))
    base, n = directorio, 2
    while os.path.exists(directorio):          # dos corridas en el mismo segundo
        directorio, n = f"{base}-{n}", n + 1
    os.makedirs(directorio)
    guardar_particiones(particiones, datos.grupos, datos.filas["video_path"],
                        os.path.join(directorio, "particiones.json"))

    predicciones, historial, entrenamiento = [], [], []
    for p in particiones:
        X_val, X_prueba = datos.lote(p.validacion), datos.lote(p.prueba)
        for semilla in cfg_ent["semillas"]:
            rng = fijar_semilla(int(semilla))
            modelo = construir_modelo(cfg_modelo, datos.preprocesador.dim_entrada, len(datos.clases))
            if verbose:
                print(f"  [{arq}] pliegue {p.pliegue} · semilla {semilla} "
                      f"({len(p.entrenamiento)}/{len(p.validacion)}/{len(p.prueba)} videos)")
            r = entrenar_modelo(modelo, datos, p.entrenamiento, p.validacion, cfg_ent, rng, X_val)
            probs = torch.softmax(predecir(modelo, X_prueba), dim=1).numpy()
            filas = datos.filas.iloc[p.prueba]
            predicciones.append(pd.DataFrame({
                "pliegue": p.pliegue, "semilla": semilla,
                "video_path": filas["video_path"].to_numpy(),
                "signer_id": filas["signer_id"].astype(str).to_numpy(),
                "clase_real": filas["sign_class"].to_numpy(),
                "clase_predicha": [datos.clases[i] for i in probs.argmax(1)],
                "y_true": datos.y[p.prueba], "y_pred": probs.argmax(1),
                "confianza": probs.max(1),
            }))
            historial += [{"pliegue": p.pliegue, "semilla": semilla, **h} for h in r.historial]
            entrenamiento.append({"pliegue": p.pliegue, "semilla": semilla,
                                  "epoca_mejor": r.epoca_mejor, "epocas": r.epocas,
                                  "f1_validacion": r.f1_val_mejor,
                                  "n_entrenamiento": len(p.entrenamiento),
                                  "n_validacion": len(p.validacion), "n_prueba": len(p.prueba)})
            if verbose:
                print(f"      mejor época {r.epoca_mejor}/{r.epocas} · F1 val {r.f1_val_mejor:.3f}")

    modelo = construir_modelo(cfg_modelo, datos.preprocesador.dim_entrada, len(datos.clases))
    latencia = evaluate.latencia_modelo(modelo, datos.preprocesador.T,
                                        datos.preprocesador.dim_entrada, cfg["latencia"])
    cfg_corrida = fusionar(cfg, {"validacion": {"esquema": esquema}})
    cfg_corrida["modelos"] = [cfg_modelo]
    info = evaluate.escribir_corrida(
        directorio, cfg=cfg_corrida, arquitectura=arq, esquema=esquema, clases=datos.clases,
        predicciones=pd.concat(predicciones, ignore_index=True),
        historial=pd.DataFrame(historial), entrenamiento=pd.DataFrame(entrenamiento),
        latencia=latencia, parametros=contar_parametros(modelo),
        n_videos=len(datos), n_signers=len(set(datos.grupos)),
    )
    if verbose:
        f1 = info["metricas"]["f1_macro"]
        print(f"  [{arq}] F1 macro {f1['media']:.3f} ± {f1['desviacion']:.3f} · "
              f"latencia {latencia['media_ms']:.2f} ms · → {info['directorio']}")
    return info


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Entrena y evalúa una arquitectura temporal")
    parser.add_argument("--experimento", default="config/experimentos/comparacion_temporal.yaml")
    parser.add_argument("--arquitectura", required=True, help="tcn | lstm | gru")
    parser.add_argument("--loso", action="store_true", help="Leave-One-Signer-Out")
    parser.add_argument("--sin-resumen", action="store_true", help="No regenerar summary_all")
    args = parser.parse_args(argv)

    cfg = resolver_experimento(args.experimento)
    modelos = {m["arquitectura"]: m for m in cfg["modelos"]}
    if args.arquitectura not in modelos:
        parser.error(f"{args.arquitectura!r} no está en el experimento: {sorted(modelos)}")
    _, datos = preparar(cfg)
    print(f"[Entrenamiento] {len(datos)} videos · {len(set(datos.grupos))} signers · "
          f"clases {datos.clases} · entrada [B, {datos.preprocesador.T}, "
          f"{datos.preprocesador.dim_entrada}]")
    correr_arquitectura(cfg, modelos[args.arquitectura], datos, loso=args.loso)
    if not args.sin_resumen:
        evaluate.resumir_todo(cfg["salidas"]["directorio"], cfg["salidas"].get("dpi", 300))
    return 0


if __name__ == "__main__":
    sys.exit(main())
