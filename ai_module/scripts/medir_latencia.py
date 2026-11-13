"""
Latencia del servidor por etapa, con cuadros sintéticos (pendiente de la
sección 4.3.5 de la tesis).

Mide /clasificar_frames en el proceso, con cada modelo dinámico (tcn y lstm):

    decodificacion   validar + decodificar los JPEG del tramo (base64 → imagen)
    crear_detector   crear el HolisticLandmarker (el servidor crea uno por petición)
    mediapipe        detectar_frame sobre todos los cuadros del tramo
    modelo           ranking del modelo dinámico (features + red) sobre la secuencia
    total            la petición completa con TestClient: JSON, validación,
                     las etapas anteriores, barreras y respuesta

NO incluye la red ni el teléfono. Los cuadros son sintéticos y SIN personas:
MediaPipe no encuentra manos ni cara, así que no corre los modelos de
landmarks de mano y cara, y su tiempo es una COTA INFERIOR del de un tramo
real (para eso está la prueba con la app, docs/ai/integracion_verificacion.md).
La etapa `modelo` usa una secuencia cruda sintética con manos, pose y cara, así
que sí recorre el camino completo de features.

CPU con 1 hilo: torch.set_num_threads(1), cv2.setNumThreads(1) y
OMP_NUM_THREADS / MKL_NUM_THREADS = 1 antes de importar nada. MediaPipe
(XNNPACK) maneja sus propios hilos y no se puede limitar desde Python; queda
anotado en el entorno.

    cd ai_module
    .venv/Scripts/python.exe -m scripts.medir_latencia

Salidas en docs/tesis/resultados_ia/integracion/:
    latencia_servidor.csv          una fila por medición (modelo, etapa, repetición, ms)
    latencia_servidor_resumen.csv  mediana, media, p5, p95, mín. y máx. por modelo y etapa
    entorno_latencia.json          commit, CPU, hilos, parámetros y pip freeze
"""

from __future__ import annotations

import os

for _variable in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS"):
    os.environ[_variable] = "1"

import argparse  # noqa: E402
import base64  # noqa: E402
import json  # noqa: E402
import platform  # noqa: E402
import subprocess  # noqa: E402
import sys  # noqa: E402
import time  # noqa: E402
from datetime import datetime, timezone  # noqa: E402

import numpy as np  # noqa: E402

DIR_MODULO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDAS = os.path.join(DIR_MODULO, "..", "docs", "tesis", "resultados_ia", "integracion")
ETAPAS = ("decodificacion", "crear_detector", "mediapipe", "modelo", "total")


def _cuadros_sinteticos(cantidad: int, ancho: int, alto: int, calidad: int, semilla: int) -> list[str]:
    """JPEG como los del visor (≤ 480 px de ancho, calidad 0,7), con ruido y degradados; sin personas."""
    import cv2

    rng = np.random.default_rng(semilla)
    base = np.tile(np.linspace(40, 220, ancho, dtype=np.float32), (alto, 1))
    cuadros = []
    for i in range(cantidad):
        imagen = base[..., None].repeat(3, 2) + rng.normal(0, 25, (alto, ancho, 3)) + i
        ok, jpeg = cv2.imencode(".jpg", np.clip(imagen, 0, 255).astype(np.uint8),
                                [cv2.IMWRITE_JPEG_QUALITY, calidad])
        assert ok
        cuadros.append("data:image/jpeg;base64," + base64.b64encode(jpeg.tobytes()).decode())
    return cuadros


def _ms(inicio: float) -> float:
    return (time.perf_counter() - inicio) * 1000


def medir_modelo(modo: str, cuadros: list[str], fps: float, calentamiento: int, mediciones: int,
                 semilla: int) -> list[dict]:
    from fastapi.testclient import TestClient

    import server
    from inferencia import entrada
    from inferencia.ajustes import cargar_ajustes
    from preprocessing import extraction
    from tests.sintetico import secuencia_sintetica

    ajustes = cargar_ajustes(modelo_dinamico=modo)
    filas = []
    with TestClient(server.crear_app(ajustes)) as cliente:
        modelo = cliente.app.state.modelo_dinamico
        cfg = dict(modelo.cfg_extraccion)
        cruda_modelo = secuencia_sintetica(0, 0, np.random.default_rng(semilla))
        paso_ms = max(1, round(1000 / fps))
        for repeticion in range(calentamiento + mediciones):
            tiempos = {}

            t = time.perf_counter()
            jpegs = entrada.validar_cuadros(cuadros, ajustes.max_cuadros_tramo, ajustes.max_bytes_cuadro)
            imagenes = entrada.decodificar_cuadros(jpegs)
            tiempos["decodificacion"] = _ms(t)

            t = time.perf_counter()
            detector = extraction.crear_detector(cfg, modo_video=True)
            tiempos["crear_detector"] = _ms(t)
            try:
                t = time.perf_counter()
                for indice, imagen in imagenes:
                    extraction.detectar_frame(detector, imagen, indice * paso_ms)
                tiempos["mediapipe"] = _ms(t)
            finally:
                detector.close()

            t = time.perf_counter()
            modelo.ranking(cruda_modelo)
            tiempos["modelo"] = _ms(t)

            t = time.perf_counter()
            r = cliente.post("/clasificar_frames", json={"frames": cuadros, "fps": fps})
            tiempos["total"] = _ms(t)
            if r.status_code != 200:
                raise RuntimeError(f"/clasificar_frames respondió {r.status_code}: {r.text[:200]}")

            if repeticion >= calentamiento:
                for etapa in ETAPAS:
                    filas.append({"modelo": modo, "etapa": etapa, "repeticion": repeticion - calentamiento,
                                  "cuadros": len(cuadros), "ms": round(tiempos[etapa], 3)})
    return filas


def _commit() -> str:
    def git(*args: str) -> str:
        return subprocess.run(["git", *args], cwd=DIR_MODULO, capture_output=True, text=True).stdout.strip()
    sucio = git("status", "--porcelain", "--untracked-files=no", "--", ".")
    return git("rev-parse", "HEAD") + ("-dirty" if sucio else "")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Latencia del servidor por etapa")
    parser.add_argument("--cuadros", type=int, default=30, help="cuadros por tramo (el visor manda ~15 a 51)")
    parser.add_argument("--ancho", type=int, default=480)
    parser.add_argument("--alto", type=int, default=360)
    parser.add_argument("--calidad", type=int, default=70)
    parser.add_argument("--fps", type=float, default=15.0)
    parser.add_argument("--calentamiento", type=int, default=20)
    parser.add_argument("--mediciones", type=int, default=200)
    parser.add_argument("--modelos", nargs="+", default=["tcn", "lstm"], choices=["tcn", "lstm"])
    parser.add_argument("--semilla", type=int, default=20261031)
    parser.add_argument("--salidas", default=SALIDAS)
    args = parser.parse_args(argv)

    os.chdir(DIR_MODULO)
    sys.path.insert(0, DIR_MODULO)
    import cv2
    import pandas as pd
    import torch

    torch.set_num_threads(1)
    cv2.setNumThreads(1)

    commit = _commit()
    cuadros = _cuadros_sinteticos(args.cuadros, args.ancho, args.alto, args.calidad, args.semilla)
    filas = []
    for modo in args.modelos:
        print(f"[latencia] {modo}: {args.calentamiento} de calentamiento + {args.mediciones} mediciones…")
        filas += medir_modelo(modo, cuadros, args.fps, args.calentamiento, args.mediciones, args.semilla)

    tabla = pd.DataFrame(filas)
    salidas = os.path.abspath(args.salidas)
    os.makedirs(salidas, exist_ok=True)
    tabla.to_csv(os.path.join(salidas, "latencia_servidor.csv"), index=False)
    resumen = (tabla.groupby(["modelo", "etapa"], sort=False)["ms"]
               .agg(n="count", mediana="median", media="mean",
                    p5=lambda s: s.quantile(0.05), p95=lambda s: s.quantile(0.95),
                    minimo="min", maximo="max").round(2).reset_index())
    resumen.to_csv(os.path.join(salidas, "latencia_servidor_resumen.csv"), index=False)

    congelado = subprocess.run([sys.executable, "-m", "pip", "freeze"], capture_output=True,
                               text=True).stdout.splitlines()
    entorno = {
        "fecha_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "commit": commit, "script": "ai_module/scripts/medir_latencia.py",
        "python": sys.version, "plataforma": platform.platform(), "procesador": platform.processor(),
        "nucleos_logicos": os.cpu_count(), "torch_hilos": torch.get_num_threads(),
        "cv2_hilos": cv2.getNumThreads(),
        "omp_mkl_openblas_hilos": {v: os.environ.get(v) for v in ("OMP_NUM_THREADS", "MKL_NUM_THREADS",
                                                                 "OPENBLAS_NUM_THREADS")},
        "nota_mediapipe": "MediaPipe (XNNPACK) maneja sus propios hilos; no se limitó desde Python",
        "parametros": {k: v for k, v in vars(args).items() if k != "salidas"},
        "cuadros_sinteticos": "sin personas: cota inferior del tiempo de MediaPipe con un tramo real",
        "pip_freeze": congelado,
    }
    with open(os.path.join(salidas, "entorno_latencia.json"), "w", encoding="utf-8") as f:
        json.dump(entorno, f, ensure_ascii=False, indent=2)
    print(resumen.to_string(index=False))
    print(f"[latencia] commit {commit}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
