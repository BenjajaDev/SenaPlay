"""
Contrato de server.py con los modelos reales, en los dos modos
(MODELO_DINAMICO=tcn y =lstm). La detección de MediaPipe se reemplaza por
secuencias sintéticas; las pruebas con MediaPipe real están en
test_server_mediapipe.py.
"""

import base64
import logging

import numpy as np
import pytest
import torch
from fastapi.testclient import TestClient

import server
from inferencia.ajustes import cargar_ajustes
from model.predict import ModeloInvalido
from models import checkpoint
from models.factory import construir_modelo
from preprocessing.normalization import a_matriz_base, normalizar
from preprocessing.spec import FeatureSpec
from tests.sintetico import secuencia_sintetica

CLAVES_ESTADO = {"app", "modelo_estatico_listo", "modelo_dinamico_listo", "total_señas",
                 "modelo_dinamico", "clases_dinamicas", "barreras_activas"}
CLAVES_DINAMICA = {"seña", "confianza", "es_seña", "motivo", "alternativas",
                   "movimiento_muñeca", "frames_procesados", "ratio_con_mano"}
MOTIVOS = {None, "sin_mano", "poco_movimiento", "modelo_sin_seña"}


@pytest.fixture(scope="module", params=["tcn", "lstm"])
def modo(request):
    return request.param


@pytest.fixture(scope="module")
def cliente(modo):
    with TestClient(server.crear_app(cargar_ajustes(modelo_dinamico=modo))) as c:
        yield c


def _vectores_v1(semilla: int) -> list[list[float]]:
    seq = secuencia_sintetica(semilla % 6, semilla % 5, np.random.default_rng(semilla))
    return a_matriz_base(normalizar(seq, FeatureSpec.v1())).tolist()   # (N, 527)


def test_estado(cliente, modo):
    r = cliente.get("/").json()
    assert set(r) == CLAVES_ESTADO
    assert r["modelo_dinamico_listo"] is True and r["modelo_dinamico"] == modo
    assert ("ninguna" in r["clases_dinamicas"]) is (modo == "tcn")
    assert r["barreras_activas"] == {"sin_mano": True, "poco_movimiento": True,
                                     "modelo_sin_seña": modo == "tcn"}


def test_clasificar_secuencia_mantiene_el_contrato(cliente):
    r = cliente.post("/clasificar_secuencia", json={"frames": _vectores_v1(0), "fps": 30})
    assert r.status_code == 200
    cuerpo = r.json()
    assert set(cuerpo) == {"seña", "confianza"}
    assert isinstance(cuerpo["seña"], str) and 0 <= cuerpo["confianza"] <= 1
    assert cuerpo["confianza"] == round(cuerpo["confianza"], 4)


@pytest.mark.parametrize("frames", [[[0.0] * 10] * 5, [], [[0.0] * 527, [0.0] * 526]],
                         ids=["ancho", "vacia", "filas_desiguales"])
def test_clasificar_secuencia_forma_invalida_da_422(cliente, frames):
    r = cliente.post("/clasificar_secuencia", json={"frames": frames})
    assert r.status_code == 422
    assert isinstance(r.json()["detail"], str)


def _video_sintetico(monkeypatch, semilla: int):
    seq = secuencia_sintetica(semilla % 6, semilla % 5, np.random.default_rng(semilla))
    matriz = a_matriz_base(normalizar(seq, FeatureSpec.v1()))
    stats = {"frames": len(seq), "ratio_con_mano": round(1 - seq.ratio_sin_manos(), 3)}
    monkeypatch.setattr(server, "_extraer_video", lambda ruta, **_: (matriz, stats))
    return seq, stats


def test_clasificar_video_mantiene_el_contrato(cliente, modo, monkeypatch):
    for semilla in range(6):
        seq, stats = _video_sintetico(monkeypatch, semilla)
        video = base64.b64encode(b"no es un video real").decode()
        r = cliente.post("/clasificar_video", json={"video_base64": video, "mime": "video/webm"})
        assert r.status_code == 200
        cuerpo = r.json()
        assert set(cuerpo) == CLAVES_DINAMICA
        assert cuerpo["motivo"] in MOTIVOS and cuerpo["es_seña"] == (cuerpo["motivo"] is None)
        assert len(cuerpo["alternativas"]) == 2
        assert all(set(a) == {"seña", "confianza"} for a in cuerpo["alternativas"])
        assert cuerpo["frames_procesados"] == len(seq)
        assert cuerpo["ratio_con_mano"] == stats["ratio_con_mano"]
        if modo == "lstm":
            assert cuerpo["motivo"] != "modelo_sin_seña"


def _jpeg_b64() -> str:
    import cv2

    ok, jpeg = cv2.imencode(".jpg", np.full((24, 24, 3), 100, np.uint8))
    return "data:image/jpeg;base64," + base64.b64encode(jpeg.tobytes()).decode()


def deteccion_desde(monkeypatch, cruda):
    """
    Reemplaza MediaPipe: la llamada i a detectar_frame devuelve el cuadro i de
    `cruda` (en el formato de extraction.detectar_frame). Devuelve la lista de
    timestamps con que se llamó.
    """
    import preprocessing.extraction as extraction

    timestamps = []

    class _Detector:
        def close(self):
            pass

    def detectar(_detector, _imagen, timestamp_ms=None):
        t = len(timestamps)
        timestamps.append(timestamp_ms)
        return {
            "mano_izq": cruda.manos[t, 0] if cruda.presencia_manos[t, 0] > 0.5 else None,
            "mano_der": cruda.manos[t, 1] if cruda.presencia_manos[t, 1] > 0.5 else None,
            "pose": cruda.pose[t] if cruda.presencia_pose[t] > 0.5 else None,
            "cara": cruda.cara[t] if cruda.presencia_cara[t] > 0.5 else None,
        }

    monkeypatch.setattr(extraction, "crear_detector", lambda cfg, modo_video=True: _Detector())
    monkeypatch.setattr(extraction, "detectar_frame", detectar)
    return timestamps


def test_clasificar_frames_mantiene_el_contrato(cliente, modo, monkeypatch):
    for semilla in range(6):
        cruda = secuencia_sintetica(semilla % 6, semilla % 5, np.random.default_rng(semilla))
        timestamps = deteccion_desde(monkeypatch, cruda)
        r = cliente.post("/clasificar_frames", json={"frames": [_jpeg_b64()] * len(cruda), "fps": 15})
        assert r.status_code == 200
        cuerpo = r.json()
        assert set(cuerpo) == CLAVES_DINAMICA
        assert cuerpo["motivo"] in MOTIVOS and cuerpo["es_seña"] == (cuerpo["motivo"] is None)
        assert len(cuerpo["alternativas"]) == 2
        assert cuerpo["frames_procesados"] == len(cruda)
        assert cuerpo["seña"] in cliente.app.state.modelo_dinamico.clases
        assert timestamps == [i * 67 for i in range(len(cruda))]   # round(1000 / 15)
        if modo == "lstm":
            assert cuerpo["motivo"] != "modelo_sin_seña"


def test_clasificar_frames_aplica_las_barreras(cliente, monkeypatch):
    cruda = secuencia_sintetica(0, 0, np.random.default_rng(0))
    cruda.presencia_manos[: int(len(cruda) * 0.8)] = 0.0       # casi sin mano
    deteccion_desde(monkeypatch, cruda)
    r = cliente.post("/clasificar_frames", json={"frames": [_jpeg_b64()] * len(cruda)})
    assert r.json()["motivo"] == "sin_mano" and r.json()["es_seña"] is False

    quieta = secuencia_sintetica(0, 0, np.random.default_rng(0))
    quieta.pose[:] = quieta.pose[0]                             # muñecas sin moverse
    deteccion_desde(monkeypatch, quieta)
    r = cliente.post("/clasificar_frames", json={"frames": [_jpeg_b64()] * len(quieta)})
    assert r.json()["motivo"] == "poco_movimiento"


def test_sin_arrancar_no_hay_modelo_dinamico():
    # Sin lifespan (TestClient fuera de `with`) no hay modelos cargados: 503.
    r = TestClient(server.crear_app()).post("/clasificar_secuencia", json={"frames": [[0.0] * 527]})
    assert r.status_code == 503


def test_no_arranca_si_el_archivo_no_es_el_modelo_configurado():
    ajustes = cargar_ajustes()
    cruzados = cargar_ajustes(modelo_dinamico="tcn", ruta_modelo_tcn=ajustes.ruta_modelo_lstm)
    with pytest.raises(ModeloInvalido):
        with TestClient(server.crear_app(cruzados)):
            pass


def test_modo_lstm_advierte_al_arrancar(caplog):
    with caplog.at_level(logging.WARNING, logger="senaplay.ia"):
        with TestClient(server.crear_app(cargar_ajustes(modelo_dinamico="lstm"))):
            pass
    avisos = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
    assert any("no tiene clase de rechazo" in m and "modelo_sin_seña" in m for m in avisos)


def test_modo_tcn_no_advierte(caplog):
    with caplog.at_level(logging.WARNING, logger="senaplay.ia"):
        with TestClient(server.crear_app(cargar_ajustes(modelo_dinamico="tcn"))):
            pass
    assert not [r for r in caplog.records if "clase de rechazo" in r.getMessage()]


def test_carga_checkpoint_legado_sin_meta(tmp_path):
    from model.tcn import ModeloTCN

    ruta = str(tmp_path / "dinamico_tcn.pt")
    torch.save({"estado": ModeloTCN(527, 2).state_dict(), "etiquetas": ["a", "ninguna"],
                "longitud_secuencia": 60, "entrada": 527}, ruta)
    with TestClient(server.crear_app(cargar_ajustes(ruta_modelo_tcn=ruta))) as c:
        r = c.post("/clasificar_secuencia", json={"frames": [[0.1] * 527] * 20})
    assert r.status_code == 200 and r.json()["seña"] in ("a", "ninguna")


def test_meta_reconstruye_la_arquitectura(tmp_path):
    spec = FeatureSpec(velocidad=False, aceleracion=False)
    meta = {"arquitectura": "lstm", "hiperparametros": {"oculto": 8, "capas": 1},
            "clases": ["G", "J", "Z"], "T": spec.T, "dim_entrada": spec.dim_entrada,
            "feature_spec_version": spec.version, "preprocesamiento": spec.a_config()}
    modelo = construir_modelo({"arquitectura": "lstm", "oculto": 8, "capas": 1},
                              spec.dim_entrada, 3)
    ruta = str(tmp_path / "m.pt")
    checkpoint.guardar(modelo, meta, ruta)
    recargado, _ = checkpoint.cargar(ruta)
    assert type(recargado).__name__ == "ModeloLSTM"
