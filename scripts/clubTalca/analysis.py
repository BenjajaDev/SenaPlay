"""Análisis de un clip del Club de Sordos de Talca: encuadre, tramo, logo y cuadro clave.

Funciones puras sobre los cuadros (no escriben archivos). Las usa convert.py.
"""
from __future__ import annotations

import threading
from pathlib import Path

import cv2
import numpy as np

MIN_MS = 500
MAX_MS = 10000
LEAD_S = 0.20  # margen antes del primer movimiento
TAIL_S = 0.30  # margen después del último movimiento
WIDE_RATIO = 1.2
# En los 16:9 los textos con la palabra (la respuesta) están a la derecha,
# desde x ≈ 1260; el borde derecho del cuadrado no puede pasar de aquí.
WIDE_MAX_RIGHT = 1240
# El_Tiempo es una grabación de videollamada con el rótulo abajo a la izquierda
# (hasta x ≈ 570): el borde izquierdo no puede quedar antes de aquí.
WIDE_MIN_LEFT_BY_TOPIC = {"El_Tiempo": 600}
CURTAIN_MIN = 0.12  # fracción burdeo del cuadro: es la cortina del logo, no la persona
CURTAIN_DIFF = 90  # diferencia media (0-255) con el cuadro típico: los clips normales quedan bajo 60

# CascadeClassifier no es seguro entre hilos: uno por hilo de convert.py.
_local = threading.local()


def _face_detector() -> cv2.CascadeClassifier:
    if not hasattr(_local, "face"):
        _local.face = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    return _local.face


def is_wide(w: int, h: int) -> bool:
    return w > h * WIDE_RATIO


def read_frames(path: Path, width: int = 160):
    """Cuadros en gris y reducidos (para medir movimiento) + fps + tamaño + un cuadro a color cada 0,5 s."""
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise RuntimeError(f"No se pudo abrir {path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    small, samples, curtain, i = [], [], [], 0
    step = max(1, int(round(fps / 2)))
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        tiny = cv2.resize(frame, (width, int(h * width / w))).astype(np.int16)
        b, g, r = tiny[..., 0], tiny[..., 1], tiny[..., 2]
        curtain.append(float(((r > 80) & (r - g > 35) & (r - b > 20)).mean()))
        small.append(cv2.cvtColor(tiny.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.int16))
        if i % step == 0:
            samples.append(frame)
        i += 1
    cap.release()
    if len(small) < 2:
        raise RuntimeError(f"Video vacío: {path}")
    return small, fps, w, h, samples, curtain


def curtain_bounds(curtain: list[float], small, fps: float) -> tuple[float, float]:
    """Tramo sin la cortina del logo (intro u outro del video original).

    Un cuadro es cortina si es mayormente burdeo o si es muy distinto del
    cuadro típico del clip (la cortina rosada o una transición).
    """
    n = len(curtain)
    typical = np.median(np.stack(small), axis=0)
    covered = [
        i for i, value in enumerate(curtain)
        if value > CURTAIN_MIN or np.abs(small[i] - typical).mean() > CURTAIN_DIFF
    ]
    head = [i for i in covered if i < n * 0.3]
    tail = [i for i in covered if i > n * 0.7]
    first = head[-1] + 1 if head else 0
    last = tail[0] if tail else n
    return first / fps, last / fps


def person_center_x(samples) -> int | None:
    xs = []
    for frame in samples:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = _face_detector().detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(90, 90))
        if len(faces):
            x, _, fw, _ = max(faces, key=lambda f: f[2] * f[3])
            xs.append(x + fw / 2)
    return int(np.median(xs)) if xs else None


def square_crop(topic: str, w: int, h: int, samples) -> tuple[dict, int]:
    """Cuadrado de la persona y el centro x de su cara (en el cuadro original)."""
    side = min(w, h)
    if w <= h * WIDE_RATIO:
        # 1100 x 1080: el logo está arriba a la izquierda, se conserva con x = 0.
        return {"left": 0, "top": max(0, (h - side) // 2), "size": side}, w // 2
    cx = person_center_x(samples) or w // 2
    min_left = WIDE_MIN_LEFT_BY_TOPIC.get(topic, 0)
    left = int(cx - side / 2)
    if topic not in WIDE_MIN_LEFT_BY_TOPIC:
        left = min(left, WIDE_MAX_RIGHT - side)
    left = max(min_left, min(left, w - side))
    return {"left": max(0, left), "top": 0, "size": side}, cx


def find_logo(samples, w: int) -> dict | None:
    """Caja del logo (círculo burdeo) arriba a la derecha de un 16:9, o None si no hay."""
    frame = samples[len(samples) // 2]
    x0 = int(w * 0.68)
    region = frame[0 : int(frame.shape[0] * 0.4), x0:w].astype(np.int16)
    b, g, r = region[..., 0], region[..., 1], region[..., 2]
    mask = (r > 80) & (r - g > 35) & (r - b > 20)
    if mask.sum() < 4000:
        return None
    ys, xs = np.nonzero(mask)
    pad = 8
    lx, ly = max(0, xs.min() + x0 - pad), max(0, ys.min() - pad)
    rx, ry = min(w, xs.max() + x0 + pad), ys.max() + pad
    return {"left": int(lx), "top": int(ly), "width": int(rx - lx), "height": int(ry - ly)}


def active_window(small, fps: float, crop: dict, w: int) -> tuple[float, float]:
    """Tramo con movimiento dentro del encuadre: corta las pausas quietas de los extremos."""
    scale = small[0].shape[1] / w
    l, t, s = (int(crop[k] * scale) for k in ("left", "top", "size"))
    diffs = np.array([np.abs(a[t : t + s, l : l + s] - b[t : t + s, l : l + s]).mean() for a, b in zip(small, small[1:])])
    if diffs.size < 3:
        return 0.0, len(small) / fps
    smooth = np.convolve(diffs, np.ones(3) / 3, mode="same")
    floor = np.percentile(smooth, 10)
    threshold = floor + 0.25 * (np.percentile(smooth, 95) - floor)
    active = np.nonzero(smooth > threshold)[0]
    total = len(small) / fps
    if active.size == 0:
        return 0.0, total
    start = max(0.0, active[0] / fps - LEAD_S)
    end = min(total, (active[-1] + 2) / fps + TAIL_S)
    return start, end


def key_frame(small, fps: float, start: float, end: float) -> float:
    """Cuadro más quieto en el centro del tramo: suele ser la mano en su forma más clara."""
    a, b = int((start + (end - start) * 0.3) * fps), int((start + (end - start) * 0.75) * fps)
    if b - a < 2:
        return (start + end) / 2
    diffs = [np.abs(small[i] - small[i - 1]).mean() for i in range(max(1, a), min(b, len(small)))]
    return (max(1, a) + int(np.argmin(diffs))) / fps
