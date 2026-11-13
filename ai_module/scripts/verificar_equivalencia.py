"""
Verificación de equivalencia: con MODELO_DINAMICO=tcn, ¿el servidor nuevo
responde lo mismo que gestilingo-dev@d9f6cd4? (docs/ai/integracion_diseno.md §4)

1. Genera casos sintéticos con semillas fijas (ninguna persona): secuencias de
   527 valores, secuencias crudas para /clasificar_frames y /clasificar_video
   (con la detección de MediaPipe reemplazada), cuadros y videos sin manos
   para MediaPipe real, manos para /clasificar y entradas inválidas.
2. Lanza scripts/conductor_equivalencia.py en un subproceso por árbol, con el
   mismo intérprete, para que cada uno importe su propio server.py.
3. Compara (§4.3) y escribe el detalle, el resumen y el entorno.

    cd ai_module
    git archive d9f6cd4 ai_module | tar -x -C <dir_ref>
    .venv/Scripts/python.exe -m scripts.verificar_equivalencia --referencia <dir_ref>/ai_module

Salidas (por defecto en docs/tesis/resultados_ia/integracion/):
    equivalencia.csv           una fila por caso
    equivalencia_resumen.json  conteos por categoría y resultado, commits
    entorno_equivalencia.json  python, plataforma y pip freeze
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import platform
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone

import numpy as np

DIR_MODULO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONDUCTOR = os.path.join(DIR_MODULO, "scripts", "conductor_equivalencia.py")
TOL_CONFIANZA = 1e-4
TOL_MOVIMIENTO = 1e-3

# Diferencias aprobadas en el diseño (§1.3): solo con entradas que la app no manda.
ESPERADAS = {
    "F_secuencia_ancho_10": (500, 422),
    "F_secuencia_vacia": (200, 422),
    "F_clasificar_20x3": (500, 422),
    "F_frames_png": (200, 422),
}


# ── Comparación ───────────────────────────────────────────────────────────────

def _cerca(a, b, tolerancia: float) -> bool:
    if a is None or b is None:
        return a is None and b is None
    return abs(float(a) - float(b)) <= tolerancia


def _empate(ref: dict, cand: dict) -> bool:
    """Las dos mejores clases de la referencia casi empatan y salieron invertidas."""
    alternativas = ref.get("alternativas") or []
    if not alternativas:
        return False
    segunda = alternativas[0]
    return (cand.get("seña") == segunda["seña"]
            and abs(float(ref["confianza"]) - float(segunda["confianza"])) < TOL_CONFIANZA)


def comparar(ref: dict, cand: dict, esperada: tuple[int, int] | None = None) -> tuple[str, str]:
    """
    (resultado, detalle). resultado ∈ igual | empate | diferencia_esperada | DIFERENTE.
    `ref` y `cand` son filas del conductor: {"status", "cuerpo"}.
    """
    if esperada is not None:
        obtenida = (ref["status"], cand["status"])
        if obtenida == esperada:
            return "diferencia_esperada", f"status {obtenida[0]} → {obtenida[1]}"
        return "DIFERENTE", f"se esperaba {esperada}, llegó {obtenida}"
    if ref["status"] != cand["status"]:
        return "DIFERENTE", f"status {ref['status']} ≠ {cand['status']}"
    if ref["status"] != 200:
        return "igual", f"status {ref['status']}"

    r, c = ref["cuerpo"], cand["cuerpo"]
    problemas = []
    empate = False
    if r["seña"] != c["seña"]:
        if _empate(r, c):
            empate = True
        else:
            problemas.append(f"seña {r['seña']} ≠ {c['seña']}")
    if not empate and not _cerca(r["confianza"], c["confianza"], TOL_CONFIANZA):
        problemas.append(f"confianza {r['confianza']} ≠ {c['confianza']}")
    if "motivo" in r:
        for clave in ("motivo", "es_seña", "frames_procesados", "ratio_con_mano"):
            if r[clave] != c.get(clave):
                problemas.append(f"{clave} {r[clave]!r} ≠ {c.get(clave)!r}")
        if not _cerca(r["movimiento_muñeca"], c.get("movimiento_muñeca"), TOL_MOVIMIENTO):
            problemas.append(f"movimiento_muñeca {r['movimiento_muñeca']} ≠ {c.get('movimiento_muñeca')}")
        if not empate:
            ra, ca = r["alternativas"], c.get("alternativas", [])
            if [a["seña"] for a in ra] != [a["seña"] for a in ca]:
                problemas.append("alternativas en distinto orden o distintas clases")
            elif not all(_cerca(x["confianza"], y["confianza"], TOL_CONFIANZA) for x, y in zip(ra, ca)):
                problemas.append("confianza de alternativas fuera de tolerancia")
    if problemas:
        return "DIFERENTE", "; ".join(problemas)
    if empate:
        return "empate", f"{r['seña']} ({r['confianza']}) ↔ {c['seña']} ({c['confianza']})"
    delta = abs(float(r["confianza"]) - float(c["confianza"]))
    return "igual", f"Δconfianza {delta:.2e}"


# ── Generación de casos ───────────────────────────────────────────────────────

def _guardar_cruda(seq, ruta: str) -> None:
    np.savez(ruta, manos=seq.manos, presencia_manos=seq.presencia_manos, pose=seq.pose,
             presencia_pose=seq.presencia_pose, cara=seq.cara, presencia_cara=seq.presencia_cara)


def _remuestrear_cruda(seq, largo: int):
    from preprocessing.extraction import SecuenciaCruda

    indices = np.round(np.linspace(0, len(seq) - 1, largo)).astype(int)
    return SecuenciaCruda(manos=seq.manos[indices].copy(),
                          presencia_manos=seq.presencia_manos[indices].copy(),
                          pose=seq.pose[indices].copy(), presencia_pose=seq.presencia_pose[indices].copy(),
                          cara=seq.cara[indices].copy(), presencia_cara=seq.presencia_cara[indices].copy())


def _con_manos(seq, con_mano: int):
    """Deja mano solo en los primeros `con_mano` cuadros."""
    seq.presencia_manos[con_mano:] = 0.0
    seq.manos[con_mano:] = 0.0
    if con_mano:
        sin_ninguna = seq.presencia_manos[:con_mano].max(axis=1) < 0.5
        seq.presencia_manos[:con_mano][sin_ninguna, 1] = 1.0
        seq.manos[:con_mano][sin_ninguna, 1] = np.linspace(0.45, 0.55, 63).reshape(21, 3)
    return seq


def _muñeca_con_amplitud(seq, amplitud: float):
    """Muñecas (pose 15 y 16) que recorren exactamente `amplitud` anchos de hombro en x."""
    seq.presencia_pose[:] = 1.0
    seq.pose[:, 11] = [0.4, 0.6, 0.0]
    seq.pose[:, 12] = [0.6, 0.6, 0.0]
    fase = np.linspace(0, 1, len(seq))
    seq.pose[:, 15] = np.stack([np.full(len(seq), 0.45), np.full(len(seq), 0.4), np.zeros(len(seq))], 1)
    seq.pose[:, 16] = np.stack([0.55 + amplitud * 0.2 * fase, np.full(len(seq), 0.4),
                                np.zeros(len(seq))], 1)
    return seq


def _jpeg(imagen: np.ndarray, calidad: int = 70) -> str:
    import cv2

    ok, datos = cv2.imencode(".jpg", imagen, [cv2.IMWRITE_JPEG_QUALITY, calidad])
    assert ok
    return base64.b64encode(datos.tobytes()).decode()


def _mp4(ruta: str, cuadros: int, fps: float, rng: np.random.Generator, ruido: bool = False) -> None:
    import cv2

    escritor = cv2.VideoWriter(ruta, cv2.VideoWriter_fourcc(*"mp4v"), fps, (160, 120))
    for i in range(cuadros):
        if ruido:
            imagen = rng.integers(0, 255, (120, 160, 3), dtype=np.uint8)
        else:
            imagen = np.full((120, 160, 3), (i * 5) % 255, np.uint8)
        escritor.write(imagen)
    escritor.release()


def generar_casos(directorio: str) -> list[dict]:
    from preprocessing.normalization import a_matriz_base, normalizar
    from preprocessing.spec import FeatureSpec
    from tests.sintetico import secuencia_sintetica

    os.makedirs(directorio, exist_ok=True)
    rng = np.random.default_rng(20261031)
    casos: list[dict] = []
    jpegs = {"gris": _jpeg(np.full((48, 64, 3), 128, np.uint8))}
    png = None

    # A. /clasificar_secuencia: 200 matrices (N, 527) con N de 8 a 120.
    for i in range(200):
        seq = secuencia_sintetica(i % 6, i % 10, rng)
        seq = _remuestrear_cruda(seq, int(rng.integers(8, 121)))
        if i % 10 == 3:
            seq = _con_manos(seq, 0)
        matriz = a_matriz_base(normalizar(seq, FeatureSpec.v1()))
        if i % 25 == 7:
            matriz[:] = 0.0
        archivo = f"A_{i:03d}.npy"
        np.save(os.path.join(directorio, archivo), matriz.astype(np.float32))
        casos.append({"id": f"A_{i:03d}", "categoria": "A", "ruta": "/clasificar_secuencia",
                      "cuerpo": {"tipo": "npy_frames", "archivo": archivo, "fps": 30.0}})

    # B. /clasificar_frames con detección sintética.
    crudas: list[tuple[str, object]] = []
    for i in range(140):
        seq = secuencia_sintetica(i % 6, i % 10, rng)
        if i % 7 == 1:      # pose solo en parte de los cuadros
            corte = int(len(seq) * rng.uniform(0.3, 0.7))
            seq.presencia_pose[:corte] = 0.0
            seq.pose[:corte] = 0.0
        if i % 7 == 2:      # mano en torno al 30 % de los cuadros
            seq = _con_manos(seq, int(round(len(seq) * rng.uniform(0.2, 0.4))))
        if i % 7 == 3:      # mano quieta
            seq.pose[:] = seq.pose[0]
        crudas.append((f"B_sint_{i:03d}", seq))
    for con_mano in (1, 3, 7, 21, 23, 24, 25, 40, 80):
        seq = _remuestrear_cruda(secuencia_sintetica(1, 2, np.random.default_rng(con_mano)), 80)
        crudas.append((f"B_L80_k{con_mano:02d}", _con_manos(seq, con_mano)))
    for largo, con_mano in ((40, 7), (10, 3), (10, 2), (120, 36), (120, 35)):
        seq = _remuestrear_cruda(secuencia_sintetica(3, 4, np.random.default_rng(largo)), largo)
        crudas.append((f"B_L{largo}_k{con_mano:02d}", _con_manos(seq, con_mano)))
    for j, amplitud in enumerate((0.0, 0.079, 0.0799, 0.0801, 0.081, 0.2)):
        seq = secuencia_sintetica(j % 6, 1, np.random.default_rng(100 + j))
        crudas.append((f"B_mov_{amplitud:.4f}", _muñeca_con_amplitud(seq, amplitud)))
    for j in range(30):     # manos al azar: buscan respuestas «ninguna» del modelo
        seq = secuencia_sintetica(j % 6, j % 10, np.random.default_rng(500 + j))
        ruido = np.random.default_rng(900 + j)
        seq.manos[:] = ruido.uniform(0.2, 0.8, seq.manos.shape).astype(np.float32)
        seq.manos *= seq.presencia_manos[..., None, None]
        crudas.append((f"B_ruido_{j:02d}", seq))

    for identificador, seq in crudas:
        archivo = f"{identificador}.npz"
        _guardar_cruda(seq, os.path.join(directorio, archivo))
        casos.append({"id": identificador, "categoria": "B", "ruta": "/clasificar_frames",
                      "parchear": "deteccion", "cruda": archivo,
                      "cuerpo": {"tipo": "jpegs", "jpegs": ["gris"] * len(seq), "fps": 15.0}})

    # C. /clasificar_video: video real decodificado, detección sintética.
    seleccion = crudas[:40] + [c for c in crudas if c[0].startswith(("B_L80", "B_mov", "B_L120"))]
    for indice, (identificador, seq) in enumerate(seleccion):
        fps = 60.0 if indice % 6 == 5 else 30.0
        cuadros = len(seq) * (2 if fps == 60.0 else 1)
        video = f"C_{identificador[2:]}_{int(fps)}.mp4"
        _mp4(os.path.join(directorio, video), cuadros, fps, rng)
        casos.append({"id": f"C_{identificador[2:]}_{int(fps)}fps", "categoria": "C",
                      "ruta": "/clasificar_video", "parchear": "deteccion",
                      "cruda": f"{identificador}.npz",
                      "cuerpo": {"tipo": "video", "archivo": video, "mime": "video/mp4"}})

    # D. MediaPipe real, sin reemplazos: imágenes y videos sin personas.
    for j in range(5):
        alto, ancho = ((360, 480), (480, 360))[j % 2]
        claves = []
        for k in range(20):
            if k % 3 == 0:
                imagen = rng.integers(0, 255, (alto, ancho, 3), dtype=np.uint8)
            elif k % 3 == 1:
                imagen = np.full((alto, ancho, 3), (j * 40 + k * 9) % 255, np.uint8)
            else:
                imagen = np.tile(np.linspace(0, 255, ancho, dtype=np.uint8), (alto, 1))[..., None].repeat(3, 2)
            clave = f"D_{j}_{k}"
            jpegs[clave] = "data:image/jpeg;base64," + _jpeg(imagen)
            claves.append(clave)
        casos.append({"id": f"D_frames_{j}", "categoria": "D", "ruta": "/clasificar_frames",
                      "cuerpo": {"tipo": "jpegs", "jpegs": claves, "fps": 15.0}})
    for j in range(3):
        video = f"D_video_{j}.mp4"
        _mp4(os.path.join(directorio, video), 30 + 10 * j, 30.0, rng, ruido=j != 1)
        casos.append({"id": f"D_video_{j}", "categoria": "D", "ruta": "/clasificar_video",
                      "cuerpo": {"tipo": "video", "archivo": video, "mime": "video/mp4"}})

    # E. /clasificar: 200 manos de 21×3.
    for i in range(200):
        mano = rng.uniform(0.2, 0.8, (21, 3)).round(5).tolist()
        casos.append({"id": f"E_{i:03d}", "categoria": "E", "ruta": "/clasificar",
                      "cuerpo": {"tipo": "json", "json": {"landmarks": mano}}})

    # F. Entradas inválidas.
    import cv2

    ok, png = cv2.imencode(".png", np.full((48, 64, 3), 128, np.uint8))
    jpegs["png"] = "data:image/png;base64," + base64.b64encode(png.tobytes()).decode()
    jpegs["relleno_roto"] = "abc"
    invalidas = [
        ("F_frames_vacio", "/clasificar_frames", {"tipo": "json", "json": {"frames": []}}),
        ("F_frames_121", "/clasificar_frames", {"tipo": "jpegs", "jpegs": ["gris"] * 121, "fps": 15.0}),
        ("F_frames_fps_0", "/clasificar_frames", {"tipo": "json", "json": {"frames": [jpegs["gris"]], "fps": 0}}),
        ("F_frames_fps_61", "/clasificar_frames", {"tipo": "json", "json": {"frames": [jpegs["gris"]], "fps": 61}}),
        ("F_frames_relleno_roto", "/clasificar_frames", {"tipo": "jpegs", "jpegs": ["gris", "relleno_roto"], "fps": 15.0}),
        ("F_frames_png", "/clasificar_frames", {"tipo": "jpegs", "jpegs": ["png"] * 3, "fps": 15.0}),
        ("F_video_basura", "/clasificar_video", {"tipo": "json", "json": {
            "video_base64": base64.b64encode(b"no es un video").decode(), "mime": "video/webm"}}),
        ("F_video_vacio", "/clasificar_video", {"tipo": "json", "json": {"video_base64": "", "mime": "video/mp4"}}),
        ("F_secuencia_ancho_10", "/clasificar_secuencia", {"tipo": "json", "json": {"frames": [[0.0] * 10] * 5}}),
        ("F_secuencia_vacia", "/clasificar_secuencia", {"tipo": "json", "json": {"frames": []}}),
        ("F_clasificar_20x3", "/clasificar", {"tipo": "json", "json": {"landmarks": [[0.5, 0.5, 0.0]] * 20}}),
    ]
    for identificador, ruta, cuerpo in invalidas:
        casos.append({"id": identificador, "categoria": "F", "ruta": ruta, "cuerpo": cuerpo})

    with open(os.path.join(directorio, "casos.json"), "w", encoding="utf-8") as f:
        json.dump(casos, f, ensure_ascii=False)
    with open(os.path.join(directorio, "jpegs.json"), "w", encoding="utf-8") as f:
        json.dump(jpegs, f)
    return casos


# ── Ejecución ─────────────────────────────────────────────────────────────────

def _commit(arbol: str) -> str:
    def git(*args: str) -> str:
        return subprocess.run(["git", *args], cwd=arbol, capture_output=True, text=True).stdout.strip()

    commit = git("rev-parse", "HEAD")
    if not commit:
        marca = os.path.join(os.path.dirname(arbol), "COMMIT")
        return open(marca, encoding="utf-8").read().strip() if os.path.exists(marca) else "desconocido"
    sucio = git("status", "--porcelain", "--untracked-files=no", "--", ".")
    return commit + ("-dirty" if sucio else "")


def _correr(arbol: str, modo: str, casos_dir: str, salida: str) -> dict[str, dict]:
    entorno = {**os.environ, "MODELO_DINAMICO": "tcn", "PYTHONIOENCODING": "utf-8"}
    entorno.pop("PRECARGAR_MODELOS", None)
    proceso = subprocess.run([sys.executable, "-P", CONDUCTOR, "--arbol", arbol, "--modo", modo,
                              "--casos", casos_dir, "--salida", salida],
                             env=entorno, capture_output=True, text=True, encoding="utf-8")
    if proceso.returncode != 0:
        raise RuntimeError(f"El conductor ({modo}) falló:\n{proceso.stderr[-4000:]}")
    with open(salida, encoding="utf-8") as f:
        return {fila["id"]: fila for fila in map(json.loads, f)}


def _entorno() -> dict:
    congelado = subprocess.run([sys.executable, "-m", "pip", "freeze"], capture_output=True,
                               text=True).stdout.splitlines()
    import torch

    return {"python": sys.version, "plataforma": platform.platform(),
            "procesador": platform.processor(), "torch_hilos": torch.get_num_threads(),
            "pip_freeze": congelado}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--referencia", required=True, help="ai_module de gestilingo-dev@d9f6cd4")
    parser.add_argument("--trabajo", default=None, help="carpeta para casos y respuestas (temporal)")
    parser.add_argument("--salidas", default=os.path.join(DIR_MODULO, "..", "docs", "tesis",
                                                          "resultados_ia", "integracion"))
    args = parser.parse_args(argv)

    sys.path.insert(0, DIR_MODULO)
    trabajo = os.path.abspath(args.trabajo or os.path.join(DIR_MODULO, "results", "equivalencia"))
    casos_dir = os.path.join(trabajo, "casos")
    casos = generar_casos(casos_dir)
    print(f"[Equivalencia] {len(casos)} casos en {casos_dir}")

    referencia = _correr(os.path.abspath(args.referencia), "referencia", casos_dir,
                         os.path.join(trabajo, "referencia.jsonl"))
    candidato = _correr(DIR_MODULO, "candidato", casos_dir, os.path.join(trabajo, "candidato.jsonl"))

    filas = []
    for caso in casos:
        r, c = referencia[caso["id"]], candidato[caso["id"]]
        resultado, detalle = comparar(r, c, ESPERADAS.get(caso["id"]))
        if caso.get("parchear") == "deteccion" and r["llamadas_deteccion"] != c["llamadas_deteccion"]:
            resultado = "DIFERENTE"
            detalle += f"; cuadros detectados {r['llamadas_deteccion']} ≠ {c['llamadas_deteccion']}"
        rc = r["cuerpo"] if isinstance(r["cuerpo"], dict) else {}
        cc = c["cuerpo"] if isinstance(c["cuerpo"], dict) else {}
        filas.append({
            "caso": caso["id"], "categoria": caso["categoria"], "ruta": caso["ruta"],
            "status_ref": r["status"], "status_cand": c["status"],
            "seña_ref": rc.get("seña", ""), "seña_cand": cc.get("seña", ""),
            "confianza_ref": rc.get("confianza", ""), "confianza_cand": cc.get("confianza", ""),
            "motivo_ref": rc.get("motivo", ""), "motivo_cand": cc.get("motivo", ""),
            "movimiento_ref": rc.get("movimiento_muñeca", ""), "movimiento_cand": cc.get("movimiento_muñeca", ""),
            "ratio_ref": rc.get("ratio_con_mano", ""), "ratio_cand": cc.get("ratio_con_mano", ""),
            "resultado": resultado, "detalle": detalle,
        })

    import pandas as pd

    tabla = pd.DataFrame(filas)
    salidas = os.path.abspath(args.salidas)
    os.makedirs(salidas, exist_ok=True)
    tabla.to_csv(os.path.join(salidas, "equivalencia.csv"), index=False, encoding="utf-8")

    dinamicos = tabla[(tabla.categoria.isin(["B", "C"])) & (tabla.status_ref == 200)]
    resumen = {
        "fecha_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "commit_referencia": _commit(os.path.abspath(args.referencia)),
        "commit_candidato": _commit(DIR_MODULO),
        "modelo_dinamico": "tcn",
        "tolerancias": {"confianza": TOL_CONFIANZA, "movimiento_muñeca": TOL_MOVIMIENTO},
        "casos": len(tabla),
        "por_resultado": dict(Counter(tabla.resultado)),
        "por_categoria": {cat: dict(Counter(g.resultado)) for cat, g in tabla.groupby("categoria")},
        "motivos_referencia_B_C": dict(Counter(dinamicos.motivo_ref.fillna("ninguno").replace("", "ninguno"))),
        "llamadas_ffprobe_candidato": max(f.get("llamadas_ffprobe", 0) for f in candidato.values()),
        "max_delta_confianza": float(np.nanmax(np.abs(
            pd.to_numeric(tabla.confianza_ref, errors="coerce") - pd.to_numeric(tabla.confianza_cand, errors="coerce")))),
        "aprobada": bool((tabla.resultado == "DIFERENTE").sum() == 0),
    }
    with open(os.path.join(salidas, "equivalencia_resumen.json"), "w", encoding="utf-8") as f:
        json.dump(resumen, f, ensure_ascii=False, indent=2)
    with open(os.path.join(salidas, "entorno_equivalencia.json"), "w", encoding="utf-8") as f:
        json.dump(_entorno(), f, ensure_ascii=False, indent=2)

    print(json.dumps(resumen, ensure_ascii=False, indent=2))
    diferentes = tabla[tabla.resultado == "DIFERENTE"]
    if len(diferentes):
        print(diferentes[["caso", "detalle"]].to_string(index=False))
    return 0 if resumen["aprobada"] else 1


if __name__ == "__main__":
    sys.exit(main())
