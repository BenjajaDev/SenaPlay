"""
Selección de la arquitectura y exportación del modelo para el servidor.

Criterio (queda escrito en results/selection.md):
  1. Mayor F1 macro promedio en la validación agrupada del experimento
     principal (comparacion_temporal, kfold).
  2. Las arquitecturas cuya media queda dentro de una desviación estándar
     de la mejor (media ≥ mejor − DE_mejor) se consideran empatadas; entre
     ellas se elige la de menor latencia media.

Después reentrena la elegida con TODOS los videos útiles, reservando un grupo
de signers de validación para la detención temprana, y exporta
models_saved/dinamico.pt + dinamico.meta.json (el anterior se respalda en
models_saved/historial/).

    cd ai_module
    python -m training.select_model                  # seleccionar + exportar
    python -m training.select_model --solo-seleccionar
    python -m training.select_model --arquitectura gru   # forzar una arquitectura
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from datetime import datetime

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.config import resolver_experimento  # noqa: E402
from common.reproducibilidad import commit_actual, fijar_semilla  # noqa: E402
from common.rutas import DIR_MODELOS_GUARDADOS, relativa, resolver  # noqa: E402
from models import checkpoint  # noqa: E402
from models.factory import construir_modelo, contar_parametros, hiperparametros  # noqa: E402
from training import evaluate  # noqa: E402
from training.cv import _separar_validacion  # noqa: E402
from training.datos import DatasetDinamico  # noqa: E402
from training.train import entrenar_modelo, preparar  # noqa: E402

RUTA_MODELO = os.path.join(DIR_MODELOS_GUARDADOS, "dinamico.pt")


def seleccionar(dir_resultados: str, experimento: str = evaluate.EXPERIMENTO_PRINCIPAL,
                esquema: str = "kfold") -> tuple[dict, str]:
    corridas = [c for c in evaluate.ultimas_corridas(resolver(dir_resultados))
                if c["tipo"] == "dinamica" and c["experimento"] == experimento
                and c["esquema"] == esquema]
    if not corridas:
        raise FileNotFoundError(f"No hay corridas de {experimento}/{esquema} en {dir_resultados}. "
                                "Corre primero: python -m training.run_all")
    f1 = {c["arquitectura"]: c["metricas"]["f1_macro"] for c in corridas}
    mejor = max(corridas, key=lambda c: f1[c["arquitectura"]]["media"])
    umbral = f1[mejor["arquitectura"]]["media"] - f1[mejor["arquitectura"]]["desviacion"]
    empatadas = [c for c in corridas if f1[c["arquitectura"]]["media"] >= umbral]
    elegida = min(empatadas, key=lambda c: c["latencia_media_ms"])

    lineas = [
        "# Selección del modelo dinámico", "",
        f"Generado el {datetime.now():%Y-%m-%d %H:%M} a partir de `{relativa(resolver(dir_resultados))}` "
        f"(experimento `{experimento}`, validación `{esquema}`).", "",
        "## Criterio", "",
        "1. Se toma la arquitectura con mayor F1 macro promedio sobre pliegues × semillas.",
        "2. Las arquitecturas cuyo F1 macro medio queda dentro de una desviación estándar de la "
        "mejor (media ≥ media_mejor − DE_mejor) se consideran empatadas.",
        "3. Entre las empatadas se elige la de menor latencia media (CPU, batch 1).", "",
        "## Candidatas", "",
        "| Arquitectura | F1 macro | Latencia media (ms) | Latencia p95 (ms) | Parámetros | Empatada con la mejor |",
        "|---|---:|---:|---:|---:|:---:|",
    ]
    for c in sorted(corridas, key=lambda c: -f1[c["arquitectura"]]["media"]):
        m = f1[c["arquitectura"]]
        lineas.append(f"| {c['arquitectura'].upper()} | {100 * m['media']:.1f} ± {100 * m['desviacion']:.1f} | "
                      f"{c['latencia_media_ms']:.2f} | {c['latencia_p95_ms']:.2f} | {c['parametros']} | "
                      f"{'sí' if c in empatadas else 'no'} |")
    m_mejor = f1[mejor["arquitectura"]]
    lineas += [
        "", "## Resultado", "",
        f"- Mayor F1 macro: **{mejor['arquitectura'].upper()}** "
        f"({100 * m_mejor['media']:.1f} ± {100 * m_mejor['desviacion']:.1f}). "
        f"Umbral de empate: {100 * umbral:.1f}.",
        f"- Empatadas: {', '.join(c['arquitectura'].upper() for c in empatadas)}.",
        f"- **Elegida: {elegida['arquitectura'].upper()}**"
        + (" (menor latencia entre las empatadas)." if len(empatadas) > 1 else "."),
        f"- Corrida de referencia: `{elegida['directorio']}` (commit `{elegida['commit'][:12]}`).", "",
    ]
    return elegida, "\n".join(lineas)


def entrenar_final(cfg: dict, cfg_modelo: dict, datos: DatasetDinamico, semilla: int = 0,
                   estado_inicial: dict | None = None, verbose: bool = True):
    """Reentrena con todos los videos; valida sobre `n_signers_validacion` signers para detenerse."""
    idx = np.arange(len(datos))
    rng_particion = np.random.default_rng(int(cfg["validacion"].get("semilla_particion", 42)))
    idx_ent, idx_val = _separar_validacion(idx, datos.y, datos.grupos,
                                           int(cfg["validacion"]["n_signers_validacion"]),
                                           rng_particion)
    rng = fijar_semilla(semilla)
    modelo = construir_modelo(cfg_modelo, datos.preprocesador.dim_entrada, len(datos.clases))
    if estado_inicial is not None:
        modelo.load_state_dict(estado_inicial)
    r = entrenar_modelo(modelo, datos, idx_ent, idx_val, cfg["entrenamiento"], rng,
                        verbose=verbose)
    return modelo, r, sorted(set(datos.grupos[idx_val]))


def construir_meta(cfg: dict, cfg_modelo: dict, datos: DatasetDinamico, modelo, resultado,
                   signers_val: list[str], semilla: int, extra: dict | None = None) -> dict:
    pre = datos.preprocesador
    return {
        "arquitectura": cfg_modelo["arquitectura"],
        "hiperparametros": hiperparametros(cfg_modelo),
        "clases": list(datos.clases),
        "T": pre.T,
        "dim_entrada": pre.dim_entrada,
        "feature_spec_version": pre.spec.version,
        "preprocesamiento": pre.spec.a_config(),
        "parametros": contar_parametros(modelo),
        "entrenamiento": {
            "fecha": datetime.now().isoformat(timespec="seconds"),
            "commit": commit_actual(),
            "experimento": cfg.get("nombre"),
            "semilla": semilla,
            "epoca_mejor": resultado.epoca_mejor,
            "epocas": resultado.epocas,
            "f1_validacion": resultado.f1_val_mejor,
            "n_videos": len(datos),
            "signers": sorted(set(datos.grupos)),
            "signers_validacion": signers_val,
            "lotes": sorted(datos.filas["batch_id"].astype(str).unique()),
            "protocolo": {k: v for k, v in cfg["entrenamiento"].items() if k != "semillas"},
            "aumento": cfg.get("aumento"),
        },
        **(extra or {}),
    }


def respaldar(ruta_pt: str) -> str | None:
    if not os.path.exists(ruta_pt):
        return None
    dir_hist = os.path.join(os.path.dirname(ruta_pt), "historial")
    os.makedirs(dir_hist, exist_ok=True)
    sello = f"{datetime.now():%Y%m%d-%H%M%S}"
    destino = os.path.join(dir_hist, f"dinamico_{sello}.pt")
    shutil.copy2(ruta_pt, destino)
    if os.path.exists(checkpoint.ruta_meta(ruta_pt)):
        shutil.copy2(checkpoint.ruta_meta(ruta_pt), checkpoint.ruta_meta(destino))
    return destino


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Selecciona y exporta el modelo dinámico")
    parser.add_argument("--experimento", default="config/experimentos/comparacion_temporal.yaml")
    parser.add_argument("--arquitectura", default=None, help="Omite la selección y usa esta")
    parser.add_argument("--solo-seleccionar", action="store_true")
    parser.add_argument("--salida", default=RUTA_MODELO)
    parser.add_argument("--semilla", type=int, default=0)
    args = parser.parse_args(argv)

    cfg = resolver_experimento(args.experimento)
    dir_resultados = resolver(cfg["salidas"]["directorio"])
    extra = {}
    if args.arquitectura:
        arquitectura = args.arquitectura
        extra["seleccion"] = {"criterio": "forzada por línea de comandos"}
    else:
        elegida, texto = seleccionar(dir_resultados, cfg.get("nombre", evaluate.EXPERIMENTO_PRINCIPAL))
        with open(os.path.join(dir_resultados, "selection.md"), "w", encoding="utf-8") as f:
            f.write(texto)
        print(texto)
        arquitectura = elegida["arquitectura"]
        extra["seleccion"] = {"criterio": "mayor F1 macro; empate dentro de 1 DE → menor latencia",
                              "corrida": elegida["directorio"],
                              "f1_macro_cv": elegida["metricas"]["f1_macro"]}
        # add_batch compara contra esta corrida (el "antes")
        extra["evaluacion_cv"] = {"corrida": elegida["directorio"],
                                  "f1_macro_cv": elegida["metricas"]["f1_macro"]}
    if args.solo_seleccionar:
        return 0

    modelos = {m["arquitectura"]: m for m in cfg["modelos"]}
    cfg_modelo = modelos[arquitectura]
    _, datos = preparar(cfg)
    print(f"[Exportación] Reentrenando {arquitectura.upper()} con {len(datos)} videos "
          f"de {len(set(datos.grupos))} signers…")
    modelo, r, signers_val = entrenar_final(cfg, cfg_modelo, datos, semilla=args.semilla)
    meta = construir_meta(cfg, cfg_modelo, datos, modelo, r, signers_val, args.semilla, extra)
    respaldo = respaldar(args.salida)
    checkpoint.guardar(modelo, meta, args.salida)
    print(f"[Exportación] {relativa(args.salida)} y {relativa(checkpoint.ruta_meta(args.salida))} "
          f"(mejor época {r.epoca_mejor}, F1 val {r.f1_val_mejor:.3f})"
          + (f"; anterior respaldado en {relativa(respaldo)}" if respaldo else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
