"""
Prueba con la app real (fase 3 de docs/ai/integracion_diseno.md).

Levanta server.py sin modificarlo y anota en un JSONL, por cada petición a
/clasificar_frames y /clasificar_video, SOLO la respuesta del servidor (seña,
confianza, motivo…) y cuánto tardó, total y por etapa. El cuerpo de la
petición (cuadros JPEG o video) nunca se lee ni se guarda.

Las etapas se miden envolviendo, desde afuera, las funciones que el servidor
ya llama:

    decodificacion  base64 + JPEG (/clasificar_frames) o base64 + lectura de los
                    cuadros del video (/clasificar_video)
    mediapipe       creación del detector + detectar_frame de cada cuadro
    modelo          ranking del modelo dinámico (features + red)
    resto           barreras, armado de la respuesta, archivo temporal y FastAPI

`total` va desde que el servidor recibe la petición hasta que termina de
responder: no incluye la red ni el teléfono.

Los marcadores de caso (scripts/marcar.py) se escriben en el mismo JSONL; el
resumen asigna cada respuesta al último marcador anterior al INICIO de la
petición.

    cd ai_module
    .venv/Scripts/python.exe -m scripts.prueba_en_vivo servir --modo tcn
    python -m scripts.marcar "tcn · en vivo · Nombre · r1"
    .venv/Scripts/python.exe -m scripts.prueba_en_vivo resumen
"""

from __future__ import annotations

import argparse
import contextvars
import functools
import json
import os
import sys
import time
from collections import defaultdict
from datetime import datetime

DIR_MODULO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGISTRO_POR_DEFECTO = os.path.join(DIR_MODULO, "results", "prueba_en_vivo", "registro.jsonl")
RUTAS = {"/clasificar_frames", "/clasificar_video"}

_etapas: contextvars.ContextVar[dict | None] = contextvars.ContextVar("etapas", default=None)


def ruta_registro() -> str:
    return os.environ.get("REGISTRO_PRUEBA", REGISTRO_POR_DEFECTO)


def escribir(fila: dict, ruta: str | None = None) -> None:
    ruta = ruta or ruta_registro()
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, "a", encoding="utf-8") as f:
        f.write(json.dumps(fila, ensure_ascii=False) + "\n")


def _hora(t: float) -> str:
    return datetime.fromtimestamp(t).strftime("%H:%M:%S.%f")[:-3]


# ── Medición ──────────────────────────────────────────────────────────────────

def _cronometrar(etapa: str, funcion):
    @functools.wraps(funcion)
    def envuelta(*args, **kwargs):
        etapas = _etapas.get()
        inicio = time.perf_counter()
        try:
            return funcion(*args, **kwargs)
        finally:
            if etapas is not None:
                etapas[etapa] = etapas.get(etapa, 0.0) + (time.perf_counter() - inicio) * 1000
    return envuelta


def instrumentar() -> None:
    """Envuelve las funciones que llaman las rutas dinámicas (se buscan por módulo en cada llamada)."""
    import inferencia.entrada as entrada
    import model.predict as predict
    import preprocessing.extraction as extraction

    entrada.validar_cuadros = _cronometrar("decodificacion", entrada.validar_cuadros)
    entrada.decodificar_cuadros = _cronometrar("decodificacion", entrada.decodificar_cuadros)
    entrada.validar_video = _cronometrar("decodificacion", entrada.validar_video)
    extraction.crear_detector = _cronometrar("mediapipe", extraction.crear_detector)
    extraction.detectar_frame = _cronometrar("mediapipe", extraction.detectar_frame)
    # extraer_video incluye leer los cuadros del video y MediaPipe: la lectura es
    # su tiempo total menos lo que se midió como mediapipe dentro de ella.
    extraction.extraer_video = _cronometrar("_extraer_video", extraction.extraer_video)
    predict.ClasificadorDinamico.ranking = _cronometrar("modelo", predict.ClasificadorDinamico.ranking)


def envolver(app, ruta: str):
    async def con_registro(scope, receive, send):
        if scope["type"] != "http" or scope.get("path") not in RUTAS:
            await app(scope, receive, send)
            return
        etapas: dict[str, float] = {}
        _etapas.set(etapas)   # anyio copia el contexto al hilo del endpoint
        inicio_reloj, inicio = time.time(), time.perf_counter()
        estado = {"status": None, "cuerpo": b""}

        async def enviar(mensaje):
            if mensaje["type"] == "http.response.start":
                estado["status"] = mensaje["status"]
            elif mensaje["type"] == "http.response.body":
                estado["cuerpo"] += mensaje.get("body", b"")
            await send(mensaje)

        await app(scope, receive, enviar)
        total = (time.perf_counter() - inicio) * 1000
        video = etapas.pop("_extraer_video", None)
        if video is not None:
            etapas["decodificacion"] = etapas.get("decodificacion", 0.0) + video - etapas.get("mediapipe", 0.0)
        etapas["resto"] = total - sum(etapas.values())
        try:
            respuesta = json.loads(estado["cuerpo"] or b"null")
        except ValueError:
            respuesta = None
        escribir({"tipo": "respuesta", "inicio": inicio_reloj, "hora": _hora(inicio_reloj),
                  "ruta": scope["path"], "status": estado["status"], "respuesta": respuesta,
                  "duracion_ms": round(total, 1),
                  "etapas_ms": {k: round(v, 1) for k, v in etapas.items()}}, ruta)

    return con_registro


def servir(modo: str, puerto: int) -> None:
    import uvicorn

    os.environ["MODELO_DINAMICO"] = modo
    os.environ.setdefault("PRECARGAR_MODELOS", "1")
    os.chdir(DIR_MODULO)
    sys.path.insert(0, DIR_MODULO)
    import server

    instrumentar()
    ruta = ruta_registro()
    escribir({"tipo": "inicio", "inicio": time.time(), "modo": modo}, ruta)
    print(f"[prueba en vivo] modo {modo} · registro {ruta}")
    uvicorn.run(envolver(server.app, ruta), host="0.0.0.0", port=puerto, lifespan="on")


# ── Resumen ───────────────────────────────────────────────────────────────────

def resumen(ruta: str) -> str:
    with open(ruta, encoding="utf-8") as f:
        filas = [json.loads(linea) for linea in f if linea.strip()]
    marcas = sorted((f for f in filas if f["tipo"] == "marca"), key=lambda f: f["inicio"])
    respuestas = sorted((f for f in filas if f["tipo"] == "respuesta"), key=lambda f: f["inicio"])

    grupos: dict[str, list[dict]] = defaultdict(list)
    for r in respuestas:
        anteriores = [m for m in marcas if m["inicio"] <= r["inicio"]]
        grupos[anteriores[-1]["etiqueta"] if anteriores else "(sin marcador)"].append(r)

    lineas = []
    for etiqueta in [m["etiqueta"] for m in marcas] + ["(sin marcador)"]:
        if etiqueta == "(sin marcador)" and not grupos.get(etiqueta):
            continue
        peticiones = grupos.get(etiqueta, [])
        lineas += [f"### {etiqueta} — {len(peticiones)} petición(es)", ""]
        if not peticiones:
            lineas += ["Sin peticiones al modelo dinámico.", ""]
            continue
        lineas += ["| Hora | Ruta | Status | Seña | Confianza | es_seña | Motivo | Alternativas | "
                   "Cuadros | Ratio mano | Movimiento | Total ms | Decodif. | MediaPipe | Modelo | Resto |",
                   "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
        for r in peticiones:
            c = r["respuesta"] if isinstance(r["respuesta"], dict) else {}
            e = r["etapas_ms"]
            alternativas = ", ".join(f"{a['seña']} {a['confianza']}" for a in c.get("alternativas", []))
            lineas.append(
                f"| {r['hora']} | {r['ruta'].replace('/clasificar_', '')} | {r['status']} | "
                f"{c.get('seña', c.get('detail', ''))} | {c.get('confianza', '')} | {c.get('es_seña', '')} | "
                f"{c.get('motivo') or '—'} | {alternativas} | {c.get('frames_procesados', '')} | "
                f"{c.get('ratio_con_mano', '')} | {c.get('movimiento_muñeca', '')} | {r['duracion_ms']} | "
                f"{e.get('decodificacion', '')} | {e.get('mediapipe', '')} | {e.get('modelo', '')} | "
                f"{e.get('resto', '')} |")
        lineas.append("")
    return "\n".join(lineas)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Prueba con la app real")
    sub = parser.add_subparsers(dest="accion", required=True)
    p_servir = sub.add_parser("servir")
    p_servir.add_argument("--modo", choices=["tcn", "lstm"], required=True)
    p_servir.add_argument("--puerto", type=int, default=8000)
    p_resumen = sub.add_parser("resumen")
    p_resumen.add_argument("--registro", default=None)
    args = parser.parse_args(argv)

    if args.accion == "servir":
        servir(args.modo, args.puerto)
    else:
        print(resumen(args.registro or ruta_registro()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
