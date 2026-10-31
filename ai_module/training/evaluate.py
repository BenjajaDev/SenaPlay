"""
Métricas, latencia, figuras y tablas de resultados.

Salidas de una corrida (results/<fecha>_<arquitectura>/):
    config.yaml               configuración resuelta, exactamente la usada
    commit.txt                hash de git (con '-dirty' si había cambios sin commitear)
    entorno.json              versiones de librerías y CPU
    particiones.json          signers y videos de cada partición de cada pliegue
    predicciones.csv          una fila por video de prueba, pliegue y semilla
    historial.csv             pérdida y F1 de validación por época
    metrics_per_fold.csv      métricas por pliegue y semilla (macro y F1 por clase)
    metrics_per_class.csv     precisión, recall, F1 y soporte por clase, pliegue y semilla
    metrics_per_signer.csv    accuracy y F1 macro por signer
    summary.csv               media ± desviación estándar de cada métrica (sobre pliegue × semilla)
    confusion_matrix.csv/.png matriz de confusión agregada sobre pliegues y semillas
    f1_per_signer.png         F1 macro por signer (media sobre semillas)
    latency.csv               latencia CPU batch 1 y tamaño del modelo
    resumen_corrida.json      lo que usa summary_all y select_model

Y en results/: summary_all.csv, summary_all.md y comparacion_f1_macro.png.
"""

from __future__ import annotations

import io
import json
import os
import time
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score, confusion_matrix, f1_score, precision_recall_fscore_support,
)

from common.config import guardar_yaml
from common.reproducibilidad import commit_actual, info_entorno
from common.rutas import relativa, resolver

EXPERIMENTO_PRINCIPAL = "comparacion_temporal"

# Paleta (referencia dataviz, modo claro; la misma de scripts/visualize_results.py)
SUPERFICIE = "#fcfcfb"
TINTA = "#0b0b0b"
TINTA_SECUNDARIA = "#52514e"
TINTA_TENUE = "#898781"
GRILLA = "#e1e0d9"
EJE = "#c3c2b7"
SERIE_1 = "#2a78d6"
RAMPA_SECUENCIAL = ["#fcfcfb", "#cde2fb", "#9ec5f4", "#5598e7", "#2a78d6", "#184f95"]

NOMBRES_METRICAS = {
    "accuracy": "Accuracy",
    "precision_macro": "Precisión macro",
    "recall_macro": "Recall macro",
    "f1_macro": "F1 macro",
}


# ── Métricas ──────────────────────────────────────────────────────────────────

def metricas(y_true, y_pred, clases: list[str]) -> tuple[dict, pd.DataFrame]:
    """Métricas globales (dict) y por clase (DataFrame)."""
    etiquetas = list(range(len(clases)))
    p, r, f, s = precision_recall_fscore_support(y_true, y_pred, labels=etiquetas,
                                                 zero_division=0)
    globales = {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision_macro": float(np.mean(p)),
        "recall_macro": float(np.mean(r)),
        "f1_macro": f1_score(y_true, y_pred, labels=etiquetas, average="macro", zero_division=0),
    }
    por_clase = pd.DataFrame({"clase": clases, "precision": p, "recall": r, "f1": f,
                              "soporte": s})
    return globales, por_clase


def metricas_por_signer(pred: pd.DataFrame, clases: list[str]) -> pd.DataFrame:
    filas = []
    etiquetas = list(range(len(clases)))
    for (pliegue, semilla, signer), g in pred.groupby(["pliegue", "semilla", "signer_id"]):
        presentes = sorted(set(g["y_true"]))
        filas.append({
            "pliegue": pliegue, "semilla": semilla, "signer_id": signer, "n": len(g),
            "accuracy": accuracy_score(g["y_true"], g["y_pred"]),
            # F1 macro sobre las clases que el signer grabó
            "f1_macro": f1_score(g["y_true"], g["y_pred"], labels=presentes or etiquetas,
                                 average="macro", zero_division=0),
        })
    return pd.DataFrame(filas)


def resumen_estadistico(por_pliegue: pd.DataFrame, columnas: list[str]) -> pd.DataFrame:
    filas = []
    for c in columnas:
        v = por_pliegue[c].astype(float)
        filas.append({"metrica": c, "media": v.mean(), "desviacion": v.std(ddof=1) if len(v) > 1
                      else 0.0, "min": v.min(), "max": v.max(), "n": len(v)})
    return pd.DataFrame(filas)


# ── Latencia y tamaño ─────────────────────────────────────────────────────────

def tamano_mb(modelo) -> float:
    import torch

    buffer = io.BytesIO()
    torch.save(modelo.state_dict(), buffer)
    return buffer.tell() / (1024 ** 2)


def medir_latencia(funcion, calentamiento: int, mediciones: int) -> dict:
    for _ in range(calentamiento):
        funcion()
    tiempos = []
    for _ in range(mediciones):
        t0 = time.perf_counter()
        funcion()
        tiempos.append((time.perf_counter() - t0) * 1000.0)
    t = np.array(tiempos)
    return {"media_ms": float(t.mean()), "p50_ms": float(np.percentile(t, 50)),
            "p95_ms": float(np.percentile(t, 95)), "desviacion_ms": float(t.std(ddof=1)),
            "calentamiento": calentamiento, "mediciones": mediciones}


def latencia_modelo(modelo, T: int, F: int, cfg_lat: dict) -> dict:
    """CPU, batch 1, una ventana de T frames."""
    import torch

    hilos_previos = torch.get_num_threads()
    if cfg_lat.get("hilos"):
        torch.set_num_threads(int(cfg_lat["hilos"]))
    modelo = modelo.to("cpu").eval()
    x = torch.randn(1, T, F, generator=torch.Generator().manual_seed(cfg_lat.get("semilla", 0)))
    try:
        with torch.inference_mode():
            r = medir_latencia(lambda: modelo(x), cfg_lat["calentamiento"], cfg_lat["mediciones"])
        r["hilos"] = torch.get_num_threads()
    finally:
        torch.set_num_threads(hilos_previos)
    r.update(T=T, F=F, batch=1, dispositivo="cpu", tamano_mb=tamano_mb(modelo))
    return r


# ── Figuras ───────────────────────────────────────────────────────────────────

def _estilo(ax, grilla_eje: str = "y"):
    ax.set_facecolor(SUPERFICIE)
    for lado in ("top", "right"):
        ax.spines[lado].set_visible(False)
    for lado in ("left", "bottom"):
        ax.spines[lado].set_color(EJE)
    ax.tick_params(colors=TINTA_SECUNDARIA, labelsize=8)
    if grilla_eje:
        ax.grid(axis=grilla_eje, color=GRILLA, linewidth=0.6)
        ax.set_axisbelow(True)


def figura_confusion(cm: np.ndarray, clases: list[str], ruta: str, titulo: str, dpi: int) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.colors import LinearSegmentedColormap

    filas = cm.sum(axis=1, keepdims=True)
    proporcion = np.divide(cm, filas, out=np.zeros_like(cm, dtype=float), where=filas > 0)
    lado = max(4.0, 0.55 * len(clases) + 2.2)
    fig, ax = plt.subplots(figsize=(lado, lado * 0.9), facecolor=SUPERFICIE)
    _estilo(ax, grilla_eje="")
    mapa = LinearSegmentedColormap.from_list("secuencial", RAMPA_SECUENCIAL)
    im = ax.imshow(proporcion, cmap=mapa, vmin=0, vmax=1)
    for i in range(len(clases)):
        for j in range(len(clases)):
            if cm[i, j] == 0:
                continue
            claro = proporcion[i, j] > 0.55
            ax.text(j, i, f"{proporcion[i, j]:.0%}\n({cm[i, j]})", ha="center", va="center",
                    fontsize=7, color="#ffffff" if claro else TINTA)
    ax.set_xticks(range(len(clases)), clases, rotation=45, ha="right")
    ax.set_yticks(range(len(clases)), clases)
    ax.set_xlabel("Clase predicha", color=TINTA_SECUNDARIA, fontsize=9)
    ax.set_ylabel("Clase real", color=TINTA_SECUNDARIA, fontsize=9)
    ax.set_title(titulo, color=TINTA, fontsize=10, loc="left")
    barra = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    barra.set_label("Proporción de la fila (recall)", color=TINTA_SECUNDARIA, fontsize=8)
    barra.ax.tick_params(colors=TINTA_SECUNDARIA, labelsize=7)
    barra.outline.set_edgecolor(EJE)
    fig.tight_layout()
    fig.savefig(ruta, dpi=dpi, facecolor=SUPERFICIE)
    plt.close(fig)


def figura_barras(etiquetas: list[str], valores, errores, ruta: str, titulo: str,
                  eje_x: str, eje_y: str, dpi: int, referencia: float | None = None,
                  texto_referencia: str = "", etiquetas_valor: bool = False) -> None:
    """Barras de una sola serie (un color), con barras de error opcionales."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    ancho = max(4.5, 0.32 * len(etiquetas) + 2.0)
    fig, ax = plt.subplots(figsize=(ancho, 3.4), facecolor=SUPERFICIE)
    _estilo(ax)
    x = np.arange(len(etiquetas))
    valores = np.asarray(valores, dtype=float)
    if errores is not None:  # la métrica está acotada en [0, 1]: se recorta la barra de error
        errores = np.asarray(errores, dtype=float)
        errores = np.vstack([np.minimum(errores, valores), np.minimum(errores, 1.0 - valores)])
    ax.bar(x, valores, width=0.7, color=SERIE_1, edgecolor=SUPERFICIE, linewidth=1.0,
           yerr=errores, error_kw={"ecolor": TINTA_SECUNDARIA, "elinewidth": 0.8, "capsize": 2})
    if etiquetas_valor:
        for xi, v in zip(x, valores):
            ax.text(xi, v / 2, f"{v:.3f}", ha="center", va="center", fontsize=8, color="#ffffff")
    if referencia is not None:
        ax.axhline(referencia, color=TINTA_TENUE, linewidth=0.8, linestyle="--")
        ax.text(len(etiquetas) - 0.5, referencia, f" {texto_referencia}", va="bottom", ha="right",
                fontsize=7, color=TINTA_SECUNDARIA)
    ax.set_xticks(x, etiquetas, rotation=45 if len(etiquetas) > 6 else 0,
                  ha="right" if len(etiquetas) > 6 else "center")
    ax.set_ylim(0, 1.05)
    ax.set_xlabel(eje_x, color=TINTA_SECUNDARIA, fontsize=9)
    ax.set_ylabel(eje_y, color=TINTA_SECUNDARIA, fontsize=9)
    ax.set_title(titulo, color=TINTA, fontsize=10, loc="left")
    fig.tight_layout()
    fig.savefig(ruta, dpi=dpi, facecolor=SUPERFICIE)
    plt.close(fig)


# ── Escritura de una corrida ──────────────────────────────────────────────────

def nombre_corrida(arquitectura: str, experimento: str, esquema: str) -> str:
    nombre = f"{datetime.now():%Y%m%d-%H%M%S}_{arquitectura}"
    if experimento != EXPERIMENTO_PRINCIPAL:
        nombre += f"_{experimento}"
    if esquema != "kfold":
        nombre += f"_{esquema}"
    return nombre


def escribir_corrida(directorio: str, *, cfg: dict, arquitectura: str, esquema: str,
                     clases: list[str], predicciones: pd.DataFrame, historial: pd.DataFrame,
                     entrenamiento: pd.DataFrame, latencia: dict, parametros: int,
                     n_videos: int, n_signers: int, tipo: str = "dinamica",
                     etiqueta_grupo: str = "signer") -> dict:
    """Escribe todos los archivos de la corrida y devuelve su resumen."""
    os.makedirs(directorio, exist_ok=True)
    dpi = int(cfg.get("salidas", {}).get("dpi", 300))
    guardar_yaml(cfg, os.path.join(directorio, "config.yaml"))
    with open(os.path.join(directorio, "commit.txt"), "w", encoding="utf-8") as f:
        f.write(commit_actual() + "\n")
    with open(os.path.join(directorio, "entorno.json"), "w", encoding="utf-8") as f:
        json.dump(info_entorno(), f, ensure_ascii=False, indent=2)

    predicciones.to_csv(os.path.join(directorio, "predicciones.csv"), index=False)
    if historial is not None and len(historial):
        historial.to_csv(os.path.join(directorio, "historial.csv"), index=False)

    # Métricas por pliegue × semilla
    filas, por_clase = [], []
    for (pliegue, semilla), g in predicciones.groupby(["pliegue", "semilla"]):
        glob, pc = metricas(g["y_true"], g["y_pred"], clases)
        fila = {"pliegue": pliegue, "semilla": semilla, **glob}
        fila.update({f"f1_{c}": v for c, v in zip(pc["clase"], pc["f1"])})
        filas.append(fila)
        pc.insert(0, "semilla", semilla)
        pc.insert(0, "pliegue", pliegue)
        por_clase.append(pc)
    por_pliegue = pd.DataFrame(filas)
    if entrenamiento is not None and len(entrenamiento):
        por_pliegue = entrenamiento.merge(por_pliegue, on=["pliegue", "semilla"])
    por_pliegue.to_csv(os.path.join(directorio, "metrics_per_fold.csv"), index=False)
    pd.concat(por_clase).to_csv(os.path.join(directorio, "metrics_per_class.csv"), index=False)

    columnas = list(NOMBRES_METRICAS) + [f"f1_{c}" for c in clases]
    resumen = resumen_estadistico(por_pliegue, columnas)
    resumen.to_csv(os.path.join(directorio, "summary.csv"), index=False)

    # Matriz de confusión agregada
    cm = confusion_matrix(predicciones["y_true"], predicciones["y_pred"],
                          labels=list(range(len(clases))))
    pd.DataFrame(cm, index=clases, columns=clases).to_csv(
        os.path.join(directorio, "confusion_matrix.csv"))
    titulo_base = f"{arquitectura.upper()} · {esquema}"
    figura_confusion(cm, clases, os.path.join(directorio, "confusion_matrix.png"),
                     f"Matriz de confusión agregada ({titulo_base})", dpi)

    # Por signer (o por grupo en el caso estático)
    if "signer_id" in predicciones.columns:
        ps = metricas_por_signer(predicciones, clases)
        ps.to_csv(os.path.join(directorio, "metrics_per_signer.csv"), index=False)
        agg = ps.groupby("signer_id")["f1_macro"].agg(["mean", "std"]).sort_values("mean")
        figura_barras(list(agg.index), agg["mean"].to_numpy(), agg["std"].fillna(0).to_numpy(),
                      os.path.join(directorio, "f1_per_signer.png"),
                      f"F1 macro por {etiqueta_grupo} ({titulo_base})",
                      "Signer" if etiqueta_grupo == "signer" else etiqueta_grupo.capitalize(),
                      "F1 macro (media sobre semillas)", dpi,
                      referencia=float(agg["mean"].mean()), texto_referencia="media")

    pd.DataFrame([{"arquitectura": arquitectura, "parametros": parametros, **latencia}]).to_csv(
        os.path.join(directorio, "latency.csv"), index=False)

    r = resumen.set_index("metrica")
    info = {
        "tipo": tipo,
        "experimento": cfg.get("nombre", EXPERIMENTO_PRINCIPAL),
        "arquitectura": arquitectura,
        "esquema": esquema,
        "fecha": datetime.now().isoformat(timespec="seconds"),
        "directorio": relativa(directorio),
        "commit": commit_actual(),
        "clases": clases,
        "n_videos": int(n_videos),
        "n_pliegues": int(predicciones["pliegue"].nunique()),
        "n_semillas": int(predicciones["semilla"].nunique()),
        "n_grupos": int(n_signers),
        "parametros": int(parametros),
        "latencia_media_ms": latencia["media_ms"],
        "latencia_p95_ms": latencia["p95_ms"],
        "tamano_mb": latencia["tamano_mb"],
        "metricas": {m: {"media": float(r.loc[m, "media"]), "desviacion": float(r.loc[m, "desviacion"])}
                     for m in columnas},
    }
    with open(os.path.join(directorio, "resumen_corrida.json"), "w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False, indent=2)
    return info


# ── Resumen global ────────────────────────────────────────────────────────────

def cargar_corridas(dir_resultados: str) -> list[dict]:
    corridas = []
    if not os.path.isdir(dir_resultados):
        return corridas
    for nombre in sorted(os.listdir(dir_resultados)):
        ruta = os.path.join(dir_resultados, nombre, "resumen_corrida.json")
        if os.path.exists(ruta):
            with open(ruta, encoding="utf-8") as f:
                corridas.append(json.load(f))
    return corridas


def ultimas_corridas(dir_resultados: str) -> list[dict]:
    """La corrida más reciente por (tipo, experimento, esquema, arquitectura)."""
    ultimas = {}
    for c in cargar_corridas(dir_resultados):
        clave = (c["tipo"], c["experimento"], c["esquema"], c["arquitectura"])
        if clave not in ultimas or c["fecha"] >= ultimas[clave]["fecha"]:
            ultimas[clave] = c
    return list(ultimas.values())


def _fmt(m: dict, pct: bool = True) -> str:
    if pct:
        return f"{100 * m['media']:.1f} ± {100 * m['desviacion']:.1f}"
    return f"{m['media']:.3f} ± {m['desviacion']:.3f}"


def resumir_todo(dir_resultados: str | None = None, dpi: int = 300) -> pd.DataFrame:
    """Escribe results/summary_all.csv, summary_all.md y comparacion_f1_macro.png."""
    dir_resultados = resolver(dir_resultados or "results")
    corridas = ultimas_corridas(dir_resultados)
    if not corridas:
        raise FileNotFoundError(f"No hay corridas en {dir_resultados}")

    filas = []
    for c in corridas:
        fila = {k: c[k] for k in ("tipo", "experimento", "esquema", "arquitectura", "parametros",
                                  "latencia_media_ms", "latencia_p95_ms", "tamano_mb",
                                  "n_videos", "n_grupos", "directorio", "commit", "fecha")}
        for m in NOMBRES_METRICAS:
            fila[f"{m}_media"] = c["metricas"][m]["media"]
            fila[f"{m}_desviacion"] = c["metricas"][m]["desviacion"]
        filas.append(fila)
    df = pd.DataFrame(filas).sort_values(["tipo", "experimento", "esquema", "f1_macro_media"],
                                         ascending=[True, True, True, False])
    df.to_csv(os.path.join(dir_resultados, "summary_all.csv"), index=False)

    lineas = ["# Resumen de resultados", "",
              f"Generado el {datetime.now():%Y-%m-%d %H:%M}. Métricas en porcentaje, media ± "
              "desviación estándar sobre pliegues × semillas. Latencia en CPU, batch 1, una "
              "ventana de T frames (media y percentil 95).", ""]
    dinamicas = [c for c in corridas if c["tipo"] == "dinamica"]
    for (exp, esq), grupo in pd.DataFrame(dinamicas).groupby(["experimento", "esquema"]) \
            if dinamicas else []:
        grupo = grupo.sort_values("arquitectura")
        lineas += [f"## Señas dinámicas · experimento `{exp}` · validación `{esq}`", "",
                   "| Arquitectura | Parámetros | Accuracy | Precisión macro | Recall macro | "
                   "F1 macro | Latencia media (ms) | Latencia p95 (ms) | Tamaño (MB) |",
                   "|---|---:|---:|---:|---:|---:|---:|---:|---:|"]
        for _, c in grupo.iterrows():
            m = c["metricas"]
            lineas.append(
                f"| {c['arquitectura'].upper()} | {c['parametros']} | {_fmt(m['accuracy'])} | "
                f"{_fmt(m['precision_macro'])} | {_fmt(m['recall_macro'])} | "
                f"{_fmt(m['f1_macro'])} | {c['latencia_media_ms']:.2f} | "
                f"{c['latencia_p95_ms']:.2f} | {c['tamano_mb']:.2f} |")
        primera = grupo.iloc[0]
        lineas += ["", f"Videos: {primera['n_videos']} · signers: {primera['n_grupos']} · "
                   f"clases: {', '.join(primera['clases'])}.", ""]

    estaticas = [c for c in corridas if c["tipo"] == "estatica"]
    for c in estaticas:
        m = c["metricas"]
        lineas += [f"## Señas estáticas · {c['arquitectura']} · validación `{c['esquema']}`", "",
                   "Pliegues agrupados por **imagen fuente** (no hay identificador de signer "
                   "en el dataset de imágenes).", "",
                   "| Modelo | Accuracy | Precisión macro | Recall macro | F1 macro | "
                   "Latencia media (ms) | Latencia p95 (ms) | Tamaño (MB) |",
                   "|---|---:|---:|---:|---:|---:|---:|---:|",
                   f"| {c['arquitectura']} | {_fmt(m['accuracy'])} | {_fmt(m['precision_macro'])} | "
                   f"{_fmt(m['recall_macro'])} | {_fmt(m['f1_macro'])} | "
                   f"{c['latencia_media_ms']:.2f} | {c['latencia_p95_ms']:.2f} | "
                   f"{c['tamano_mb']:.2f} |", "",
                   f"Imágenes: {c['n_videos']} · imágenes fuente: {c['n_grupos']} · "
                   f"clases: {len(c['clases'])}.", ""]

    principal = [c for c in dinamicas
                 if c["experimento"] == EXPERIMENTO_PRINCIPAL and c["esquema"] == "kfold"]
    if principal:
        principal.sort(key=lambda c: c["arquitectura"])
        figura_barras([c["arquitectura"].upper() for c in principal],
                      [c["metricas"]["f1_macro"]["media"] for c in principal],
                      [c["metricas"]["f1_macro"]["desviacion"] for c in principal],
                      os.path.join(dir_resultados, "comparacion_f1_macro.png"),
                      f"F1 macro por arquitectura ({principal[0].get('n_pliegues', '?')} pliegues × "
                      f"{principal[0].get('n_semillas', '?')} semillas, agrupado por signer)",
                      "Arquitectura", "F1 macro (media ± DE)", dpi, etiquetas_valor=True)
        lineas += ["![F1 macro por arquitectura](comparacion_f1_macro.png)", ""]

    lineas += ["Corridas incluidas:", ""] + [f"- `{c['directorio']}` (commit `{c['commit'][:12]}`)"
                                            for c in corridas] + [""]
    with open(os.path.join(dir_resultados, "summary_all.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lineas))
    return df
