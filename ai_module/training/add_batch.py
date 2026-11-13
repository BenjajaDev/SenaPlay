"""
Incorporación de un lote nuevo de grabaciones.

    cd ai_module
    # 1. Copia los videos nuevos a data/raw_videos/<clase>/ (misma convención de nombres)
    # 2. Corre:
    python -m training.add_batch --batch-id lote_01

Pasos:
  1. Extrae los landmarks de los videos nuevos y los agrega al manifiesto
     con su batch_id (data/manifest.py).
  2. Evalúa la arquitectura del modelo actual (models_saved/dinamico.pt) con
     la misma validación agrupada, sobre TODO el dataset acumulado.
     Cada pliegue entrena DESDE CERO: el modelo anterior ya vio a todos los
     signers antiguos, así que partir de sus pesos filtraría los signers de
     prueba al entrenamiento y inflaría las métricas.
  3. Reentrena el modelo final con todo el dataset partiendo de los pesos
     del modelo anterior (warm start). Si cambian las clases, solo se
     reinicializa la capa de salida. Exporta y respalda el anterior.
  4. Escribe results/batches/<batch_id>.md con la comparación antes/después
     por clase, destacando las que más cambiaron.

No hay replay buffer: con este volumen de datos, reentrenar con todo es más
barato y equivalente.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.config import cargar_yaml, fusionar, resolver_experimento  # noqa: E402
from common.rutas import relativa, resolver  # noqa: E402
from models import checkpoint  # noqa: E402
from models.factory import construir_modelo  # noqa: E402
from training.select_model import (  # noqa: E402
    RUTA_MODELO, construir_meta, entrenar_final, respaldar,
)
from training.train import correr_arquitectura, preparar  # noqa: E402

N_DESTACADAS = 3


def estado_warm_start(modelo_previo, meta_previo: dict, cfg_modelo: dict, dim_entrada: int,
                      clases: list[str]) -> tuple[dict, str]:
    """
    Pesos iniciales para el modelo nuevo. Si las clases son las mismas y en el
    mismo orden se copian todos; si no, se copian todos menos la capa de salida.
    """
    if int(meta_previo["dim_entrada"]) != dim_entrada:
        raise ValueError("El modelo anterior usa otra dimensión de entrada; no se puede hacer "
                         "warm start (¿cambió features.yaml?). Usa training.select_model.")
    nuevo = construir_modelo(cfg_modelo, dim_entrada, len(clases))
    estado = modelo_previo.state_dict()
    if list(meta_previo["clases"]) == list(clases):
        return estado, "pesos completos del modelo anterior"
    salida = [n for n, _ in nuevo.named_parameters() if n.startswith("clasificador.")][-2:]
    estado = {k: v for k, v in estado.items() if k not in salida}
    estado.update({k: v for k, v in nuevo.state_dict().items() if k in salida})
    return estado, (f"pesos del modelo anterior salvo la capa de salida ({', '.join(salida)}), "
                    "reinicializada porque cambiaron las clases")


def f1_por_clase(dir_corrida: str | None) -> pd.DataFrame:
    """Media y desviación del F1 por clase de una corrida (vacío si no existe)."""
    if not dir_corrida or not os.path.exists(os.path.join(resolver(dir_corrida), "summary.csv")):
        return pd.DataFrame(columns=["clase", "media", "desviacion"])
    s = pd.read_csv(os.path.join(resolver(dir_corrida), "summary.csv"))
    s = s[s["metrica"].str.startswith("f1_") & (s["metrica"] != "f1_macro")].copy()
    s["clase"] = s["metrica"].str.removeprefix("f1_")
    return s[["clase", "media", "desviacion"]]


def informe_lote(batch_id: str, antes: dict | None, despues: dict, nuevas: pd.DataFrame,
                 detalle_warm: str, meta_final: dict) -> str:
    fa = f1_por_clase(antes["directorio"] if antes else None).set_index("clase")
    fd = f1_por_clase(despues["directorio"]).set_index("clase")
    tabla = fd.join(fa, lsuffix="_despues", rsuffix="_antes", how="outer")
    tabla["cambio"] = tabla["media_despues"] - tabla["media_antes"]
    tabla = tabla.reindex(tabla["cambio"].abs().sort_values(ascending=False).index)
    cambios = tabla["cambio"].dropna().abs()
    destacadas = set(cambios[cambios > 1e-9].nlargest(N_DESTACADAS).index)

    def pct(v):
        return "—" if pd.isna(v) else f"{100 * v:.1f}"

    lineas = [
        f"# Lote `{batch_id}`", "",
        f"Generado el {datetime.now():%Y-%m-%d %H:%M}.", "",
        "## Videos nuevos", "",
        f"{len(nuevas)} videos agregados al manifiesto con `batch_id = {batch_id}` "
        f"({(nuevas['status'] == 'ok').sum() if len(nuevas) else 0} útiles).", "",
    ]
    if len(nuevas):
        conteo = nuevas[nuevas["status"] == "ok"].groupby("sign_class").size()
        lineas += ["| Clase | Videos útiles nuevos |", "|---|---:|"]
        lineas += [f"| {c} | {n} |" for c, n in conteo.items()] + [""]

    fm = lambda r: (f"{100 * r['metricas']['f1_macro']['media']:.1f} ± "  # noqa: E731
                    f"{100 * r['metricas']['f1_macro']['desviacion']:.1f}")
    lineas += [
        "## Validación agrupada antes y después", "",
        f"Arquitectura: **{despues['arquitectura'].upper()}**. Cada pliegue entrena desde cero "
        "(sin warm start) para que ningún signer de prueba haya sido visto por el modelo.", "",
        "| | Antes | Después |", "|---|---:|---:|",
        f"| Corrida | `{antes['directorio'] if antes else '—'}` | `{despues['directorio']}` |",
        f"| Videos | {antes['n_videos'] if antes else '—'} | {despues['n_videos']} |",
        f"| Signers | {antes['n_grupos'] if antes else '—'} | {despues['n_grupos']} |",
        f"| F1 macro | {fm(antes) if antes else '—'} | {fm(despues)} |", "",
        "Nota: los conjuntos de prueba no son idénticos (el lote agrega signers y videos), así "
        "que la diferencia mezcla el efecto de los datos nuevos con el de evaluar sobre más signers.", "",
        "## F1 por clase", "",
        f"Ordenadas por magnitud del cambio; en **negrita** las (hasta {N_DESTACADAS}) que más "
        "cambiaron.", "",
        "| Clase | F1 antes | F1 después | Cambio (pp) |", "|---|---:|---:|---:|",
    ]
    for clase, r in tabla.iterrows():
        cambio = "nueva" if pd.isna(r["media_antes"]) else f"{100 * r['cambio']:+.1f}"
        nombre = f"**{clase}**" if clase in destacadas else clase
        lineas.append(f"| {nombre} | {pct(r['media_antes'])} | {pct(r['media_despues'])} | {cambio} |")
    ent = meta_final["entrenamiento"]
    lineas += [
        "", "## Modelo exportado", "",
        f"- Warm start: {detalle_warm}.",
        f"- Mejor época {ent['epoca_mejor']} de {ent['epocas']}, F1 de validación "
        f"{ent['f1_validacion']:.3f} (signers de validación: {', '.join(ent['signers_validacion'])}).",
        f"- Lotes incluidos: {', '.join(ent['lotes'])}.", "",
    ]
    return "\n".join(lineas)


def agregar_lote(batch_id: str, experimento: str, ruta_modelo: str = RUTA_MODELO,
                 extraer: bool = True, verbose: bool = True) -> str:
    from data.manifest import generar_manifiesto, resumen

    cfg = resolver_experimento(experimento)
    cfg_manifiesto = cargar_yaml(cfg["datos"]["config_manifiesto"])

    # 1. Manifiesto
    if extraer:
        df = generar_manifiesto(cfg_manifiesto, batch_id=batch_id, verbose=verbose)
        if verbose:
            print(resumen(df))
    else:
        df = pd.read_csv(resolver(cfg["datos"]["manifiesto"]), dtype=str)
    nuevas = df[df["batch_id"].astype(str) == batch_id]
    if nuevas.empty:
        raise ValueError(f"Ningún video del manifiesto tiene batch_id {batch_id!r}: ¿copiaste los "
                         "videos nuevos a data/raw_videos/?")

    # 2. Modelo anterior y su arquitectura
    if not os.path.exists(ruta_modelo):
        raise FileNotFoundError(f"No existe {relativa(ruta_modelo)}. Corre primero: "
                                "python -m training.select_model")
    modelo_previo, meta_previo = checkpoint.cargar(ruta_modelo)
    cfg_modelo = {"arquitectura": meta_previo["arquitectura"], **meta_previo["hiperparametros"]}
    cfg = fusionar(cfg, {"nombre": f"{cfg.get('nombre', 'experimento')}_{batch_id}",
                         "preprocesamiento": meta_previo["preprocesamiento"]})
    cfg["modelos"] = [cfg_modelo]

    corrida_previa = (meta_previo.get("evaluacion_cv") or meta_previo.get("seleccion") or {}).get("corrida")
    antes = None
    if corrida_previa and os.path.exists(os.path.join(resolver(corrida_previa), "resumen_corrida.json")):
        import json
        with open(os.path.join(resolver(corrida_previa), "resumen_corrida.json"), encoding="utf-8") as f:
            antes = json.load(f)

    _, datos = preparar(cfg)
    if verbose:
        print(f"[Lote {batch_id}] Validación agrupada de {cfg_modelo['arquitectura'].upper()} sobre "
              f"{len(datos)} videos · {len(set(datos.grupos))} signers")
    despues = correr_arquitectura(cfg, cfg_modelo, datos, verbose=verbose)

    # 3. Modelo final con warm start
    estado, detalle = estado_warm_start(modelo_previo, meta_previo, cfg_modelo,
                                        datos.preprocesador.dim_entrada, datos.clases)
    modelo, r, signers_val = entrenar_final(cfg, cfg_modelo, datos, estado_inicial=estado,
                                            verbose=verbose)
    meta = construir_meta(cfg, cfg_modelo, datos, modelo, r, signers_val, semilla=0, extra={
        "seleccion": meta_previo.get("seleccion"),
        "evaluacion_cv": {"corrida": despues["directorio"],
                          "f1_macro_cv": despues["metricas"]["f1_macro"]},
        "lote": {"batch_id": batch_id, "warm_start": detalle,
                 "modelo_previo": meta_previo.get("entrenamiento", {}).get("fecha")},
    })
    respaldo = respaldar(ruta_modelo)
    checkpoint.guardar(modelo, meta, ruta_modelo)

    # 4. Informe
    dir_lotes = os.path.join(resolver(cfg["salidas"]["directorio"]), "batches")
    os.makedirs(dir_lotes, exist_ok=True)
    ruta_informe = os.path.join(dir_lotes, f"{batch_id}.md")
    with open(ruta_informe, "w", encoding="utf-8") as f:
        f.write(informe_lote(batch_id, antes, despues, nuevas, detalle, meta))
    if verbose:
        print(f"[Lote {batch_id}] Modelo exportado en {relativa(ruta_modelo)}"
              + (f" (anterior en {relativa(respaldo)})" if respaldo else ""))
        print(f"[Lote {batch_id}] Informe: {relativa(ruta_informe)}")
    return ruta_informe


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Incorpora un lote nuevo de grabaciones")
    parser.add_argument("--batch-id", required=True)
    parser.add_argument("--experimento", default="config/experimentos/comparacion_temporal.yaml")
    parser.add_argument("--modelo", default=RUTA_MODELO)
    parser.add_argument("--sin-extraccion", action="store_true",
                        help="No correr el manifiesto (los videos del lote ya están en él)")
    args = parser.parse_args(argv)
    agregar_lote(args.batch_id, args.experimento, resolver(args.modelo),
                 extraer=not args.sin_extraccion)
    return 0


if __name__ == "__main__":
    sys.exit(main())
