"""
Análisis estadístico de los datos del modelo de señas ESTÁTICAS (Capítulo IV).

Lee los landmarks ya extraídos del repositorio y produce las tablas y figuras
del análisis de datos de la tesis:

  1. Composición del conjunto: imágenes, detecciones y muestras por clase y
     por fuente (Roboflow y Kaggle), con medidas de desbalance.
  2. Desplazamiento entre fuentes: prueba de Kolmogorov-Smirnov por
     característica, con corrección de Bonferroni.
  3. Separabilidad entre clases: silueta por clase y pares de clases con los
     centroides más cercanos.
  4. Importancia de las características del Random Forest, por grupo.

Usa la misma extracción de 85 características y los mismos hiperparámetros
que ai_module/model/train_static.py. Uso, desde la raíz del repositorio:

    python docs/tesis/analisis/analisis_estatico.py [carpeta_salida]

Requiere numpy, scikit-learn, scipy y matplotlib.
"""

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import matplotlib.ticker  # noqa: E402
import numpy as np  # noqa: E402
from scipy.stats import ks_2samp  # noqa: E402
from sklearn.decomposition import PCA  # noqa: E402
from sklearn.ensemble import RandomForestClassifier  # noqa: E402
from sklearn.metrics import silhouette_samples  # noqa: E402
from sklearn.preprocessing import StandardScaler  # noqa: E402

RAIZ = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(RAIZ / "ai_module"))
from model.train_static import LETRAS_CON_MOVIMIENTO, extraer_caracteristicas  # noqa: E402

DATOS = RAIZ / "ai_module" / "data"
FUENTES = {"Roboflow": DATOS / "landmarks_estaticos", "Kaggle": DATOS / "landmarks_kaggle"}
IMAGENES_ROBOFLOW = DATOS / "raw" / "lsch_alfabeto"
GRUPOS = {"Coordenadas (63)": slice(0, 63), "Ángulos de flexión (15)": slice(63, 78), "Distancias entre puntas (7)": slice(78, 85)}
COLORES = {"Roboflow": "#8F1EAE", "Kaggle": "#E2A10A"}
SEMILLA = 42

plt.rcParams.update({"font.size": 10, "font.family": "DejaVu Sans", "savefig.dpi": 300})


def coma(valor: float, decimales: int = 1) -> str:
    """Número con coma decimal, como en el texto de la tesis."""
    return f"{valor:.{decimales}f}".replace(".", ",")


FORMATO_COMA = matplotlib.ticker.FuncFormatter(lambda v, _: coma(v, 3) if v % 1 else str(int(v)))


def cargar(fuente: str, carpeta: Path):
    filas = []
    for clase in sorted(p.name for p in carpeta.iterdir() if p.is_dir()):
        if clase in LETRAS_CON_MOVIMIENTO:
            continue
        for archivo in sorted((carpeta / clase).glob("*.npy")):
            lm = np.load(archivo)
            if lm.shape == (21, 3):
                filas.append((fuente, clase, extraer_caracteristicas(lm.astype(np.float32))))
    return filas


def describir(conteos: np.ndarray) -> dict:
    return {
        "total": int(conteos.sum()),
        "media": round(float(conteos.mean()), 1),
        "desviacion": round(float(conteos.std(ddof=1)), 1),
        "minimo": int(conteos.min()),
        "maximo": int(conteos.max()),
        "coef_variacion": round(float(conteos.std(ddof=1) / conteos.mean()), 3),
        "razon_desbalance": round(float(conteos.max() / conteos.min()), 2),
    }


def main(salida: Path):
    salida.mkdir(parents=True, exist_ok=True)
    filas = [f for fuente, carpeta in FUENTES.items() for f in cargar(fuente, carpeta)]
    fuentes = np.array([f[0] for f in filas])
    clases_y = np.array([f[1] for f in filas])
    X = np.stack([f[2] for f in filas])
    clases = sorted(set(clases_y))
    resultado = {"clases": clases, "n_caracteristicas": int(X.shape[1])}

    # 1. Composición por clase y fuente
    tabla = []
    for c in clases:
        imgs = len(list((IMAGENES_ROBOFLOW / c).glob("*.jpg")))
        rob = int(((fuentes == "Roboflow") & (clases_y == c)).sum())
        kag = int(((fuentes == "Kaggle") & (clases_y == c)).sum())
        tabla.append({"clase": c, "imagenes_roboflow": imgs, "muestras_roboflow": rob,
                      "deteccion": round(rob / imgs, 3) if imgs else None, "muestras_kaggle": kag})
    resultado["por_clase"] = tabla
    rob = np.array([t["muestras_roboflow"] for t in tabla])
    kag = np.array([t["muestras_kaggle"] for t in tabla])
    imgs = np.array([t["imagenes_roboflow"] for t in tabla])
    resultado["descriptivos"] = {"Roboflow": describir(rob), "Kaggle": describir(kag), "Total": describir(rob + kag)}
    resultado["deteccion_global"] = round(float(rob.sum() / imgs.sum()), 3)
    resultado["imagenes_roboflow"] = int(imgs.sum())
    resultado["deteccion_minima"] = min((t for t in tabla), key=lambda t: t["deteccion"])

    fig, ax = plt.subplots(figsize=(7.2, 3.4))
    x = np.arange(len(clases))
    ax.bar(x, rob, color=COLORES["Roboflow"], label="Roboflow")
    ax.bar(x, kag, bottom=rob, color=COLORES["Kaggle"], label="Kaggle")
    ax.set_xticks(x, clases)
    ax.set_ylabel("Muestras con mano detectada")
    ax.set_xlabel("Letra")
    ax.axhline((rob + kag).mean(), color="#6B5177", linestyle="--", linewidth=1, label="Media total")
    ax.legend(frameon=False, ncol=3, loc="upper right")
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(salida / "fig_distribucion_clases.png")
    plt.close(fig)

    # 2. Desplazamiento entre fuentes (Kolmogorov-Smirnov por característica)
    es_rob = fuentes == "Roboflow"
    p_valores = np.array([ks_2samp(X[es_rob, j], X[~es_rob, j]).pvalue for j in range(X.shape[1])])
    estadisticos = np.array([ks_2samp(X[es_rob, j], X[~es_rob, j]).statistic for j in range(X.shape[1])])
    alfa = 0.05 / X.shape[1]
    resultado["ks"] = {
        "alfa_bonferroni": alfa,
        "significativas": int((p_valores < alfa).sum()),
        "por_grupo": {g: {"significativas": int((p_valores[s] < alfa).sum()), "total": int(s.stop - s.start),
                          "D_mediana": round(float(np.median(estadisticos[s])), 3)} for g, s in GRUPOS.items()},
    }

    Xs = StandardScaler().fit_transform(X)
    pca = PCA(n_components=2, random_state=SEMILLA).fit(Xs)
    Z = pca.transform(Xs)
    resultado["pca_varianza"] = [round(float(v), 3) for v in pca.explained_variance_ratio_]
    fig, ax = plt.subplots(figsize=(5.6, 4.2))
    for fuente in ("Roboflow", "Kaggle"):
        m = fuentes == fuente
        ax.scatter(Z[m, 0], Z[m, 1], s=9 if fuente == "Roboflow" else 16, alpha=0.55 if fuente == "Roboflow" else 0.9,
                   color=COLORES[fuente], label=f"{fuente} (n = {m.sum()})", edgecolors="none")
    ev = pca.explained_variance_ratio_
    ax.set_xlabel(f"Componente principal 1 ({coma(ev[0] * 100)} % de la varianza)")
    ax.set_ylabel(f"Componente principal 2 ({coma(ev[1] * 100)} %)")
    ax.legend(frameon=False)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(salida / "fig_pca_fuentes.png")
    plt.close(fig)

    # 3. Separabilidad: silueta por clase y centroides más cercanos
    sil = silhouette_samples(Xs, clases_y)
    resultado["silueta_global"] = round(float(sil.mean()), 3)
    por_clase = {c: round(float(sil[clases_y == c].mean()), 3) for c in clases}
    resultado["silueta_por_clase"] = por_clase
    centroides = np.stack([Xs[clases_y == c].mean(axis=0) for c in clases])
    d = np.linalg.norm(centroides[:, None] - centroides[None], axis=-1)
    np.fill_diagonal(d, np.inf)
    pares = sorted({tuple(sorted((clases[i], clases[int(np.argmin(d[i]))]))) + (round(float(d[i].min()), 2),)
                    for i in range(len(clases))}, key=lambda p: p[2])
    resultado["pares_cercanos"] = pares[:8]

    # 4. Importancia del Random Forest por grupo de características
    rf = RandomForestClassifier(n_estimators=200, min_samples_leaf=2, random_state=SEMILLA, n_jobs=-1).fit(Xs, clases_y)
    imp = rf.feature_importances_
    resultado["importancia_por_grupo"] = {g: round(float(imp[s].sum()), 3) for g, s in GRUPOS.items()}
    resultado["importancia_media_por_caracteristica"] = {g: round(float(imp[s].mean()), 4) for g, s in GRUPOS.items()}

    fig, ax = plt.subplots(figsize=(6.4, 2.6))
    nombres = list(GRUPOS)
    medias = [imp[GRUPOS[g]].mean() for g in nombres]
    ax.barh(nombres, medias, color=["#CDB0E3", "#8F1EAE", "#E2A10A"])
    ax.xaxis.set_major_formatter(FORMATO_COMA)
    ax.set_xlabel("Importancia media por característica")
    ax.invert_yaxis()
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(salida / "fig_importancia_grupos.png")
    plt.close(fig)

    (salida / "resultados.json").write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps(resultado, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "docs" / "tesis" / "analisis" / "resultados")
