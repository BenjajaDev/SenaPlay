"""Prueba rápida de server.py: mismos endpoints y mismo formato de respuesta."""

import base64

import numpy as np
import pytest
import torch
from fastapi.testclient import TestClient

import server
from models import checkpoint
from models.factory import construir_modelo
from preprocessing.normalization import a_matriz_base, normalizar
from preprocessing.spec import FeatureSpec
from tests.sintetico import secuencia_sintetica

CLASES = ["G", "J", "Z"]


def _meta(spec: FeatureSpec) -> dict:
    return {"arquitectura": "tcn", "hiperparametros": {"canales": [16, 16], "proyeccion": 16},
            "clases": CLASES, "T": spec.T, "dim_entrada": spec.dim_entrada,
            "feature_spec_version": spec.version, "preprocesamiento": spec.a_config()}


@pytest.fixture
def cliente(tmp_path, monkeypatch):
    spec = FeatureSpec()
    meta = _meta(spec)
    torch.manual_seed(0)
    modelo = checkpoint.construir_desde_meta(meta)
    ruta = str(tmp_path / "dinamico.pt")
    checkpoint.guardar(modelo, meta, ruta)
    monkeypatch.setattr(server, "RUTAS_MODELO_DINAMICO", [ruta])
    monkeypatch.setattr(server, "_modelo_dinamico", None)
    return TestClient(server.app)


def test_estado(cliente):
    r = cliente.get("/").json()
    assert set(r) == {"app", "modelo_estatico_listo", "modelo_dinamico_listo", "total_señas"}
    assert r["modelo_dinamico_listo"] is True


def test_clasificar_secuencia_mantiene_el_contrato(cliente):
    seq = secuencia_sintetica(0, 0, np.random.default_rng(0))
    frames = a_matriz_base(normalizar(seq, FeatureSpec.v1())).tolist()   # (N, 527)
    r = cliente.post("/clasificar_secuencia", json={"frames": frames, "fps": 30})
    assert r.status_code == 200
    cuerpo = r.json()
    assert set(cuerpo) == {"seña", "confianza"}
    assert cuerpo["seña"] in CLASES and 0 <= cuerpo["confianza"] <= 1


def test_clasificar_secuencia_forma_invalida(cliente):
    r = cliente.post("/clasificar_secuencia", json={"frames": [[0.0] * 10] * 5})
    assert r.status_code == 422


def test_clasificar_video_mantiene_el_contrato(cliente, monkeypatch):
    import preprocessing.extraction as extraction

    seq = secuencia_sintetica(1, 1, np.random.default_rng(1))
    monkeypatch.setattr(extraction, "extraer_video", lambda ruta, cfg: seq)
    video = base64.b64encode(b"no es un video real").decode()
    r = cliente.post("/clasificar_video", json={"video_base64": video, "mime": "video/webm"})
    assert r.status_code == 200
    cuerpo = r.json()
    assert set(cuerpo) == {"seña", "confianza", "frames_procesados", "ratio_con_mano"}
    assert cuerpo["frames_procesados"] == len(seq)
    assert cuerpo["ratio_con_mano"] == round(1 - seq.ratio_sin_manos(), 3)


def test_sin_modelo_dinamico_responde_503(monkeypatch, tmp_path):
    monkeypatch.setattr(server, "RUTAS_MODELO_DINAMICO", [str(tmp_path / "no_existe.pt")])
    monkeypatch.setattr(server, "_modelo_dinamico", None)
    r = TestClient(server.app).post("/clasificar_secuencia", json={"frames": [[0.0] * 527]})
    assert r.status_code == 503


def test_carga_checkpoint_legado(tmp_path, monkeypatch):
    from model.tcn import ModeloTCN

    ruta = str(tmp_path / "dinamico_tcn.pt")
    torch.save({"estado": ModeloTCN(527, 2).state_dict(), "etiquetas": ["a", "b"],
                "longitud_secuencia": 60, "entrada": 527}, ruta)
    monkeypatch.setattr(server, "RUTAS_MODELO_DINAMICO", [ruta])
    monkeypatch.setattr(server, "_modelo_dinamico", None)
    r = TestClient(server.app).post("/clasificar_secuencia", json={"frames": [[0.1] * 527] * 20})
    assert r.status_code == 200 and r.json()["seña"] in ("a", "b")


def test_meta_reconstruye_la_arquitectura(tmp_path):
    spec = FeatureSpec(velocidad=False, aceleracion=False)
    meta = {**_meta(spec), "arquitectura": "lstm", "hiperparametros": {"oculto": 8, "capas": 1}}
    modelo = construir_modelo({"arquitectura": "lstm", "oculto": 8, "capas": 1},
                              spec.dim_entrada, len(CLASES))
    ruta = str(tmp_path / "m.pt")
    checkpoint.guardar(modelo, meta, ruta)
    recargado, _ = checkpoint.cargar(ruta)
    assert type(recargado).__name__ == "ModeloLSTM"
