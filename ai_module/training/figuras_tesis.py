"""
Figura de la tesis: F1 macro por arquitectura (media ± DE) con cada
entrenamiento (pliegue × semilla) superpuesto como un punto.

Lee summary.csv y metrics_per_fold.csv de la última corrida de cada
arquitectura del experimento. No reemplaza results/comparacion_f1_macro.png
(la genera training/evaluate.py); escribe results/<salida> aparte.

    cd ai_module
    python -m training.figuras_tesis
    python -m training.figuras_tesis --experimento ablacion_sin_aumento --salida f1_sin_aumento.png
"""

from __future__ import annotations

import argparse
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.rutas import relativa, resolver  # noqa: E402
from training.evaluate import (  # noqa: E402
    RAMPA_SECUENCIAL, SUPERFICIE, TINTA, TINTA_SECUNDARIA, _estilo, ultimas_corridas,
)

ORDEN = ["tcn", "lstm", "gru"]


def _coma(valor: float, decimales: int = 1) -> str:
    return f"{valor:.{decimales}f}".replace(".", ",")


def datos_comparacion(dir_resultados: str, experimento: str) -> tuple[pd.DataFrame, dict]:
    """(resumen por arquitectura, F1 macro de cada entrenamiento por arquitectura)."""
    corridas = [c for c in ultimas_corridas(dir_resultados)
                if c["tipo"] == "dinamica" and c["experimento"] == experimento]
    corridas.sort(key=lambda c: ORDEN.index(c["arquitectura"]) if c["arquitectura"] in ORDEN else 99)
    filas, puntos = [], {}
    for c in corridas:
        directorio = os.path.join(dir_resultados, os.path.basename(c["directorio"]))
        resumen = pd.read_csv(os.path.join(directorio, "summary.csv")).set_index("metrica")
        por_pliegue = pd.read_csv(os.path.join(directorio, "metrics_per_fold.csv"))
        nombre = c["arquitectura"].upper()
        filas.append({"arquitectura": nombre,
                      "media": resumen.loc["f1_macro", "media"],
                      "desviacion": resumen.loc["f1_macro", "desviacion"],
                      "n": int(resumen.loc["f1_macro", "n"])})
        puntos[nombre] = por_pliegue["f1_macro"].to_numpy()
    return pd.DataFrame(filas), puntos


def figura_comparacion(resumen: pd.DataFrame, puntos: dict, ruta: str, nota: str,
                       dpi: int = 300) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.ticker import FuncFormatter

    fig, ax = plt.subplots(figsize=(5.2, 3.8), facecolor=SUPERFICIE)
    x = np.arange(len(resumen))
    ax.bar(x, resumen["media"], width=0.6, color=RAMPA_SECUENCIAL[2], zorder=2)
    ax.errorbar(x, resumen["media"], yerr=resumen["desviacion"], fmt="none",
                ecolor=TINTA, elinewidth=1.0, capsize=4, zorder=4)
    rng = np.random.default_rng(0)     # dispersión horizontal fija: la figura es reproducible
    for i, nombre in enumerate(resumen["arquitectura"]):
        valores = puntos[nombre]
        ax.scatter(i + rng.uniform(-0.15, 0.15, len(valores)), valores, s=12,
                   color=RAMPA_SECUENCIAL[5], alpha=0.75, linewidths=0, zorder=3)
    for i, fila in resumen.iterrows():
        ax.text(i + 0.33, fila["media"], f"{_coma(fila['media'], 3)}\n± {_coma(fila['desviacion'], 3)}",
                color=TINTA_SECUNDARIA, fontsize=7.5, va="center", ha="left")

    _estilo(ax)
    ax.set_xticks(x, resumen["arquitectura"])
    ax.set_xlim(-0.6, len(resumen) - 0.15)
    ax.set_ylim(0, 1)
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _p: _coma(v)))
    ax.set_ylabel("F1 macro", color=TINTA_SECUNDARIA, fontsize=9)
    ax.set_title("F1 macro por arquitectura", color=TINTA, fontsize=10, loc="left")
    fig.text(0.01, 0.01, nota, color=TINTA_SECUNDARIA, fontsize=7, ha="left", va="bottom")
    fig.tight_layout(rect=(0, 0.06, 1, 1))
    fig.savefig(ruta, dpi=dpi, facecolor=SUPERFICIE)
    plt.close(fig)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Figura de comparación de arquitecturas para la tesis")
    parser.add_argument("--resultados", default="results")
    parser.add_argument("--experimento", default="comparacion_temporal")
    parser.add_argument("--salida", default="comparacion_f1_macro_tesis.png",
                        help="Nombre del PNG dentro de --resultados")
    parser.add_argument("--dpi", type=int, default=300)
    args = parser.parse_args(argv)

    dir_resultados = resolver(args.resultados)
    resumen, puntos = datos_comparacion(dir_resultados, args.experimento)
    if resumen.empty:
        print(f"[Figuras] No hay corridas dinámicas de '{args.experimento}' en {args.resultados}")
        return 1
    n = int(resumen["n"].iloc[0])
    nota = (f"Barras: media ± DE sobre {n} entrenamientos (pliegue × semilla), validación agrupada "
            "por señante.\nPuntos: F1 macro de cada entrenamiento.")
    ruta = os.path.join(dir_resultados, args.salida)
    figura_comparacion(resumen, puntos, ruta, nota, args.dpi)
    print(f"[Figuras] {relativa(ruta)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
