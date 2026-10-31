"""
Manifiesto de videos: una fila por video con sus metadatos y su estado.

    cd ai_module
    python -m data.manifest                      # lote por defecto (lote_00)
    python -m data.manifest --batch-id lote_01   # los videos nuevos quedan en lote_01
    python -m data.manifest --overwrite          # vuelve a extraer todos los landmarks

Qué hace:
  1. Lista data/raw_videos/<clase>/[<signer>/]<video>.{mp4,mov}.
  2. Resuelve el signer_id de cada video: data/signers.csv → carpeta
     intermedia → patrón del nombre de archivo. Si alguno queda sin resolver,
     escribe data/signers_template.csv para completar a mano y se detiene
     (código de salida 2) antes de correr MediaPipe. No se inventan ids.
  3. Extrae los landmarks crudos de cada video que no los tenga (o todos con
     --overwrite) en data/processed_landmarks/<clase>/.../<video>.npz.
  4. Marca `discarded` los videos con demasiados frames sin manos (umbral en
     config/datos/manifest.yaml) y los de clases sin tipo en classes.yaml.
  5. Escribe data/manifest.csv e imprime las muestras útiles por clase y por signer.

Los videos que ya estaban en el manifiesto conservan su batch_id; solo los
nuevos toman el de --batch-id. El estado se recalcula siempre, así un cambio
de umbral se refleja sin volver a extraer.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd

from common.config import cargar_yaml
from common.rutas import relativa, resolver
from preprocessing.extraction import SecuenciaCruda, extraer_video

RUTA_CONFIG = "config/datos/manifest.yaml"

COLUMNAS = ["video_path", "sign_class", "sign_type", "signer_id", "session_id", "batch_id",
            "n_frames", "fps", "duration_s", "device", "status", "discard_reason"]
COLUMNAS_PLANTILLA = ["video_path", "sign_class", "signer_id", "session_id", "device"]

TIPOS = {"dinamicas": "dynamic", "estaticas": "static"}


class SignersSinResolver(Exception):
    """Hay videos cuyo signer_id no se pudo deducir; se generó la plantilla."""


@dataclass
class Video:
    ruta: str              # absoluta
    video_path: str        # relativa a ai_module/ (clave del manifiesto)
    sign_class: str
    carpeta_signer: str | None


# ── Descubrimiento ────────────────────────────────────────────────────────────

def listar_videos(dir_videos: str, extensiones: list[str]) -> list[Video]:
    extensiones = tuple(e.lower() for e in extensiones)
    videos = []
    if not os.path.isdir(dir_videos):
        return videos
    for clase in sorted(os.listdir(dir_videos)):
        dir_clase = os.path.join(dir_videos, clase)
        if clase.startswith(".") or not os.path.isdir(dir_clase):
            continue
        for raiz, carpetas, archivos in os.walk(dir_clase):
            carpetas[:] = sorted(c for c in carpetas if not c.startswith("."))
            for archivo in sorted(archivos):
                if not archivo.lower().endswith(extensiones):
                    continue
                ruta = os.path.join(raiz, archivo)
                partes = os.path.relpath(ruta, dir_clase).split(os.sep)
                videos.append(Video(ruta=ruta, video_path=relativa(ruta), sign_class=clase,
                                    carpeta_signer=partes[0] if len(partes) > 1 else None))
    return videos


def tipos_de_clase(ruta_clases: str) -> dict[str, str]:
    cfg = cargar_yaml(ruta_clases)
    tipos = {}
    for seccion, tipo in TIPOS.items():
        for clase in cfg.get(seccion, []) or []:
            if clase in tipos:
                raise ValueError(f"La clase {clase!r} aparece como dinámica y como estática")
            tipos[str(clase)] = tipo
    return tipos


# ── Resolución del signer ─────────────────────────────────────────────────────

def cargar_signers(ruta: str) -> dict[str, dict]:
    if not os.path.exists(ruta):
        return {}
    df = pd.read_csv(ruta, dtype=str).fillna("")
    faltan = {"video_path", "signer_id"} - set(df.columns)
    if faltan:
        raise ValueError(f"{ruta} no tiene las columnas {sorted(faltan)}")
    return {fila["video_path"]: fila for fila in df.to_dict("records")
            if fila.get("signer_id", "").strip()}


def resolver_signer(video: Video, signers: dict[str, dict], patron: re.Pattern) -> dict | None:
    """Devuelve {signer_id, session_id, device} o None si no se puede deducir."""
    fila = signers.get(video.video_path)
    if fila:
        return {"signer_id": fila["signer_id"].strip(),
                "session_id": fila.get("session_id", "").strip(),
                "device": fila.get("device", "").strip()}
    if video.carpeta_signer:
        return {"signer_id": video.carpeta_signer, "session_id": "", "device": ""}
    stem = os.path.splitext(os.path.basename(video.video_path))[0]
    m = patron.match(stem)
    if m and m.group("clase") == video.sign_class:
        return {"signer_id": m.group("signer"), "session_id": "", "device": ""}
    return None


def escribir_plantilla(videos: list[Video], resueltos: dict[str, dict | None], ruta: str) -> None:
    filas = []
    for v in videos:
        r = resueltos.get(v.video_path) or {}
        filas.append({"video_path": v.video_path, "sign_class": v.sign_class,
                      "signer_id": r.get("signer_id", ""), "session_id": r.get("session_id", ""),
                      "device": r.get("device", "")})
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    pd.DataFrame(filas, columns=COLUMNAS_PLANTILLA).to_csv(ruta, index=False)


# ── Construcción del manifiesto ───────────────────────────────────────────────

def ruta_landmarks(video_path: str, cfg: dict) -> str:
    """data/raw_videos/<clase>/x.mov → data/processed_landmarks/<clase>/x.npz (absoluta)."""
    dir_videos = resolver(cfg["rutas"]["videos"])
    rel = os.path.relpath(resolver(video_path), dir_videos)
    return os.path.join(resolver(cfg["rutas"]["landmarks"]), os.path.splitext(rel)[0] + ".npz")


def evaluar_estado(seq: SecuenciaCruda | None, sign_type: str, cfg_descarte: dict,
                   error: str = "") -> tuple[str, str]:
    if error:
        return "discarded", error
    if sign_type == "":
        return "discarded", "clase sin tipo en classes.yaml"
    if seq is None or len(seq) == 0:
        return "discarded", "0 frames leídos"
    if len(seq) < cfg_descarte["min_frames"]:
        return "discarded", f"solo {len(seq)} frames muestreados (mínimo {cfg_descarte['min_frames']})"
    ratio = seq.ratio_sin_manos()
    if ratio > cfg_descarte["max_ratio_sin_manos"]:
        return "discarded", (f"sin manos en {ratio:.0%} de los frames "
                             f"(máximo {cfg_descarte['max_ratio_sin_manos']:.0%})")
    return "ok", ""


def generar_manifiesto(cfg: dict, batch_id: str | None = None, overwrite: bool = False,
                       extractor=extraer_video, verbose: bool = True) -> pd.DataFrame:
    """
    Construye (o actualiza) el manifiesto. `extractor(ruta, cfg_extraccion)`
    se inyecta para poder probar sin MediaPipe.
    """
    rutas = cfg["rutas"]
    videos = listar_videos(resolver(rutas["videos"]), cfg["extensiones"])
    if not videos:
        raise FileNotFoundError(f"No hay videos en {resolver(rutas['videos'])}/<clase>/")

    signers = cargar_signers(resolver(rutas["signers"]))
    patron = re.compile(cfg["patron_nombre"])
    resueltos = {v.video_path: resolver_signer(v, signers, patron) for v in videos}
    sin_resolver = [p for p, r in resueltos.items() if r is None]
    if sin_resolver:
        plantilla = resolver(rutas["plantilla_signers"])
        escribir_plantilla(videos, resueltos, plantilla)
        raise SignersSinResolver(
            f"{len(sin_resolver)} de {len(videos)} videos no tienen signer_id deducible "
            f"(ej.: {sin_resolver[0]}).\nCompleta {relativa(plantilla)} y guárdalo como "
            f"{rutas['signers']}; después vuelve a correr este comando."
        )

    tipos = tipos_de_clase(rutas["clases"])
    cfg_extraccion = cargar_yaml(rutas["preprocesamiento"]).get("extraccion", {})
    ruta_manifiesto = resolver(rutas["manifiesto"])
    previos = {}
    if os.path.exists(ruta_manifiesto):
        previos = {f["video_path"]: f for f in
                   pd.read_csv(ruta_manifiesto, dtype=str).fillna("").to_dict("records")}

    lote = batch_id or cfg["lote_por_defecto"]
    filas = []
    for i, v in enumerate(videos, 1):
        ruta_npz = ruta_landmarks(v.video_path, cfg)
        seq, error = None, ""
        try:
            if os.path.exists(ruta_npz) and not overwrite:
                seq = SecuenciaCruda.cargar(ruta_npz)
            else:
                if verbose:
                    print(f"  [{i}/{len(videos)}] extrayendo {v.video_path}")
                seq = extractor(v.ruta, cfg_extraccion)
                seq.guardar(ruta_npz)
        except Exception as e:  # video corrupto o ilegible: se registra, no se aborta
            error = f"error de lectura: {e}"

        sign_type = tipos.get(v.sign_class, "")
        status, motivo = evaluar_estado(seq, sign_type, cfg["descarte"], error)
        info = seq.info if seq is not None else {}
        signer = resueltos[v.video_path]
        previo = previos.get(v.video_path, {})
        filas.append({
            "video_path": v.video_path,
            "sign_class": v.sign_class,
            "sign_type": sign_type,
            "signer_id": signer["signer_id"],
            "session_id": signer["session_id"] or previo.get("session_id", ""),
            "batch_id": previo.get("batch_id") or lote,
            "n_frames": info.get("n_frames_fuente", 0),
            "fps": info.get("fps_fuente", 0.0),
            "duration_s": info.get("duracion_s", 0.0),
            "device": signer["device"] or info.get("dispositivo", "") or previo.get("device", ""),
            "status": status,
            "discard_reason": motivo,
        })

    df = pd.DataFrame(filas, columns=COLUMNAS).sort_values(["sign_class", "signer_id", "video_path"])
    os.makedirs(os.path.dirname(ruta_manifiesto), exist_ok=True)
    df.to_csv(ruta_manifiesto, index=False)
    return df.reset_index(drop=True)


def resumen(df: pd.DataFrame) -> str:
    """Texto con las muestras útiles por clase y por signer, y los descartes."""
    ok = df[df["status"] == "ok"]
    lineas = [f"Videos: {len(df)} | útiles: {len(ok)} | descartados: {len(df) - len(ok)}", ""]
    lineas.append("Muestras útiles por clase:")
    por_clase = ok.groupby(["sign_class", "sign_type"]).size()
    for (clase, tipo), n in por_clase.items():
        lineas.append(f"  {clase:<12} {tipo:<8} {n}")
    lineas.append("")
    lineas.append(f"Muestras útiles por signer ({ok['signer_id'].nunique()} signers):")
    for signer, n in ok.groupby("signer_id").size().items():
        lineas.append(f"  {signer:<20} {n}")
    descartados = df[df["status"] != "ok"]
    if len(descartados):
        lineas.append("")
        lineas.append("Descartados:")
        for _, f in descartados.iterrows():
            lineas.append(f"  {f['video_path']}: {f['discard_reason']}")
    return "\n".join(lineas)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Genera data/manifest.csv")
    parser.add_argument("--config", default=RUTA_CONFIG)
    parser.add_argument("--batch-id", default=None, help="Lote asignado a los videos nuevos")
    parser.add_argument("--overwrite", action="store_true", help="Vuelve a extraer todos los landmarks")
    args = parser.parse_args(argv)

    cfg = cargar_yaml(args.config)
    try:
        df = generar_manifiesto(cfg, batch_id=args.batch_id, overwrite=args.overwrite)
    except SignersSinResolver as e:
        print(f"[Manifiesto] {e}")
        return 2
    print(f"\n[Manifiesto] Escrito {cfg['rutas']['manifiesto']}\n")
    print(resumen(df))
    return 0


if __name__ == "__main__":
    sys.exit(main())
