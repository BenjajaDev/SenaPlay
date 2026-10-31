"""scripts/prueba_en_vivo.py y scripts/marcar.py: registro, etapas y marcadores."""

import json
import os
import subprocess
import sys

import numpy as np
import pytest
from fastapi.testclient import TestClient

import inferencia.entrada as entrada
import model.predict as predict
import preprocessing.extraction as extraction
import server
from inferencia.ajustes import cargar_ajustes
from scripts import prueba_en_vivo
from tests.sintetico import secuencia_sintetica
from tests.test_server import _jpeg_b64, deteccion_desde, mp4_b64


@pytest.fixture
def registro(tmp_path, monkeypatch):
    ruta = tmp_path / "registro.jsonl"
    monkeypatch.setenv("REGISTRO_PRUEBA", str(ruta))
    # monkeypatch guarda los originales: instrumentar() los reemplaza y al
    # terminar la prueba quedan restaurados.
    for modulo, nombre in ((entrada, "validar_cuadros"), (entrada, "decodificar_cuadros"),
                           (entrada, "validar_video"), (extraction, "extraer_video"),
                           (predict.ClasificadorDinamico, "ranking")):
        monkeypatch.setattr(modulo, nombre, getattr(modulo, nombre))
    return ruta


def _filas(ruta):
    return [json.loads(linea) for linea in ruta.read_text(encoding="utf-8").splitlines()]


def test_registra_respuesta_y_etapas_sin_el_cuerpo(registro, monkeypatch, tmp_path):
    cruda = secuencia_sintetica(0, 0, np.random.default_rng(0))
    # Reemplaza crear_detector y detectar_frame ANTES de instrumentar, para que
    # el cronómetro envuelva la detección sintética.
    llamadas = deteccion_desde(monkeypatch, cruda)
    prueba_en_vivo.instrumentar()
    app = prueba_en_vivo.envolver(server.crear_app(cargar_ajustes()), str(registro))

    subprocess.run([sys.executable, "-m", "scripts.marcar", "tcn · en vivo · J · r1"],
                   cwd=prueba_en_vivo.DIR_MODULO, check=True, capture_output=True,
                   env={**os.environ, "REGISTRO_PRUEBA": str(registro)})
    cuadro = _jpeg_b64()
    with TestClient(app) as cliente:
        cliente.post("/clasificar_frames", json={"frames": [cuadro] * len(cruda), "fps": 15})
        cliente.post("/clasificar", json={"landmarks": [[0.5, 0.5, 0.0]] * 21})   # no se registra
        llamadas.clear()                       # la detección vuelve al cuadro 0
        cliente.post("/clasificar_video", json={"video_base64": mp4_b64(tmp_path, 30),
                                                "mime": "video/mp4"})

    filas = _filas(registro)
    assert [f["tipo"] for f in filas] == ["marca", "respuesta", "respuesta"]
    texto = registro.read_text(encoding="utf-8")
    assert cuadro.split(",", 1)[1][:40] not in texto            # nada del cuerpo de la petición
    for fila in filas[1:]:
        assert fila["status"] == 200 and fila["respuesta"]["frames_procesados"] > 0
        etapas = fila["etapas_ms"]
        assert set(etapas) == {"decodificacion", "mediapipe", "modelo", "resto"}
        assert etapas["modelo"] > 0 and fila["duracion_ms"] > 0
        assert fila["recepcion_cuerpo_ms"] >= 0
        assert sum(etapas.values()) == pytest.approx(fila["duracion_ms"], abs=0.5)

    tabla = prueba_en_vivo.resumen(str(registro))
    assert "### tcn · en vivo · J · r1 — 2 petición(es)" in tabla


def test_respuesta_sin_marcador_previo(tmp_path):
    ruta = tmp_path / "r.jsonl"
    prueba_en_vivo.escribir({"tipo": "respuesta", "inicio": 1.0, "hora": "x", "ruta": "/clasificar_frames",
                             "status": 422, "respuesta": {"detail": "El tramo no trae cuadros"},
                             "duracion_ms": 1.0, "etapas_ms": {}}, str(ruta))
    prueba_en_vivo.escribir({"tipo": "marca", "inicio": 2.0, "hora": "y", "etiqueta": "caso"}, str(ruta))
    tabla = prueba_en_vivo.resumen(str(ruta))
    assert "(sin marcador) — 1 petición(es)" in tabla and "### caso — 0 petición(es)" in tabla
