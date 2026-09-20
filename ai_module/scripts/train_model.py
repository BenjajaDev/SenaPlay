"""
Entrena el clasificador de señas DINÁMICAS multiclase (un solo modelo para
todo el repertorio) sobre los vectores holísticos de
`data/processed_landmarks/<seña>/*.npy` (secuencias (T, 527) producidas por
`scripts/extract_landmarks.py`).

Arquitectura: TCN (ver model/tcn.py — CNN 1D dilatada, sin recurrencia).

Uso:
    cd ai_module
    python scripts/train_model.py                    # usa dataset_config.yaml
    python scripts/train_model.py --epocas 120 --batch 16
    python scripts/train_model.py --señas hola adios  # solo estas clases

Es "por lotes": agregar una seña nueva es agregar su carpeta en
data/raw_videos/, extraer landmarks, y volver a correr este script — no hay
lista de clases hardcodeada, se descubre desde las carpetas de
data/processed_landmarks/ (o desde `--señas`). Ver scripts/add_new_signs.py
para el flujo guiado completo.
"""

import argparse
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import accuracy_score, classification_report, f1_score

from model.tcn import ModeloTCN
from scripts.augmentation import aumentar_secuencia
from scripts.dataset_config_utils import (
    DIR_MODELOS,
    DIR_PROCESSED_LANDMARKS,
    cargar_config,
    carpetas_de_señas,
    señas_activas,
)
from scripts.holistic_pipeline import N_FEATURES_FRAME, remuestrear_temporal


# ── Carga del dataset ─────────────────────────────────────────────────────────

_PATRON_SIGNANTE = re.compile(r"^(?P<seña>.+?)_(?P<signante>.+?)_(?P<numero>\d+)$")


def _signante_de_archivo(nombre_seña: str, nombre_archivo: str) -> str:
    """
    Extrae el id de signante del nombre de archivo si sigue la convención
    `<seña>_<signante>_<numero>.npy`. Si no matchea, devuelve el nombre de
    archivo completo (cada archivo queda como su propio "grupo" — el split
    sigue funcionando, solo pierde la garantía de no partir a un signante
    entre train/val/test).
    """
    stem = os.path.splitext(nombre_archivo)[0]
    m = _PATRON_SIGNANTE.match(stem)
    if m and m.group("seña") == nombre_seña:
        return m.group("signante")
    return stem


def cargar_dataset(directorio: str, señas: list[str], longitud_secuencia: int):
    """
    Devuelve:
        secuencias: list[np.ndarray]  — cada una (longitud_secuencia, 527)
        etiquetas_idx: list[int]
        signantes: list[str]          — id de grupo para el split
        etiquetas: list[str]          — nombres de clase, orden = índice
    """
    etiquetas = sorted(señas)
    mapa = {nombre: i for i, nombre in enumerate(etiquetas)}

    secuencias, etiquetas_idx, signantes = [], [], []

    for nombre_seña in etiquetas:
        carpeta = os.path.join(directorio, nombre_seña)
        if not os.path.isdir(carpeta):
            print(f"  ⚠ [{nombre_seña}] sin data/processed_landmarks/{nombre_seña}/ — "
                  f"¿corriste scripts/extract_landmarks.py?")
            continue

        archivos = sorted(f for f in os.listdir(carpeta) if f.endswith(".npy"))
        for archivo in archivos:
            matriz = np.load(os.path.join(carpeta, archivo))
            if matriz.ndim != 2 or matriz.shape[1] != N_FEATURES_FRAME:
                print(f"    ✗ {archivo}: shape inesperado {matriz.shape}, se omite")
                continue

            secuencias.append(remuestrear_temporal(matriz, longitud_secuencia))
            etiquetas_idx.append(mapa[nombre_seña])
            signantes.append(_signante_de_archivo(nombre_seña, archivo))

        print(f"  [{nombre_seña}] {len(archivos)} secuencia(s) cargadas")

    return secuencias, etiquetas_idx, signantes, etiquetas


# ── Split estratificado por clase, agrupado por signante ─────────────────────

def _split_grupo(indices: list[int], grupos: list[str], ratios: tuple[float, float, float],
                  rng: np.random.Generator) -> tuple[list[int], list[int], list[int]]:
    """Reparte `indices` en train/val/test sin partir un mismo grupo (signante) entre splits."""
    por_grupo: dict[str, list[int]] = {}
    for idx, g in zip(indices, grupos):
        por_grupo.setdefault(g, []).append(idx)

    claves = list(por_grupo.keys())
    rng.shuffle(claves)

    total = len(indices)
    objetivo_train = ratios[0] * total
    objetivo_val = ratios[1] * total

    train, val, test = [], [], []
    for clave in claves:
        grupo = por_grupo[clave]
        if len(train) < objetivo_train:
            train.extend(grupo)
        elif len(val) < objetivo_val:
            val.extend(grupo)
        else:
            test.extend(grupo)

    # Con datasets chicos por clase, val o test pueden quedar vacíos si todos
    # los grupos son grandes. Garantizamos al menos 1 muestra en cada split
    # cuando hay 3+ muestras, moviendo desde el split más grande.
    for destino in (val, test):
        if not destino and len(train) > 1:
            destino.append(train.pop())

    return train, val, test


def dividir_dataset(etiquetas_idx: list[int], signantes: list[str],
                     ratios: tuple[float, float, float], semilla: int):
    rng = np.random.default_rng(semilla)
    etiquetas_arr = np.array(etiquetas_idx)

    idx_train, idx_val, idx_test = [], [], []
    for clase in sorted(set(etiquetas_idx)):
        indices_clase = np.where(etiquetas_arr == clase)[0].tolist()
        grupos_clase = [signantes[i] for i in indices_clase]
        t, v, te = _split_grupo(indices_clase, grupos_clase, ratios, rng)
        idx_train += t
        idx_val += v
        idx_test += te

    return idx_train, idx_val, idx_test


# ── Entrenamiento ─────────────────────────────────────────────────────────────

def _preparar_tensores(secuencias, etiquetas_idx, indices, augmentar: bool,
                        variaciones: int, config_aug: dict):
    X, y = [], []
    for i in indices:
        X.append(secuencias[i])
        y.append(etiquetas_idx[i])
        if augmentar:
            for _ in range(variaciones):
                X.append(aumentar_secuencia(secuencias[i], config_aug))
                y.append(etiquetas_idx[i])
    return (torch.tensor(np.stack(X), dtype=torch.float32),
            torch.tensor(np.array(y), dtype=torch.long))


def entrenar(config: dict, señas_filtro: list[str] | None = None,
             ruta_salida: str | None = None):
    cfg_extraccion = config["extraccion"]
    cfg_entrenamiento = config["entrenamiento"]
    cfg_aug = config["augmentacion"]

    señas = señas_filtro or señas_activas(config)
    if not señas:
        señas = carpetas_de_señas(DIR_PROCESSED_LANDMARKS)
    if len(señas) < 2:
        raise ValueError(
            f"Se necesitan al menos 2 señas con datos extraídos para entrenar "
            f"multiclase. Encontradas: {señas}. Corre scripts/extract_landmarks.py primero."
        )

    longitud_secuencia = cfg_entrenamiento["longitud_secuencia"]
    print(f"[Entrenamiento] Señas: {señas}")
    print(f"[Entrenamiento] Cargando desde: {DIR_PROCESSED_LANDMARKS}")

    secuencias, etiquetas_idx, signantes, etiquetas = cargar_dataset(
        DIR_PROCESSED_LANDMARKS, señas, longitud_secuencia,
    )
    if len(secuencias) == 0:
        raise ValueError("No se cargó ninguna secuencia. Revisa data/processed_landmarks/.")

    ratios = (cfg_entrenamiento["split_train"], cfg_entrenamiento["split_val"],
              cfg_entrenamiento["split_test"])
    idx_train, idx_val, idx_test = dividir_dataset(
        etiquetas_idx, signantes, ratios, cfg_entrenamiento["semilla"],
    )
    print(f"[Entrenamiento] Split → train={len(idx_train)} val={len(idx_val)} test={len(idx_test)}")

    X_train, y_train = _preparar_tensores(
        secuencias, etiquetas_idx, idx_train, augmentar=True,
        variaciones=cfg_aug["variaciones_por_muestra"], config_aug=cfg_aug,
    )
    X_val, y_val = _preparar_tensores(secuencias, etiquetas_idx, idx_val, augmentar=False,
                                       variaciones=0, config_aug=cfg_aug)
    X_test, y_test = _preparar_tensores(secuencias, etiquetas_idx, idx_test, augmentar=False,
                                         variaciones=0, config_aug=cfg_aug)
    print(f"[Entrenamiento] Tras augmentación → train={len(X_train)} muestras")

    dispositivo = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[Entrenamiento] Dispositivo: {dispositivo}")

    modelo = ModeloTCN(entrada=N_FEATURES_FRAME, clases=len(etiquetas)).to(dispositivo)
    optimizador = torch.optim.Adam(modelo.parameters(),
                                    lr=cfg_entrenamiento["learning_rate"], weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizador, patience=6, factor=0.5)
    criterio = nn.CrossEntropyLoss()

    batch = cfg_entrenamiento["batch_size"]
    epocas = cfg_entrenamiento["epocas"]
    ds_train = torch.utils.data.TensorDataset(X_train, y_train)
    dl_train = torch.utils.data.DataLoader(ds_train, batch_size=batch, shuffle=True)

    X_val, y_val = X_val.to(dispositivo), y_val.to(dispositivo)

    ruta_salida = ruta_salida or os.path.join(DIR_MODELOS, "dinamico_tcn.pt")
    os.makedirs(os.path.dirname(ruta_salida), exist_ok=True)
    mejor_f1 = -1.0

    for epoca in range(1, epocas + 1):
        modelo.train()
        perdida_total = 0.0
        for lote_X, lote_y in dl_train:
            lote_X, lote_y = lote_X.to(dispositivo), lote_y.to(dispositivo)
            optimizador.zero_grad()
            logits = modelo(lote_X)
            perdida = criterio(logits, lote_y)
            perdida.backward()
            nn.utils.clip_grad_norm_(modelo.parameters(), max_norm=1.0)
            optimizador.step()
            perdida_total += perdida.item()

        modelo.eval()
        with torch.no_grad():
            logits_val = modelo(X_val)
            perdida_val = criterio(logits_val, y_val).item()
            pred_val = logits_val.argmax(dim=-1).cpu().numpy()
        acc_val = accuracy_score(y_val.cpu().numpy(), pred_val)
        f1_val = f1_score(y_val.cpu().numpy(), pred_val, average="macro", zero_division=0)
        scheduler.step(perdida_val)

        if epoca % 5 == 0 or f1_val > mejor_f1:
            print(f"  Época {epoca:3d}/{epocas} | Loss train: {perdida_total/len(dl_train):.4f} "
                  f"| Loss val: {perdida_val:.4f} | Val Acc: {acc_val:.3f} | Val F1: {f1_val:.3f}")

        if f1_val > mejor_f1:
            mejor_f1 = f1_val
            torch.save({
                "estado": modelo.state_dict(),
                "etiquetas": etiquetas,
                "longitud_secuencia": longitud_secuencia,
                "entrada": N_FEATURES_FRAME,
            }, ruta_salida)

    print(f"\n[Entrenamiento] Mejor F1 macro (val) = {mejor_f1:.3f} → guardado en {ruta_salida}")

    # ── Evaluación final en test, con el MEJOR checkpoint ──
    if len(X_test) > 0:
        checkpoint = torch.load(ruta_salida, map_location=dispositivo)
        modelo.load_state_dict(checkpoint["estado"])
        modelo.eval()
        with torch.no_grad():
            pred_test = modelo(X_test.to(dispositivo)).argmax(dim=-1).cpu().numpy()
        print("\n[Test] Reporte por clase:")
        print(classification_report(y_test.numpy(), pred_test, target_names=etiquetas,
                                     zero_division=0))
    else:
        print("\n[Test] Split de test vacío (dataset muy chico) — sin evaluación final.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Entrena el clasificador de señas dinámicas (TCN)")
    parser.add_argument("--señas", nargs="*", default=None,
                        help="Entrenar solo con estas señas. Por defecto: todas las activas en dataset_config.yaml.")
    parser.add_argument("--salida", default=None,
                        help="Ruta del checkpoint de salida. Por defecto: data/models/dinamico_tcn.pt")
    parser.add_argument("--epocas", type=int, default=None)
    parser.add_argument("--batch", type=int, default=None)
    parser.add_argument("--lr", type=float, default=None)
    args = parser.parse_args()

    config = cargar_config()
    if args.epocas:
        config["entrenamiento"]["epocas"] = args.epocas
    if args.batch:
        config["entrenamiento"]["batch_size"] = args.batch
    if args.lr:
        config["entrenamiento"]["learning_rate"] = args.lr

    entrenar(config, señas_filtro=args.señas, ruta_salida=args.salida)
