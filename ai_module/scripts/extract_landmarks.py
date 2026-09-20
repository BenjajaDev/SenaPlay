"""
Extrae landmarks holísticos (manos + pose superior + cara reducida) de los
videos crudos en `data/raw_videos/<seña>/*.mp4|*.mov` y guarda un .npy por
video en `data/processed_landmarks/<seña>/<archivo>.npy`, shape (T, 527).

Uso:
    cd ai_module
    python scripts/extract_landmarks.py                  # todas las señas
    python scripts/extract_landmarks.py --señas hola adios
    python scripts/extract_landmarks.py --overwrite       # re-extraer todo

Cualquier seña nueva encontrada en data/raw_videos/ (carpeta que no está
todavía en config/dataset_config.yaml) se registra automáticamente ahí con
`activa: true`, así no hay que editar el YAML a mano para el primer lote.
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import cv2
import numpy as np

from scripts.dataset_config_utils import (
    DIR_PROCESSED_LANDMARKS,
    DIR_RAW_VIDEOS,
    cargar_config,
    carpetas_de_señas,
    guardar_config,
    registrar_seña,
)
from scripts.holistic_pipeline import (
    N_FEATURES_FRAME,
    crear_detector_holistic,
    detectar_frame,
    presencia_manos,
    secuencia_a_matriz,
)

# Ratio mínimo de frames con al menos una mano detectada para aceptar el video
# sin advertencia. Videos por debajo de esto probablemente tienen problemas de
# encuadre/iluminación — se guardan igual, pero se avisa.
MIN_RATIO_CON_MANO = 0.5


def _extraer_video(ruta_video: str, fps_muestreo: int, confianza_deteccion: float,
                    confianza_landmarks: float) -> tuple[np.ndarray, dict]:
    """
    Procesa un video completo y devuelve (matriz (T, 527), estadísticas).

    Si el video fuente tiene más fps que `fps_muestreo`, se descartan frames
    intermedios para acercarse a esa tasa; si tiene menos, se usan todos.
    """
    cap = cv2.VideoCapture(ruta_video)
    if not cap.isOpened():
        raise RuntimeError(f"No se pudo abrir el video: {ruta_video}")

    fps_original = cap.get(cv2.CAP_PROP_FPS) or fps_muestreo
    paso = max(1, round(fps_original / fps_muestreo))

    detector = crear_detector_holistic(
        modo_video=True,
        confianza_deteccion=confianza_deteccion,
        confianza_landmarks=confianza_landmarks,
    )

    frames_detectados = []
    indice = 0
    ts_ms = 0
    paso_ms = int(1000 / fps_muestreo)

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if indice % paso == 0:
                deteccion = detectar_frame(detector, frame, ts_ms)
                frames_detectados.append(deteccion)
                ts_ms += paso_ms
            indice += 1
    finally:
        cap.release()
        detector.close()

    con_mano = sum(1 for f in frames_detectados if any(presencia_manos(f)))
    total = len(frames_detectados)
    stats = {
        "frames": total,
        "ratio_con_mano": round(con_mano / total, 3) if total else 0.0,
    }

    matriz = secuencia_a_matriz(frames_detectados)
    return matriz, stats


def extraer_todo(directorio_raw: str = DIR_RAW_VIDEOS,
                  directorio_salida: str = DIR_PROCESSED_LANDMARKS,
                  señas_filtro: list[str] | None = None,
                  overwrite: bool = False) -> None:
    config = cargar_config()
    formatos = tuple(ext.lower() for ext in config["extraccion"]["formatos_video"])
    fps_muestreo = config["extraccion"]["fps_muestreo"]
    confianza_deteccion = config["extraccion"]["confianza_deteccion"]
    confianza_landmarks = config["extraccion"]["confianza_landmarks"]

    carpetas = carpetas_de_señas(directorio_raw)
    if señas_filtro:
        carpetas = [c for c in carpetas if c in señas_filtro]

    if not carpetas:
        print(f"[Extracción] No hay carpetas de señas en {directorio_raw}. "
              "Crea data/raw_videos/<seña>/ con tus videos y vuelve a correr.")
        return

    config_cambio = False
    for nombre in carpetas:
        if registrar_seña(config, nombre):
            config_cambio = True
            print(f"[Extracción] Seña nueva registrada en dataset_config.yaml: '{nombre}'")
    if config_cambio:
        guardar_config(config)

    print(f"[Extracción] {len(carpetas)} seña(s) a procesar: {carpetas}")
    print(f"[Extracción] fps de muestreo: {fps_muestreo} | vector por frame: {N_FEATURES_FRAME}\n")

    total_videos = total_ok = total_omitidos = 0

    for nombre_seña in carpetas:
        carpeta_in = os.path.join(directorio_raw, nombre_seña)
        carpeta_out = os.path.join(directorio_salida, nombre_seña)
        os.makedirs(carpeta_out, exist_ok=True)

        archivos = sorted([
            f for f in os.listdir(carpeta_in)
            if f.lower().endswith(formatos)
        ])
        if not archivos:
            print(f"  [{nombre_seña}] sin videos ({formatos})")
            continue

        hechos = 0
        for archivo in archivos:
            nombre_base = os.path.splitext(archivo)[0]
            ruta_salida = os.path.join(carpeta_out, f"{nombre_base}.npy")
            total_videos += 1

            if os.path.exists(ruta_salida) and not overwrite:
                total_omitidos += 1
                continue

            ruta_video = os.path.join(carpeta_in, archivo)
            try:
                matriz, stats = _extraer_video(
                    ruta_video, fps_muestreo, confianza_deteccion, confianza_landmarks,
                )
            except Exception as e:
                print(f"    ✗ {archivo}: error al procesar ({e})")
                continue

            if stats["frames"] == 0:
                print(f"    ✗ {archivo}: 0 frames leídos, ¿video corrupto?")
                continue

            np.save(ruta_salida, matriz)
            hechos += 1
            total_ok += 1

            aviso = "" if stats["ratio_con_mano"] >= MIN_RATIO_CON_MANO else \
                f"  ⚠ solo {stats['ratio_con_mano']:.0%} de frames con mano detectada"
            print(f"    ✓ {archivo} → {matriz.shape}{aviso}")

        print(f"  [{nombre_seña}] {hechos}/{len(archivos)} video(s) extraídos "
              f"→ {carpeta_out}")

    print(f"\n[Extracción] Total: {total_ok} extraídos, {total_omitidos} omitidos "
          f"(ya existían, usa --overwrite para re-extraer), {total_videos} videos vistos.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extrae landmarks holísticos de data/raw_videos/")
    parser.add_argument("--señas", nargs="*", default=None,
                        help="Procesar solo estas señas (nombres de carpeta). Por defecto: todas.")
    parser.add_argument("--overwrite", action="store_true",
                        help="Re-extraer videos que ya tienen .npy de salida.")
    args = parser.parse_args()

    extraer_todo(señas_filtro=args.señas, overwrite=args.overwrite)
