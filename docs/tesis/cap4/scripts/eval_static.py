"""Evalúa el clasificador estático con los mismos parámetros de train_static.py.

P1: split estratificado 80/20 + CV 5-fold (protocolo del repo).
P2: generalización a otras personas: entrena solo con Roboflow y prueba con Kaggle.
Compara RF (elegido) contra SVM-RBF (alternativa ya implementada en el script).
"""
import json, sys, time
from pathlib import Path
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix, classification_report
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

AI = Path(sys.argv[1]); OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(AI / "model"))
import train_static as ts

def pipe(kind):
    clf = (SVC(kernel="rbf", C=10, gamma="scale", probability=True) if kind == "svm"
           else RandomForestClassifier(n_estimators=200, max_depth=None, min_samples_leaf=2, random_state=42, n_jobs=-1))
    return Pipeline([("escalador", StandardScaler()), ("clasificador", clf)])

def metrics(y, p):
    pr, rc, f1, _ = precision_recall_fscore_support(y, p, average="macro", zero_division=0)
    return {"accuracy": accuracy_score(y, p), "precision_macro": pr, "recall_macro": rc, "f1_macro": f1, "n_test": int(len(y))}

def fit_eval(kind, Xtr_raw, ytr, Xte_raw, yte):
    Xa, ya = ts.aumentar_landmarks(Xtr_raw, ytr, n_aug=8)
    m = pipe(kind); t = time.perf_counter(); m.fit(ts._features_de_lote(Xa), ya); fit_s = time.perf_counter() - t
    Xte = ts._features_de_lote(Xte_raw); t = time.perf_counter(); p = m.predict(Xte); lat = (time.perf_counter() - t) / len(Xte) * 1000
    return m, p, fit_s, lat

def plot_cm(y, p, labels, title, path):
    cm = confusion_matrix(y, p, labels=range(len(labels)))
    fig, ax = plt.subplots(figsize=(8, 7)); im = ax.imshow(cm, cmap="Purples")
    ax.set_xticks(range(len(labels)), labels); ax.set_yticks(range(len(labels)), labels)
    ax.set_xlabel("Predicción"); ax.set_ylabel("Clase real"); ax.set_title(title, fontsize=11)
    for i in range(len(labels)):
        for j in range(len(labels)):
            if cm[i, j]: ax.text(j, i, cm[i, j], ha="center", va="center", fontsize=7, color="white" if cm[i, j] > cm.max() / 2 else "black")
    fig.colorbar(im, fraction=0.046); fig.tight_layout(); fig.savefig(path, dpi=200); plt.close(fig)
    return cm

res = {}
excl = ts.LETRAS_CON_MOVIMIENTO
X, y, labels = ts.cargar_varios([str(AI / "data/landmarks_estaticos"), str(AI / "data/landmarks_kaggle")], excl)
res["dataset"] = {"muestras": int(len(X)), "clases": labels, "n_clases": len(labels)}
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
for kind in ("rf", "svm"):
    m, p, fit_s, lat = fit_eval(kind, Xtr, ytr, Xte, yte)
    cv = cross_val_score(pipe(kind), ts._features_de_lote(X), y, cv=5, scoring="accuracy")
    res[f"P1_{kind}"] = {**metrics(yte, p), "cv5_mean": cv.mean(), "cv5_std": cv.std(), "fit_s": fit_s, "latencia_ms_por_muestra": lat}
    if kind == "rf":
        (OUT / "P1_rf_report.txt").write_text(classification_report(yte, p, target_names=labels, zero_division=0))
        plot_cm(yte, p, labels, "RF estático: partición de prueba (80/20)", OUT / "cm_static_rf_P1.png")

Xr, yr, lr = ts.cargar_varios([str(AI / "data/landmarks_estaticos")], excl)
Xk, yk, lk = ts.cargar_varios([str(AI / "data/landmarks_kaggle")], excl)
idx = {n: i for i, n in enumerate(lr)}; yk2 = np.array([idx[lk[i]] for i in yk])
res["P2_split"] = {"train_roboflow": int(len(Xr)), "test_kaggle": int(len(Xk))}
for kind in ("rf", "svm"):
    m, p, fit_s, lat = fit_eval(kind, Xr, yr, Xk, yk2)
    res[f"P2_{kind}"] = {**metrics(yk2, p), "fit_s": fit_s}
    if kind == "rf":
        (OUT / "P2_rf_report.txt").write_text(classification_report(yk2, p, labels=range(len(lr)), target_names=lr, zero_division=0))
        cm = plot_cm(yk2, p, lr, "RF estático: personas no vistas (Roboflow → Kaggle)", OUT / "cm_static_rf_P2.png")
        conf = [(lr[i], lr[j], int(cm[i, j])) for i in range(len(lr)) for j in range(len(lr)) if i != j and cm[i, j] > 0]
        res["P2_rf_confusiones"] = sorted(conf, key=lambda t: -t[2])[:10]
(OUT / "metricas_estatico.json").write_text(json.dumps(res, indent=2, ensure_ascii=False, default=float))
print(json.dumps(res, indent=2, ensure_ascii=False, default=float))
