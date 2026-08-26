"""
Captura de señas DINÁMICAS con webcam, para construir el dataset LSCh propio.

Graba N repeticiones de una seña. Por cada repetición guarda DOS cosas:

  1. El video crudo (.mp4)  → data/raw_dinamicas/<seña>/
  2. Los landmarks (.npz)   → data/landmarks_dinamicos/<seña>/

Guardar el video crudo es deliberado y NO es redundante: si más adelante cambia
el preprocesamiento (por ejemplo, al pasar a volúmenes de heatmaps para el 3D
CNN, o si sube la versión de MediaPipe), se re-extraen los landmarks desde los
videos en vez de repetir semanas de grabación. Los landmarks son derivados;
el video es el dato fuente.

Uso:
    python data/capturar_dinamicas.py --seña hola --repeticiones 30 --sesion benja_01

Teclas durante la captura:
    ESPACIO  → grabar una repetición (con cuenta regresiva)
    R        → descartar la última repetición y repetirla
    Q / ESC  → salir (lo ya grabado se conserva)

Recomendación de protocolo para que el dataset generalice:
    - Varias sesiones con ropa/fondo/iluminación distintos
    - Varias personas si es posible (es la fuente de varianza más valiosa)
    - Velocidades distintas: algunas repeticiones lentas, otras rápidas
    - Pequeños cambios de ángulo y distancia a la cámara
"""

import argparse
import json
import os
import time

import cv2
import numpy as np

from holistic_landmarks import (
    crear_detector_holistic,
    detectar_frame,
    presencia_manos,
    secuencia_a_matriz,
)

# ── Rutas por defecto ─────────────────────────────────────────────────────────

_DIR_AI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR_VIDEOS = os.path.join(_DIR_AI, "data", "raw_dinamicas")
DIR_LANDMARKS = os.path.join(_DIR_AI, "data", "landmarks_dinamicos")

# Calidad mínima para aceptar una repetición automáticamente
MIN_RATIO_CON_MANO = 0.70  # ≥70% de los frames deben tener al menos una mano


# ── Utilidades de dibujo ──────────────────────────────────────────────────────

def _dibujar_mano(frame, mano, color):
    """Dibuja los 21 puntos de una mano sobre el frame BGR."""
    if mano is None:
        return
    alto, ancho = frame.shape[:2]
    for (x, y, _z) in mano:
        cv2.circle(frame, (int(x * ancho), int(y * alto)), 3, color, -1)


def _dibujar_hud(frame, seña, hecho, total, estado, color_estado, izq, der):
    """Overlay con el progreso y el estado de detección de cada mano."""
    cv2.putText(frame, f"{seña}  {hecho}/{total}", (10, 32),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
    cv2.putText(frame, estado, (10, 68),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, color_estado, 2)

    # Indicadores de mano: verde detectada, rojo ausente
    for i, (etiqueta, presente) in enumerate([("IZQ", izq), ("DER", der)]):
        color = (0, 200, 0) if presente else (0, 0, 200)
        cv2.putText(frame, etiqueta, (10 + i * 70, 105),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

    cv2.putText(frame, "ESPACIO=grabar  R=repetir  Q=salir",
                (10, frame.shape[0] - 15),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)


# ── Grabación de una repetición ───────────────────────────────────────────────

def _grabar_repeticion(cap, detector, seña, duracion_s, fps, ventana, ts_base):
    """
    Graba una repetición completa: cuenta regresiva + ventana de grabación.

    Devuelve (frames_bgr, frames_landmarks, timestamp_final).
    """
    # ── Cuenta regresiva ──
    for n in (3, 2, 1):
        t_fin = time.time() + 0.8
        while time.time() < t_fin:
            ok, frame = cap.read()
            if not ok:
                break
            frame = cv2.flip(frame, 1)
            cv2.putText(frame, str(n), (frame.shape[1] // 2 - 30, frame.shape[0] // 2),
                        cv2.FONT_HERSHEY_SIMPLEX, 4.0, (0, 200, 255), 8)
            cv2.imshow(ventana, frame)
            cv2.waitKey(1)

    # ── Grabación ──
    frames_bgr: list[np.ndarray] = []
    frames_lm: list[dict] = []
    n_objetivo = int(duracion_s * fps)
    ts = ts_base

    while len(frames_bgr) < n_objetivo:
        ok, frame = cap.read()
        if not ok:
            break
        frame = cv2.flip(frame, 1)  # espejo: el signante se ve natural

        ts += int(1000 / fps)
        deteccion = detectar_frame(detector, frame, ts)

        frames_bgr.append(frame.copy())
        frames_lm.append(deteccion)

        izq, der = presencia_manos(deteccion)
        _dibujar_mano(frame, deteccion["mano_izq"], (0, 255, 255))
        _dibujar_mano(frame, deteccion["mano_der"], (255, 200, 0))

        progreso = len(frames_bgr) / n_objetivo
        cv2.rectangle(frame, (0, 0), (int(frame.shape[1] * progreso), 8), (0, 0, 255), -1)
        _dibujar_hud(frame, seña, len(frames_bgr), n_objetivo, "GRABANDO", (0, 0, 255), izq, der)

        cv2.imshow(ventana, frame)
        if (cv2.waitKey(1) & 0xFF) in (ord('q'), 27):
            break

    return frames_bgr, frames_lm, ts


def _evaluar_calidad(frames_lm: list[dict]) -> dict:
    """Mide qué tan utilizable es una repetición antes de guardarla."""
    total = len(frames_lm)
    if total == 0:
        return {"total": 0, "ratio_con_mano": 0.0, "ratio_bimanual": 0.0, "aceptable": False}

    con_mano = bimanual = 0
    for f in frames_lm:
        izq, der = presencia_manos(f)
        if izq or der:
            con_mano += 1
        if izq and der:
            bimanual += 1

    ratio = con_mano / total
    return {
        "total": total,
        "ratio_con_mano": round(ratio, 3),
        "ratio_bimanual": round(bimanual / total, 3),
        "aceptable": ratio >= MIN_RATIO_CON_MANO,
    }


def _guardar(seña, sesion, indice, frames_bgr, frames_lm, fps, calidad):
    """Escribe el video crudo y los landmarks de una repetición."""
    dir_video = os.path.join(DIR_VIDEOS, seña)
    dir_lm = os.path.join(DIR_LANDMARKS, seña)
    os.makedirs(dir_video, exist_ok=True)
    os.makedirs(dir_lm, exist_ok=True)

    base = f"{seña}_{sesion}_{indice:03d}"

    # ── Video crudo ──
    alto, ancho = frames_bgr[0].shape[:2]
    escritor = cv2.VideoWriter(
        os.path.join(dir_video, f"{base}.mp4"),
        cv2.VideoWriter_fourcc(*"mp4v"), fps, (ancho, alto),
    )
    for f in frames_bgr:
        escritor.write(f)
    escritor.release()

    # ── Landmarks ──
    # Se guarda la matriz de features lista para entrenar y, además, los
    # landmarks crudos por parte, por si el preprocesamiento cambia.
    matriz = secuencia_a_matriz(frames_lm)
    manos_izq = np.stack([
        f["mano_izq"] if f["mano_izq"] is not None else np.zeros((21, 3), np.float32)
        for f in frames_lm
    ])
    manos_der = np.stack([
        f["mano_der"] if f["mano_der"] is not None else np.zeros((21, 3), np.float32)
        for f in frames_lm
    ])
    poses = np.stack([
        f["pose"] if f["pose"] is not None else np.zeros((33, 3), np.float32)
        for f in frames_lm
    ])
    presencias = np.array([presencia_manos(f) for f in frames_lm], dtype=np.float32)

    np.savez_compressed(
        os.path.join(dir_lm, f"{base}.npz"),
        features=matriz,
        mano_izq=manos_izq,
        mano_der=manos_der,
        pose=poses,
        presencia=presencias,
        meta=json.dumps({"seña": seña, "sesion": sesion, "fps": fps, "calidad": calidad}),
    )
    return base


# ── Bucle principal ───────────────────────────────────────────────────────────

def capturar(seña: str, repeticiones: int, sesion: str, duracion: float,
             fps: int, camara: int):
    ventana = f"Captura LSCh: {seña}"
    cap = cv2.VideoCapture(camara)
    if not cap.isOpened():
        raise RuntimeError(f"No se pudo abrir la cámara {camara}")
    cap.set(cv2.CAP_PROP_FPS, fps)

    detector = crear_detector_holistic(modo_video=True)

    # Continuar la numeración si ya hay repeticiones de esta sesión
    dir_lm = os.path.join(DIR_LANDMARKS, seña)
    existentes = 0
    if os.path.isdir(dir_lm):
        existentes = len([f for f in os.listdir(dir_lm)
                          if f.startswith(f"{seña}_{sesion}_") and f.endswith(".npz")])

    print(f"\n[Captura] Seña '{seña}' | sesión '{sesion}' | {repeticiones} repeticiones")
    print(f"[Captura] Ventana de {duracion}s a {fps}fps ({int(duracion * fps)} frames)")
    if existentes:
        print(f"[Captura] Ya existen {existentes} de esta sesión, se continúa desde ahí")
    print("[Captura] ESPACIO=grabar  R=repetir última  Q=salir\n")

    hechas = 0
    ultima = None  # (base, calidad) de la última guardada, para poder deshacer
    ts = 0

    try:
        while hechas < repeticiones:
            ok, frame = cap.read()
            if not ok:
                break
            frame = cv2.flip(frame, 1)

            ts += int(1000 / fps)
            deteccion = detectar_frame(detector, frame, ts)
            izq, der = presencia_manos(deteccion)

            _dibujar_mano(frame, deteccion["mano_izq"], (0, 255, 255))
            _dibujar_mano(frame, deteccion["mano_der"], (255, 200, 0))
            _dibujar_hud(frame, seña, hechas, repeticiones, "LISTO", (0, 200, 0), izq, der)
            cv2.imshow(ventana, frame)

            tecla = cv2.waitKey(1) & 0xFF

            if tecla == ord(' '):
                frames_bgr, frames_lm, ts = _grabar_repeticion(
                    cap, detector, seña, duracion, fps, ventana, ts
                )
                if not frames_bgr:
                    continue

                calidad = _evaluar_calidad(frames_lm)
                indice = existentes + hechas

                if not calidad["aceptable"]:
                    print(f"  ⚠ Repetición descartada: solo {calidad['ratio_con_mano']:.0%} "
                          f"de los frames tienen mano (mínimo {MIN_RATIO_CON_MANO:.0%}). "
                          f"Revisa encuadre e iluminación.")
                    continue

                base = _guardar(seña, sesion, indice, frames_bgr, frames_lm, fps, calidad)
                hechas += 1
                ultima = base
                print(f"  ✓ {base}  |  mano: {calidad['ratio_con_mano']:.0%}  "
                      f"bimanual: {calidad['ratio_bimanual']:.0%}  ({hechas}/{repeticiones})")

            elif tecla == ord('r') and ultima:
                for carpeta, ext in ((DIR_VIDEOS, ".mp4"), (DIR_LANDMARKS, ".npz")):
                    ruta = os.path.join(carpeta, seña, ultima + ext)
                    if os.path.exists(ruta):
                        os.remove(ruta)
                hechas -= 1
                print(f"  ↺ Descartada {ultima}, repítela")
                ultima = None

            elif tecla in (ord('q'), 27):
                break

    finally:
        cap.release()
        cv2.destroyAllWindows()
        detector.close()

    print(f"\n[Captura] {hechas} repeticiones nuevas de '{seña}'")
    print(f"[Captura] Videos    → {os.path.join(DIR_VIDEOS, seña)}")
    print(f"[Captura] Landmarks → {os.path.join(DIR_LANDMARKS, seña)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Captura señas dinámicas LSCh con webcam")
    parser.add_argument("--seña", required=True, help="Nombre de la seña (ej: hola)")
    parser.add_argument("--repeticiones", type=int, default=30)
    parser.add_argument("--sesion", default="s01",
                        help="Etiqueta de sesión/persona. Cambiarla entre grabaciones "
                             "permite hacer el split por sesión y evitar leakage.")
    parser.add_argument("--duracion", type=float, default=2.0, help="Segundos por repetición")
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--camara", type=int, default=0)
    args = parser.parse_args()

    capturar(args.seña, args.repeticiones, args.sesion,
             args.duracion, args.fps, args.camara)
