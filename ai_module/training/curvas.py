"""
Curvas de entrenamiento a partir de historial.csv: pérdida (entrenamiento y
validación) y F1 macro de validación por época.

Una figura por corrida, results/<corrida>/curvas_entrenamiento.png. Cada
línea delgada es un entrenamiento (pliegue × semilla); la gruesa es la media
de los entrenamientos que siguen activos en esa época, y se dibuja mientras
sigan al menos la mitad (la detención temprana corta cada uno en una época
distinta, y una media de pocos entrenamientos sería engañosa).

    cd ai_module
    python -m training.curvas                          # últimas corridas dinámicas de results/
    python -m training.curvas --corrida results/<fecha>_<arquitectura>
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
    SERIE_1, SUPERFICIE, TINTA, TINTA_SECUNDARIA, TINTA_TENUE, _estilo, ultimas_corridas,
)

ARCHIVO = "curvas_entrenamiento.png"


def _coma(valor: float, _pos=None) -> str:
    """Formato de eje con coma decimal (2,5 en vez de 2.5)."""
    return f"{valor:g}".replace(".", ",")


def _media_activa(historial: pd.DataFrame, columna: str) -> pd.Series:
    """Media por época de los entrenamientos activos, mientras sigan al menos la mitad."""
    n_total = historial.groupby(["pliegue", "semilla"]).ngroups
    por_epoca = historial.groupby("epoca")[columna].agg(["mean", "count"])
    return por_epoca.loc[por_epoca["count"] >= n_total / 2, "mean"]


def figura_curvas(historial: pd.DataFrame, ruta: str, titulo: str, dpi: int) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.ticker import FuncFormatter, MaxNLocator

    fig, (ax_p, ax_f) = plt.subplots(1, 2, figsize=(8.0, 3.2), facecolor=SUPERFICIE)
    series = (
        (ax_p, "perdida_ent", TINTA_TENUE, "Entrenamiento"),
        (ax_p, "perdida_val", SERIE_1, "Validación"),
        (ax_f, "f1_val", SERIE_1, "Validación"),
    )
    for ax, columna, color, etiqueta in series:
        for _, g in historial.groupby(["pliegue", "semilla"]):
            ax.plot(g["epoca"], g[columna], color=color, linewidth=0.6, alpha=0.25)
        media = _media_activa(historial, columna)
        ax.plot(media.index, media.values, color=color, linewidth=1.8, label=etiqueta)

    _estilo(ax_p)
    ax_p.set_title("Pérdida", color=TINTA, fontsize=10, loc="left")
    ax_p.set_ylabel("Entropía cruzada", color=TINTA_SECUNDARIA, fontsize=9)
    ax_p.legend(frameon=False, fontsize=8, labelcolor=TINTA_SECUNDARIA)

    _estilo(ax_f)
    ax_f.set_title("F1 macro de validación", color=TINTA, fontsize=10, loc="left")
    ax_f.set_ylabel("F1 macro", color=TINTA_SECUNDARIA, fontsize=9)
    ax_f.set_ylim(0, 1.02)

    for ax in (ax_p, ax_f):
        ax.set_xlabel("Época", color=TINTA_SECUNDARIA, fontsize=9)
        ax.xaxis.set_major_locator(MaxNLocator(integer=True))
        ax.yaxis.set_major_formatter(FuncFormatter(_coma))

    n = historial.groupby(["pliegue", "semilla"]).ngroups
    fig.suptitle(titulo, color=TINTA, fontsize=10, x=0.01, ha="left")
    fig.text(0.01, 0.005, f"Líneas delgadas: cada uno de los {n} entrenamientos (pliegue × semilla). "
             "Línea gruesa: media mientras sigue al menos la mitad.",
             color=TINTA_SECUNDARIA, fontsize=7, ha="left", va="bottom")
    fig.tight_layout(rect=(0, 0.05, 1, 0.95))
    fig.savefig(ruta, dpi=dpi, facecolor=SUPERFICIE)
    plt.close(fig)


def curvas_de_corrida(directorio: str, dpi: int = 300) -> str:
    historial = pd.read_csv(os.path.join(directorio, "historial.csv"))
    arquitectura = os.path.basename(directorio).split("_")[1].upper()
    ruta = os.path.join(directorio, ARCHIVO)
    figura_curvas(historial, ruta, f"Curvas de entrenamiento · {arquitectura}", dpi)
    return ruta


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Curvas de entrenamiento desde historial.csv")
    parser.add_argument("--resultados", default="results")
    parser.add_argument("--corrida", nargs="*", default=None,
                        help="Carpetas de corrida; por defecto, las últimas corridas dinámicas")
    parser.add_argument("--dpi", type=int, default=300)
    args = parser.parse_args(argv)

    if args.corrida:
        directorios = [resolver(c) for c in args.corrida]
    else:
        dir_resultados = resolver(args.resultados)
        directorios = [os.path.join(dir_resultados, os.path.basename(c["directorio"]))
                       for c in ultimas_corridas(dir_resultados) if c["tipo"] == "dinamica"]
    if not directorios:
        print(f"[Curvas] No hay corridas dinámicas en {args.resultados}")
        return 1
    for d in sorted(directorios):
        print(f"[Curvas] {relativa(curvas_de_corrida(d, args.dpi))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
