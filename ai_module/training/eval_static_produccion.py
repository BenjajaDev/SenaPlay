"""
Evaluación reproducible del modelo ESTÁTICO con la configuración de
producción (model/train_static.py de gestilingo-dev): 21 letras (sin G, J, Ñ,
S, X ni Z), las 85 características de `extraer_caracteristicas`, los
hiperparámetros de `construir_pipeline` y 8 variantes aumentadas por muestra
de entrenamiento. Compara Random Forest (producción) y SVM-RBF con dos
protocolos:

  dentro_dataset   Roboflow, StratifiedGroupKFold(5) por imagen fuente (las
                   copias que Roboflow genera de una misma foto quedan en el
                   mismo pliegue). Usa la caché de training.eval_static, que
                   guarda de qué imagen salió cada landmark.
  personas_nuevas  entrena con Roboflow (data/landmarks_estaticos, los mismos
                   .npy que usa producción) y prueba con Kaggle, fotos de
                   otras personas que el modelo no vio.

Para cada protocolo y modelo: accuracy con intervalo de Wilson al 95 %,
precisión, recall y F1 macro, F1 por clase y matriz de confusión.

No reemplaza training.eval_static (26 clases, solo Roboflow) ni toca el
modelo exportado. Escribe results/<fecha>_estatico_produccion/.

    cd ai_module
    python -m training.eval_static_produccion
    python -m training.eval_static_produccion --kaggle ../otra/ruta/landmarks_kaggle
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sklearn.metrics import confusion_matrix  # noqa: E402
from sklearn.model_selection import StratifiedGroupKFold  # noqa: E402

from common.config import cargar_yaml  # noqa: E402
from common.reproducibilidad import commit_actual, info_entorno  # noqa: E402
from common.rutas import relativa, resolver  # noqa: E402
from model.train_static import (  # noqa: E402
    _features_de_lote, aumentar_landmarks, cargar_dataset, construir_pipeline,
)
from training import evaluate  # noqa: E402
from training.eval_static import extraer_landmarks_imagenes  # noqa: E402

# Configuración de producción (model/train_static.py en gestilingo-dev).
LETRAS_CON_MOVIMIENTO = ["G", "J", "Ñ", "S", "X", "Z"]
N_AUG_PRODUCCION = 8
MODELOS = {"rf": "Random Forest", "svm": "SVM-RBF"}
N_PLIEGUES, SEMILLA = 5, 42
Z_95 = 1.959964


def wilson(aciertos: int, n: int, z: float = Z_95) -> tuple[float, float]:
    """Intervalo de Wilson para una proporción (aciertos de n)."""
    if n == 0:
        return float("nan"), float("nan")
    p = aciertos / n
    centro = (p + z * z / (2 * n)) / (1 + z * z / n)
    margen = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return centro - margen, centro + margen


def _sin_letras_con_movimiento(X: np.ndarray, nombres: np.ndarray, *otros):
    conservar = ~np.isin(nombres, LETRAS_CON_MOVIMIENTO)
    return (X[conservar], nombres[conservar], *(o[conservar] for o in otros))


def _desde_directorio(directorio: str) -> tuple[np.ndarray, np.ndarray]:
    X, y, etiquetas = cargar_dataset(directorio)
    return _sin_letras_con_movimiento(X, np.array(etiquetas)[y])


def _entrenar(modelo: str, X: np.ndarray, y: np.ndarray, n_aug: int):
    if n_aug > 0:
        X, y = aumentar_landmarks(X, y, n_aug=n_aug)
    pipeline = construir_pipeline(modelo)
    pipeline.fit(_features_de_lote(X), y)
    return pipeline


def dentro_dataset(modelo: str, X: np.ndarray, nombres: np.ndarray, grupos: np.ndarray,
                   clases: list[str], n_aug: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    """(predicciones con su pliegue, métricas por pliegue)."""
    y = np.array([clases.index(n) for n in nombres])
    divisor = StratifiedGroupKFold(n_splits=N_PLIEGUES, shuffle=True, random_state=SEMILLA)
    predicciones, por_pliegue = [], []
    for pliegue, (idx_ent, idx_prueba) in enumerate(divisor.split(X, y, grupos)):
        if set(grupos[idx_ent]) & set(grupos[idx_prueba]):
            raise AssertionError(f"Pliegue {pliegue}: imágenes fuente compartidas")
        pipeline = _entrenar(modelo, X[idx_ent], y[idx_ent], n_aug)
        pred = pipeline.predict(_features_de_lote(X[idx_prueba]))
        predicciones.append(pd.DataFrame({"pliegue": pliegue, "y_true": y[idx_prueba],
                                          "y_pred": pred}))
        globales, _ = evaluate.metricas(y[idx_prueba], pred, clases)
        por_pliegue.append({"pliegue": pliegue, "n_prueba": len(idx_prueba), **globales})
    return pd.concat(predicciones, ignore_index=True), pd.DataFrame(por_pliegue)


def personas_nuevas(modelo: str, X_ent: np.ndarray, nombres_ent: np.ndarray, X_prueba: np.ndarray,
                    nombres_prueba: np.ndarray, clases: list[str], n_aug: int) -> pd.DataFrame:
    y_ent = np.array([clases.index(n) for n in nombres_ent])
    y_prueba = np.array([clases.index(n) for n in nombres_prueba])
    pipeline = _entrenar(modelo, X_ent, y_ent, n_aug)
    return pd.DataFrame({"pliegue": 0, "y_true": y_prueba,
                         "y_pred": pipeline.predict(_features_de_lote(X_prueba))})


def figura_confusion(cm: np.ndarray, clases: list[str], ruta: str, titulo: str, dpi: int) -> None:
    """Como evaluate.figura_confusion, con coma decimal en la barra de color."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.colors import LinearSegmentedColormap
    from matplotlib.ticker import FuncFormatter

    filas = cm.sum(axis=1, keepdims=True)
    proporcion = np.divide(cm, filas, out=np.zeros_like(cm, dtype=float), where=filas > 0)
    lado = max(4.0, 0.45 * len(clases) + 2.2)
    fig, ax = plt.subplots(figsize=(lado, lado * 0.9), facecolor=evaluate.SUPERFICIE)
    evaluate._estilo(ax, grilla_eje="")
    mapa = LinearSegmentedColormap.from_list("secuencial", evaluate.RAMPA_SECUENCIAL)
    im = ax.imshow(proporcion, cmap=mapa, vmin=0, vmax=1)
    for i in range(len(clases)):
        for j in range(len(clases)):
            if cm[i, j]:
                claro = proporcion[i, j] > 0.55
                ax.text(j, i, f"{proporcion[i, j]:.0%}\n({cm[i, j]})", ha="center", va="center",
                        fontsize=6, color="#ffffff" if claro else evaluate.TINTA)
    ax.set_xticks(range(len(clases)), clases)
    ax.set_yticks(range(len(clases)), clases)
    ax.set_xlabel("Clase predicha", color=evaluate.TINTA_SECUNDARIA, fontsize=9)
    ax.set_ylabel("Clase real", color=evaluate.TINTA_SECUNDARIA, fontsize=9)
    ax.set_title(titulo, color=evaluate.TINTA, fontsize=10, loc="left")
    barra = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04,
                         format=FuncFormatter(lambda v, _p: f"{v:.1f}".replace(".", ",")))
    barra.set_label("Proporción de la fila (recall)", color=evaluate.TINTA_SECUNDARIA, fontsize=8)
    barra.ax.tick_params(colors=evaluate.TINTA_SECUNDARIA, labelsize=7)
    barra.outline.set_edgecolor(evaluate.EJE)
    fig.tight_layout()
    fig.savefig(ruta, dpi=dpi, facecolor=evaluate.SUPERFICIE)
    plt.close(fig)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Evalúa el modelo estático de producción (21 letras)")
    parser.add_argument("--config", default="config/experimentos/estatico_rf.yaml",
                        help="De aquí se toma la caché de landmarks por imagen fuente (Roboflow)")
    parser.add_argument("--roboflow", default="data/landmarks_estaticos")
    parser.add_argument("--kaggle", default="data/landmarks_kaggle")
    parser.add_argument("--aug", type=int, default=N_AUG_PRODUCCION)
    parser.add_argument("--resultados", default="results")
    parser.add_argument("--dpi", type=int, default=300)
    args = parser.parse_args(argv)

    cache = extraer_landmarks_imagenes(cargar_yaml(args.config)["datos"])
    X_grupos, nombres_grupos, grupos = _sin_letras_con_movimiento(
        np.stack(cache["landmarks"]).astype(np.float32), cache["clase"].to_numpy(),
        cache["grupo"].to_numpy())
    X_rob, nombres_rob = _desde_directorio(resolver(args.roboflow))
    X_kag, nombres_kag = _desde_directorio(resolver(args.kaggle))
    clases = sorted(set(nombres_rob))
    if sorted(set(nombres_kag)) != clases or sorted(set(nombres_grupos)) != clases:
        raise ValueError("Roboflow, la caché y Kaggle no tienen las mismas 21 letras")
    print(f"[Estático] {len(clases)} letras · dentro del dataset: {len(X_grupos)} imágenes de "
          f"{len(set(grupos))} fuentes · personas nuevas: {len(X_rob)} Roboflow → {len(X_kag)} Kaggle")

    directorio = os.path.join(resolver(args.resultados),
                              f"{datetime.now():%Y%m%d-%H%M%S}_estatico_produccion")
    os.makedirs(directorio)
    resumen, por_clase, pliegues = [], [], []
    for protocolo in ("dentro_dataset", "personas_nuevas"):
        for modelo, nombre in MODELOS.items():
            if protocolo == "dentro_dataset":
                pred, por_pliegue = dentro_dataset(modelo, X_grupos, nombres_grupos, grupos,
                                                   clases, args.aug)
                pliegues.append(por_pliegue.assign(protocolo=protocolo, modelo=nombre))
            else:
                pred = personas_nuevas(modelo, X_rob, nombres_rob, X_kag, nombres_kag, clases,
                                       args.aug)
                por_pliegue = None
            globales, clase_df = evaluate.metricas(pred["y_true"], pred["y_pred"], clases)
            aciertos = int((pred["y_true"] == pred["y_pred"]).sum())
            inf, sup = wilson(aciertos, len(pred))
            fila = {"protocolo": protocolo, "modelo": nombre, "n_prueba": len(pred),
                    "aciertos": aciertos, **globales, "accuracy_wilson_inf": inf,
                    "accuracy_wilson_sup": sup}
            if por_pliegue is not None:
                fila.update(f1_macro_media_pliegues=por_pliegue["f1_macro"].mean(),
                            f1_macro_de_pliegues=por_pliegue["f1_macro"].std(ddof=1))
            resumen.append(fila)
            por_clase.append(clase_df.assign(protocolo=protocolo, modelo=nombre))
            cm = confusion_matrix(pred["y_true"], pred["y_pred"], labels=range(len(clases)))
            titulo = {"dentro_dataset": "Roboflow, 5 pliegues por imagen fuente",
                      "personas_nuevas": "Entrena Roboflow, prueba Kaggle"}[protocolo]
            figura_confusion(cm, clases, os.path.join(directorio, f"confusion_{protocolo}_{modelo}.png"),
                             f"{nombre} · {titulo}", args.dpi)
            print(f"  [{protocolo} · {nombre}] accuracy {globales['accuracy']:.3f} "
                  f"[{inf:.3f}; {sup:.3f}] · F1 macro {globales['f1_macro']:.3f} ({len(pred)} imágenes)")

    pd.DataFrame(resumen).to_csv(os.path.join(directorio, "metricas.csv"), index=False)
    pd.concat(por_clase).to_csv(os.path.join(directorio, "metricas_por_clase.csv"), index=False)
    pd.concat(pliegues).to_csv(os.path.join(directorio, "metricas_por_pliegue.csv"), index=False)
    with open(os.path.join(directorio, "commit.txt"), "w", encoding="utf-8") as f:
        f.write(commit_actual() + "\n")
    with open(os.path.join(directorio, "entorno.json"), "w", encoding="utf-8") as f:
        json.dump({**info_entorno(), "clases": clases, "excluidas": LETRAS_CON_MOVIMIENTO,
                   "n_aug": args.aug, "semilla": SEMILLA, "n_pliegues": N_PLIEGUES,
                   "roboflow": args.roboflow, "kaggle": args.kaggle}, f, ensure_ascii=False, indent=2)
    print(f"[Estático] → {relativa(directorio)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
