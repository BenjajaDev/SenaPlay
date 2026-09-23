"""
Genera un PNG con las métricas de un entrenamiento de `train_model.py`:
curvas de loss/accuracy/F1 (parseadas del log de consola) + matriz de
confusión y tabla de precisión/recall/F1 por seña (recalculadas desde el
checkpoint sobre el mismo split de test, determinista vía la semilla de
dataset_config.yaml).

Uso:
    cd ai_module
    python scripts/visualize_results.py --log ruta/al/log.txt
    python scripts/visualize_results.py  # sin --log, omite las curvas
"""

import argparse
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch
from sklearn.metrics import classification_report, confusion_matrix

from model.tcn import ModeloTCN
from scripts.dataset_config_utils import DIR_MODELOS, DIR_PROCESSED_LANDMARKS, cargar_config, señas_activas
from scripts.train_model import _preparar_tensores, cargar_dataset, dividir_dataset

# ── Paleta (dataviz skill, modo claro) ────────────────────────────────────────
SURFACE = "#fcfcfb"
INK_PRIMARIO = "#0b0b0b"
INK_SECUNDARIO = "#52514e"
INK_MUTED = "#898781"
GRID = "#e1e0d9"
EJE = "#c3c2b7"
AZUL, NARANJA, AQUA, AMARILLO = "#2a78d6", "#eb6834", "#1baf7a", "#eda100"
RAMPA_SECUENCIAL = ["#cde2fb", "#9ec5f4", "#5598e7", "#2a78d6", "#184f95"]


def _parsear_log(ruta_log: str):
    patron = re.compile(
        r"Época\s+(\d+)/\d+ \| Loss train: ([\d.]+) \| Loss val: ([\d.]+) "
        r"\| Val Acc: ([\d.]+) \| Val F1: ([\d.]+)"
    )
    epocas, loss_train, loss_val, acc_val, f1_val = [], [], [], [], []
    with open(ruta_log, encoding="utf-8", errors="ignore") as f:
        for linea in f:
            m = patron.search(linea)
            if m:
                epocas.append(int(m.group(1)))
                loss_train.append(float(m.group(2)))
                loss_val.append(float(m.group(3)))
                acc_val.append(float(m.group(4)))
                f1_val.append(float(m.group(5)))
    return epocas, loss_train, loss_val, acc_val, f1_val


def _estilo_panel(ax):
    ax.set_facecolor(SURFACE)
    for lado in ("top", "right"):
        ax.spines[lado].set_visible(False)
    for lado in ("left", "bottom"):
        ax.spines[lado].set_color(EJE)
    ax.tick_params(colors=INK_MUTED, labelsize=9)
    ax.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)


def main():
    parser = argparse.ArgumentParser(description="Genera imagen de métricas del entrenamiento TCN")
    parser.add_argument("--log", default=None, help="Ruta al log de consola de train_model.py (opcional)")
    parser.add_argument("--checkpoint", default=None, help="Por defecto: data/models/dinamico_tcn.pt")
    parser.add_argument("--salida", default=None, help="Por defecto: data/models/training_report.png")
    args = parser.parse_args()

    ruta_checkpoint = args.checkpoint or os.path.join(DIR_MODELOS, "dinamico_tcn.pt")
    ruta_salida = args.salida or os.path.join(DIR_MODELOS, "training_report.png")

    checkpoint = torch.load(ruta_checkpoint, map_location="cpu")
    etiquetas = checkpoint["etiquetas"]
    longitud_secuencia = checkpoint["longitud_secuencia"]

    config = cargar_config()
    señas = señas_activas(config) or etiquetas
    secuencias, etiquetas_idx, signantes, etiquetas_cargadas = cargar_dataset(
        DIR_PROCESSED_LANDMARKS, señas, longitud_secuencia,
    )
    assert etiquetas_cargadas == sorted(etiquetas), "El dataset actual no coincide con el checkpoint"

    ratios = (config["entrenamiento"]["split_train"], config["entrenamiento"]["split_val"],
              config["entrenamiento"]["split_test"])
    _, _, idx_test = dividir_dataset(etiquetas_idx, signantes, ratios, config["entrenamiento"]["semilla"])
    X_test, y_test = _preparar_tensores(secuencias, etiquetas_idx, idx_test, augmentar=False,
                                         variaciones=0, config_aug=config["augmentacion"])

    modelo = ModeloTCN(entrada=checkpoint["entrada"], clases=len(etiquetas))
    modelo.load_state_dict(checkpoint["estado"])
    modelo.eval()
    with torch.no_grad():
        pred_test = modelo(X_test).argmax(dim=-1).numpy()
    y_test = y_test.numpy()

    matriz_confusion = confusion_matrix(y_test, pred_test, labels=range(len(etiquetas)))
    reporte = classification_report(y_test, pred_test, target_names=etiquetas,
                                     output_dict=True, zero_division=0)

    curvas = _parsear_log(args.log) if args.log else None

    fig = plt.figure(figsize=(13, 9.5) if curvas else (10.5, 6.5), facecolor=SURFACE)
    filas = 2 if curvas else 1
    gs = fig.add_gridspec(filas, 2, height_ratios=[1, 1.3] if curvas else [1], hspace=0.38, wspace=0.28)

    if curvas:
        epocas, loss_train, loss_val, acc_val, f1_val = curvas

        ax1 = fig.add_subplot(gs[0, 0])
        _estilo_panel(ax1)
        ax1.plot(epocas, loss_train, color=AZUL, linewidth=2, label="Train")
        ax1.plot(epocas, loss_val, color=NARANJA, linewidth=2, label="Val")
        ax1.set_title("Loss por época", color=INK_PRIMARIO, fontsize=11, fontweight="bold", loc="left")
        ax1.set_xlabel("Época", color=INK_SECUNDARIO, fontsize=9)
        ax1.legend(frameon=False, fontsize=9, labelcolor=INK_SECUNDARIO)

        ax2 = fig.add_subplot(gs[0, 1])
        _estilo_panel(ax2)
        ax2.plot(epocas, acc_val, color=AQUA, linewidth=2, label="Accuracy")
        ax2.plot(epocas, f1_val, color=AMARILLO, linewidth=2, label="F1 macro")
        ax2.set_ylim(0, 1)
        ax2.set_title("Validación", color=INK_PRIMARIO, fontsize=11, fontweight="bold", loc="left")
        ax2.set_xlabel("Época", color=INK_SECUNDARIO, fontsize=9)
        ax2.legend(frameon=False, fontsize=9, labelcolor=INK_SECUNDARIO)

    fila_inferior = 1 if curvas else 0

    ax3 = fig.add_subplot(gs[fila_inferior, 0])
    ax3.set_facecolor(SURFACE)
    cmap = matplotlib.colors.LinearSegmentedColormap.from_list("seq", RAMPA_SECUENCIAL)
    im = ax3.imshow(matriz_confusion, cmap=cmap)
    ax3.set_xticks(range(len(etiquetas)))
    ax3.set_yticks(range(len(etiquetas)))
    ax3.set_xticklabels(etiquetas, rotation=45, ha="right", color=INK_SECUNDARIO, fontsize=9)
    ax3.set_yticklabels(etiquetas, color=INK_SECUNDARIO, fontsize=9)
    ax3.set_xlabel("Predicho", color=INK_SECUNDARIO, fontsize=9)
    ax3.set_ylabel("Real", color=INK_SECUNDARIO, fontsize=9)
    ax3.set_title("Matriz de confusión (test)", color=INK_PRIMARIO, fontsize=11, fontweight="bold", loc="left")
    maximo = matriz_confusion.max() if matriz_confusion.max() > 0 else 1
    for i in range(len(etiquetas)):
        for j in range(len(etiquetas)):
            valor = matriz_confusion[i, j]
            if valor == 0:
                continue
            color_texto = SURFACE if valor > maximo * 0.6 else INK_PRIMARIO
            ax3.text(j, i, str(valor), ha="center", va="center", color=color_texto, fontsize=9)
    for lado in ax3.spines.values():
        lado.set_visible(False)

    ax4 = fig.add_subplot(gs[fila_inferior, 1])
    ax4.set_facecolor(SURFACE)
    ax4.axis("off")
    filas_tabla = [["Seña", "Prec.", "Recall", "F1", "N"]]
    for et in etiquetas:
        m = reporte[et]
        filas_tabla.append([et, f"{m['precision']:.2f}", f"{m['recall']:.2f}",
                             f"{m['f1-score']:.2f}", str(int(m["support"]))])
    filas_tabla.append(["", "", "", "", ""])
    filas_tabla.append(["Accuracy", "", "", f"{reporte['accuracy']:.2f}", str(len(y_test))])
    filas_tabla.append(["Macro avg", f"{reporte['macro avg']['precision']:.2f}",
                         f"{reporte['macro avg']['recall']:.2f}",
                         f"{reporte['macro avg']['f1-score']:.2f}", ""])

    tabla = ax4.table(cellText=filas_tabla, loc="center", cellLoc="center",
                       colWidths=[0.3, 0.18, 0.18, 0.18, 0.12])
    tabla.auto_set_font_size(False)
    tabla.set_fontsize(9.5)
    tabla.scale(1, 1.5)
    for (fila, _col), celda in tabla.get_celld().items():
        celda.set_edgecolor(GRID)
        celda.set_facecolor(SURFACE)
        celda.set_text_props(color=INK_PRIMARIO)
        if fila == 0:
            celda.set_text_props(color=INK_SECUNDARIO, fontweight="bold")
        if fila == len(etiquetas) + 1:
            celda.set_edgecolor(SURFACE)
    ax4.set_title("Métricas por seña (test)", color=INK_PRIMARIO, fontsize=11, fontweight="bold", loc="left")

    fig.suptitle(f"Reconocimiento de señas dinámicas (TCN) — {len(etiquetas)} señas, "
                 f"accuracy test {reporte['accuracy']:.0%}",
                 color=INK_PRIMARIO, fontsize=13, fontweight="bold", x=0.02, ha="left")

    fig.savefig(ruta_salida, dpi=160, facecolor=SURFACE, bbox_inches="tight")
    print(f"[Visualización] Guardado en {ruta_salida}")


if __name__ == "__main__":
    main()
