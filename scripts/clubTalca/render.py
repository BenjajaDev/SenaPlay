"""Render y codificación de un clip: recorte, logo, rótulos borrados y H.264 vía ffmpeg."""
from __future__ import annotations

import subprocess
from pathlib import Path

import cv2
import numpy as np

SIZE = 480
CRF = 28
LOGO_SCALE = 0.62
CAPTION_TOP = 0.40  # el rótulo está en la mitad inferior
CAPTION_GAP = 280  # px a la derecha de la cara donde ya no hay cuerpo
CAPTION_RING_MAX = 60  # brillo mediano del borde: fondo negro = letra; piel = mano
RING_INNER = np.ones((5, 5), np.uint8)
RING_OUTER = np.ones((13, 13), np.uint8)


def hide_captions(frame: np.ndarray, cx: int) -> None:
    """Borra el rótulo con la palabra (es la respuesta del ejercicio).

    En los 16:9 de fondo negro el rótulo crece con una animación hasta quedar
    pegado al brazo, así que no basta con recortar: se pintan de negro las
    manchas blancas a la derecha del cuerpo, en la mitad inferior, pero solo
    si lo que las rodea es fondo negro (una letra). Una mano sobreexpuesta
    también es blanca, pero está rodeada de piel: esa no se toca.
    """
    h, w = frame.shape[:2]
    y0, x0 = int(h * CAPTION_TOP), min(w, cx + CAPTION_GAP)
    region = frame[y0:, x0:]
    if region.size == 0:
        return
    hi, lo = region.max(axis=2).astype(np.int16), region.min(axis=2).astype(np.int16)
    white = ((lo > 190) & (hi - lo < 30)).astype(np.uint8)
    if not white.any():
        return
    count, labels, stats, _ = cv2.connectedComponentsWithStats(white, connectivity=8)
    erase = np.zeros_like(white)
    for i in range(1, count):
        x, y, bw, bh, area = stats[i]
        if area < 4:
            continue
        pad = 12
        ys, xs = slice(max(0, y - pad), y + bh + pad), slice(max(0, x - pad), x + bw + pad)
        blob = (labels[ys, xs] == i).astype(np.uint8)
        ring = cv2.dilate(blob, RING_OUTER) & ~cv2.dilate(blob, RING_INNER) & 1
        values = hi[ys, xs][ring > 0]
        if values.size and np.median(values) < CAPTION_RING_MAX:
            erase[ys, xs] |= blob
    if erase.any():
        region[cv2.dilate(erase, RING_OUTER) > 0] = 0


def render(path: Path, crop: dict, logo: dict | None, cx: int, mask_captions: bool, start: float, end: float, fps: float):
    """Cuadros finales 480 x 480 (BGR) del tramo, con el logo y sin rótulos."""
    step = 2 if fps > 45 else 1
    first, last = int(round(start * fps)), int(round(end * fps))
    cap = cv2.VideoCapture(str(path))
    l, t, side = crop["left"], crop["top"], crop["size"]
    if logo:
        lw = int(logo["width"] * SIZE / side * LOGO_SCALE)
        lh = int(logo["height"] * SIZE / side * LOGO_SCALE)
    i = 0
    while True:
        ok, frame = cap.read()
        if not ok or i >= last:
            break
        if i >= first and (i - first) % step == 0:
            if mask_captions:
                hide_captions(frame, cx)
            out = cv2.resize(frame[t : t + side, l : l + side], (SIZE, SIZE), interpolation=cv2.INTER_AREA)
            if logo:
                patch = frame[logo["top"] : logo["top"] + logo["height"], logo["left"] : logo["left"] + logo["width"]]
                out[6 : 6 + lh, SIZE - lw - 6 : SIZE - 6] = cv2.resize(patch, (lw, lh), interpolation=cv2.INTER_AREA)
            yield out
        i += 1
    cap.release()


def encode(frames, out_fps: float, video: Path, ffmpeg: str) -> int:
    """Codifica los cuadros con ffmpeg (lista de argumentos, sin shell) y devuelve cuántos escribió."""
    cmd = [ffmpeg, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{SIZE}x{SIZE}",
           "-r", f"{out_fps:.3f}", "-i", "-", "-an", "-c:v", "libx264", "-profile:v", "main", "-preset", "slow",
           "-crf", str(CRF), "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(video)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    count = 0
    for frame in frames:
        proc.stdin.write(frame.tobytes())
        count += 1
    proc.stdin.close()
    err = proc.stderr.read().decode(errors="replace")
    if proc.wait() != 0:
        raise RuntimeError(err.strip().splitlines()[-1] if err.strip() else "ffmpeg falló")
    return count
