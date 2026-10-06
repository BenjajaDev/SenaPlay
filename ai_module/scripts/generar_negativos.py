"""
Genera la clase `ninguna` del modelo dinámico: secuencias (T, 527) que NO son
una seña con movimiento.

── Por qué hace falta ───────────────────────────────────────────────────────
En la app el visor manda al TCN cada tramo en que la mano se mueve. Muchos de
esos tramos no son señas dinámicas: son el paso de una letra estática a otra
mientras se deletrea, o la mano acomodándose. Un softmax sin clase de rechazo
siempre elige alguna de sus señas, y con alta confianza (~90% medido con la
mano quieta), así que un umbral de confianza no alcanza: el modelo tiene que
poder responder "esto no es una seña con movimiento".

── Qué genera (todo a partir de datos reales) ───────────────────────────────
  - quieta:   un frame real de un clip del dataset dinámico, sostenido con
              jitter de detección y un leve balanceo del cuerpo.
  - deletreo: el cuerpo/cara de un frame real, y en la mano dominante una
              sucesión de 2-3 formas de letras ESTÁTICAS (de los datasets del
              modelo estático) que se sostienen y transicionan de una a otra
              sin desplazar la muñeca — lo que ve el TCN mientras alguien
              deletrea con el alfabeto estático.

Las formas de mano se normalizan con la misma función que el pipeline
holístico (`_normalizar_forma_mano`), así que quedan en el mismo espacio que
las secuencias reales.

Uso:
    cd ai_module
    python scripts/generar_negativos.py            # 60 secuencias (30 + 30)
    python scripts/generar_negativos.py --por-tipo 40
    python scripts/train_model.py                  # reentrenar con la clase nueva
"""

import argparse
import glob
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np

from model.predict import CLASE_SIN_SEÑA as CLASE_NINGUNA
from scripts.dataset_config_utils import (
    DIR_PROCESSED_LANDMARKS,
    cargar_config,
    guardar_config,
    registrar_seña,
)
from scripts.holistic_pipeline import (
    N_FEATURES_FRAME,
    SLICE_MANO_DER,
    SLICE_MANO_IZQ,
    SLICE_PRESENCIA,
    _normalizar_forma_mano,
)

_DIR_AI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRS_ESTATICOS = [
    os.path.join(_DIR_AI, "data", "landmarks_estaticos"),
    os.path.join(_DIR_AI, "data", "landmarks_kaggle"),
]
# Letras con movimiento: no se usan como forma "estática" del deletreo.
LETRAS_CON_MOVIMIENTO = {"G", "J", "Ñ", "S", "X", "Z"}


def _cargar_formas_estaticas() -> list[np.ndarray]:
    """Formas normalizadas (63,) de todas las muestras de letras estáticas."""
    formas = []
    for directorio in DIRS_ESTATICOS:
        for ruta in glob.glob(os.path.join(directorio, "*", "*.npy")):
            letra = os.path.basename(os.path.dirname(ruta))
            if letra in LETRAS_CON_MOVIMIENTO:
                continue
            lm = np.load(ruta)
            if lm.shape == (21, 3):
                formas.append(_normalizar_forma_mano(lm.astype(np.float32)))
    return formas


def _cargar_clips_reales() -> list[tuple[str, np.ndarray]]:
    """(id de grupo, secuencia (T, 527)) de cada clip real del dataset dinámico."""
    clips = []
    for ruta in sorted(glob.glob(os.path.join(DIR_PROCESSED_LANDMARKS, "*", "*.npy"))):
        if os.path.basename(os.path.dirname(ruta)) == CLASE_NINGUNA:
            continue
        matriz = np.load(ruta)
        if matriz.ndim == 2 and matriz.shape[1] == N_FEATURES_FRAME and len(matriz) >= 10:
            # El id de grupo no puede llevar "_" (separa seña_signante_numero).
            grupo = re.sub(r"[^A-Za-z0-9]+", "-", os.path.splitext(os.path.basename(ruta))[0])
            clips.append((grupo, matriz))
    return clips


def _frame_base(clip: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Un frame real del clip, preferentemente con alguna mano detectada."""
    con_mano = np.where(clip[:, SLICE_PRESENCIA].sum(axis=1) > 0)[0]
    candidatos = con_mano if len(con_mano) else np.arange(len(clip))
    return clip[rng.choice(candidatos)].copy()


def _sostener(frame: np.ndarray, T: int, rng: np.random.Generator) -> np.ndarray:
    """Repite un frame T veces con jitter por frame y un balanceo lento común."""
    seq = np.repeat(frame[None], T, axis=0)
    deriva = np.cumsum(rng.normal(0, 0.002, size=(T, 1)), axis=0)
    detectado = frame[128:] != 0  # pose/cara ausentes quedan en cero, como en el pipeline
    seq[:, 128:] += (deriva + rng.normal(0, 0.008, size=(T, N_FEATURES_FRAME - 128))) * detectado
    manos = np.r_[SLICE_MANO_IZQ.start:SLICE_MANO_DER.stop]
    seq[:, manos] += rng.normal(0, 0.01, size=(T, len(manos)))
    # No inventar landmarks donde no se detectó nada.
    for i, s in enumerate((SLICE_MANO_IZQ, SLICE_MANO_DER)):
        seq[:, s] *= frame[SLICE_PRESENCIA][i]
    return seq.astype(np.float32)


def generar_quieta(clip: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    return _sostener(_frame_base(clip, rng), int(rng.integers(30, 70)), rng)


def generar_deletreo(clip: np.ndarray, formas: list[np.ndarray],
                     rng: np.random.Generator) -> np.ndarray:
    frame = _frame_base(clip, rng)
    presencia = clip[:, SLICE_PRESENCIA].mean(axis=0)
    slot = SLICE_MANO_DER if presencia[1] >= presencia[0] else SLICE_MANO_IZQ
    frame[SLICE_PRESENCIA.start + (1 if slot is SLICE_MANO_DER else 0)] = 1.0

    espejo = rng.random() < 0.5
    letras = [formas[i].reshape(21, 3).copy() for i in rng.choice(len(formas), rng.integers(2, 4))]
    if espejo:
        for f in letras:
            f[:, 0] *= -1

    tramos = []
    for k, forma in enumerate(letras):
        if k:  # transición desde la letra anterior
            n = int(rng.integers(5, 13))
            pesos = np.linspace(0, 1, n + 2)[1:-1, None, None]
            tramos.append(letras[k - 1][None] * (1 - pesos) + forma[None] * pesos)
        tramos.append(np.repeat(forma[None], int(rng.integers(8, 21)), axis=0))
    manos = np.concatenate(tramos)  # (T, 21, 3)

    seq = _sostener(frame, len(manos), rng)
    seq[:, slot] = manos.reshape(len(manos), -1) + rng.normal(0, 0.01, size=(len(manos), 63))
    return seq.astype(np.float32)


def main(por_tipo: int, semilla: int) -> None:
    rng = np.random.default_rng(semilla)
    formas = _cargar_formas_estaticas()
    clips = _cargar_clips_reales()
    if not formas or not clips:
        raise SystemExit("Faltan datos: se necesitan landmarks estáticos y clips dinámicos extraídos.")

    # Solo se reemplazan los sintéticos (prefijo "sint-"): los negativos REALES
    # (videos de deletreo grabados en data/raw_videos/ninguna/ y extraídos con
    # scripts/extract_landmarks.py) conviven en la misma carpeta y se conservan.
    salida = os.path.join(DIR_PROCESSED_LANDMARKS, CLASE_NINGUNA)
    os.makedirs(salida, exist_ok=True)
    for viejo in glob.glob(os.path.join(salida, f"{CLASE_NINGUNA}_sint-*.npy")):
        os.remove(viejo)

    orden = rng.permutation(len(clips))
    for n in range(por_tipo * 2):
        grupo, clip = clips[orden[n % len(clips)]]
        seq = generar_quieta(clip, rng) if n < por_tipo else generar_deletreo(clip, formas, rng)
        np.save(os.path.join(salida, f"{CLASE_NINGUNA}_sint-{grupo}_{n:03d}.npy"), seq)

    config = cargar_config()
    if registrar_seña(config, CLASE_NINGUNA, nombre_visible="Sin seña",
                      descripcion="Negativos sintéticos (mano quieta y deletreo estático). "
                                  "Generada por scripts/generar_negativos.py"):
        guardar_config(config)

    print(f"[Negativos] {por_tipo} quieta + {por_tipo} deletreo → {salida}")
    print(f"[Negativos] Formas estáticas usadas: {len(formas)} · clips reales base: {len(clips)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Genera la clase 'ninguna' del modelo dinámico")
    parser.add_argument("--por-tipo", type=int, default=30)
    parser.add_argument("--semilla", type=int, default=42)
    args = parser.parse_args()
    main(args.por_tipo, args.semilla)
