"""Convierte los clips del Club de Sordos de Talca al formato de `sign_clips`.

Lee `src/features/signs/data/content/clubTalcaClips.json` y los recortes
originales (solo lectura) y escribe, fuera del repositorio:

    <salida>/<clave>/<variante>.mp4    H.264, 480 x 480, <= 30 fps, sin audio
    <salida>/<clave>/<variante>.webp   imagen fija 480 x 480
    <salida>/manifest.json             duración, peso, encuadre y tramo de cada clip

Decisiones (docs/11-contenido-club-talca.md):
- Encuadre cuadrado de la persona. En los videos 16:9 el logo del club queda
  fuera del cuadrado y se copia, del mismo cuadro, a la esquina superior derecha.
- En esos 16:9 se borra el rótulo con la palabra (revelaría la respuesta).
- Se recortan las pausas quietas del inicio y del final (energía de movimiento).
- Un clip que después del recorte dura más de MAX_MS queda excluido.

Uso (Windows, desde la raíz del repo):
    python scripts/clubTalca/convert.py --src <recortes> --out <salida> [--ffmpeg <ffmpeg.exe>] [--only clave1,clave2]

Requiere las dependencias de requirements.txt y un ffmpeg con libx264
(por ejemplo, el que trae imageio-ffmpeg). Módulos: analysis.py y render.py.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import cv2

from analysis import (MAX_MS, MIN_MS, WIDE_MIN_LEFT_BY_TOPIC, active_window, curtain_bounds, find_logo,
                      is_wide, key_frame, read_frames, square_crop)
from render import SIZE, encode, render

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "src" / "features" / "signs" / "data" / "content" / "clubTalcaClips.json"


def convert(entry: dict, src: Path, out: Path, ffmpeg: str) -> dict:
    path = src / entry["topic"] / entry["file"]
    small, fps, w, h, samples, curtain = read_frames(path)
    crop, cx = square_crop(entry["topic"], w, h, samples)
    wide = is_wide(w, h)
    logo = find_logo(samples, w) if wide else None
    mask_captions = wide and entry["topic"] not in WIDE_MIN_LEFT_BY_TOPIC
    start, end = active_window(small, fps, crop, w)
    clean_start, clean_end = curtain_bounds(curtain, small, fps)
    start, end = max(start, clean_start), min(end, clean_end)
    record = {**{k: entry[k] for k in ("topic", "file", "gloss", "key", "variant", "kind")}}
    duration_ms = int(round((end - start) * 1000))
    if duration_ms > MAX_MS or duration_ms < MIN_MS:
        return {**record, "durationMs": duration_ms,
                "excluded": f"dura {duration_ms / 1000:.1f} s tras recortar pausas (límite {MAX_MS / 1000:.0f} s)"}

    folder = out / entry["key"]
    folder.mkdir(parents=True, exist_ok=True)
    video, poster = folder / f"{entry['variant']}.mp4", folder / f"{entry['variant']}.webp"
    out_fps = fps / (2 if fps > 45 else 1)
    count = encode(render(path, crop, logo, cx, mask_captions, start, end, fps), out_fps, video, ffmpeg)
    key_s = key_frame(small, fps, start, end)
    still = next(render(path, crop, logo, cx, mask_captions, key_s, key_s + 1 / fps, fps))
    # imencode + write_bytes: cv2.imwrite no acepta rutas con ñ en Windows.
    ok, encoded = cv2.imencode(".webp", still, [cv2.IMWRITE_WEBP_QUALITY, 80])
    if not ok:
        raise RuntimeError("no se pudo codificar la imagen fija")
    poster.write_bytes(encoded.tobytes())
    return {
        **record,
        "durationMs": int(round(count / out_fps * 1000)),
        "video": f"{entry['key']}/{video.name}",
        "poster": f"{entry['key']}/{poster.name}",
        "videoBytes": video.stat().st_size,
        "posterBytes": poster.stat().st_size,
        "width": SIZE,
        "height": SIZE,
        "editParams": {
            "source": {"width": w, "height": h, "durationMs": int(round(len(small) / fps * 1000)), "file": f"{entry['topic']}/{entry['file']}"},
            "crop": crop,
            "trim": {"startMs": int(round(start * 1000)), "endMs": int(round(end * 1000))},
            "keyFrameMs": int(round(key_s * 1000)),
            "logo": logo,
            "captionsHidden": mask_captions,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--src", required=True, type=Path, help="carpeta recortes/ (solo lectura)")
    parser.add_argument("--out", required=True, type=Path, help="carpeta de salida, fuera del repositorio")
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--only", default="", help="claves separadas por coma (para pruebas)")
    parser.add_argument("--jobs", type=int, default=max(1, (os.cpu_count() or 2) // 2))
    args = parser.parse_args()

    if ROOT in args.out.resolve().parents or args.out.resolve() == ROOT:
        print("La salida debe quedar fuera del repositorio.", file=sys.stderr)
        return 2
    entries = json.loads(CATALOG.read_text(encoding="utf-8"))["clips"]
    only = {k for k in args.only.split(",") if k}
    if only:
        entries = [e for e in entries if e["key"] in only]
    args.out.mkdir(parents=True, exist_ok=True)

    def safe(entry):
        try:
            return convert(entry, args.src, args.out, args.ffmpeg)
        except Exception as error:  # se informa por clip y se sigue con el resto
            return {**entry, "excluded": f"error: {error}"}

    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        results = list(pool.map(safe, entries))

    manifest_path = args.out / "manifest.json"
    if only and manifest_path.exists():
        # Con --only se reemplazan solo esos clips y se conserva el resto del manifiesto.
        fresh = {(r["key"], r["variant"]): r for r in results}
        previous = json.loads(manifest_path.read_text(encoding="utf-8"))["clips"]
        results = [fresh.pop((r["key"], r["variant"]), r) for r in previous] + list(fresh.values())
    manifest = {"source": "Club de Sordos de Talca", "clips": results}
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    ok = [r for r in results if "excluded" not in r]
    total = sum(r["videoBytes"] + r["posterBytes"] for r in ok)
    print(f"{len(ok)} convertidos, {len(results) - len(ok)} excluidos, {total / 1_048_576:.1f} MB en total")
    for r in results:
        if "excluded" in r:
            print(f"  excluido {r['key']} v{r['variant']}: {r['excluded']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
