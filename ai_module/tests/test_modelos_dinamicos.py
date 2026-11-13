"""
Adaptadores del puerto ModeloDinamico con los checkpoints reales del repo:
TCNLegado (producción) y ModeloExportado (TCN/GRU/LSTM con features 2.0).
"""

import numpy as np
import pytest
import torch
import torch.nn.functional as F

from inferencia.ajustes import cargar_ajustes
from inferencia.modelos import cargar_modelo_dinamico
from inferencia.puerto import ModeloDinamico
from models import checkpoint
from models.factory import construir_modelo
from model.predict import CLASE_SIN_SEÑA, ModeloExportado, ModeloInvalido, TCNLegado
from preprocessing.normalization import a_matriz_base, normalizar
from preprocessing.spec import FeatureSpec
from tests import referencia_legado as legado
from tests.sintetico import secuencia_sintetica

CLASES_TCN = ["G", "J", "Mi", "Nombre", "Presento", "S", "X", "Yo", "Z", "ninguna"]
CLASES_EXPORTADO = ["Alergia", "Dolor", "G", "J", "Mi", "Mucho", "Nombre", "Presento", "S", "Tengo",
                    "X", "Yo", "Z", "ninguna"]


@pytest.fixture(scope="module")
def tcn() -> TCNLegado:
    return cargar_modelo_dinamico(cargar_ajustes(modelo_dinamico="tcn"))


@pytest.fixture(scope="module")
def exportado() -> ModeloExportado:
    return cargar_modelo_dinamico(cargar_ajustes(modelo_dinamico="exportado"))


def _guardar_exportado(ruta, arquitectura="lstm", clases=("a", "b"), spec=None) -> str:
    """Checkpoint chico en el formato de training/select_model.py, para probar el adaptador."""
    spec = spec or FeatureSpec(velocidad=False, aceleracion=False)
    hiper = {"oculto": 8, "capas": 1} if arquitectura == "lstm" else {}
    modelo = construir_modelo({"arquitectura": arquitectura, **hiper}, spec.dim_entrada, len(clases))
    meta = {"arquitectura": arquitectura, "hiperparametros": hiper, "clases": list(clases),
            "T": spec.T, "dim_entrada": spec.dim_entrada,
            "feature_spec_version": spec.version, "preprocesamiento": spec.a_config()}
    checkpoint.guardar(modelo, meta, str(ruta))
    return str(ruta)


def test_tcn_legada(tcn):
    assert isinstance(tcn, TCNLegado) and isinstance(tcn, ModeloDinamico)
    assert tcn.nombre == "tcn" and list(tcn.clases) == CLASES_TCN
    assert tcn.clase_rechazo == CLASE_SIN_SEÑA
    assert (tcn.spec.version, tcn.spec.T, tcn.spec.dim_entrada) == ("1.0", 60, 527)
    # Mismos parámetros de MediaPipe que usaba el servidor (config/dataset_config.yaml).
    assert dict(tcn.cfg_extraccion) == {"fps_muestreo": 30, "confianza_deteccion": 0.5,
                                        "confianza_landmarks": 0.5}


def test_modelo_exportado(exportado):
    assert isinstance(exportado, ModeloExportado) and isinstance(exportado, ModeloDinamico)
    assert exportado.nombre == "exportado" and list(exportado.clases) == CLASES_EXPORTADO
    assert exportado.clase_rechazo == CLASE_SIN_SEÑA
    assert (exportado.spec.version, exportado.spec.T, exportado.spec.dim_entrada) == ("2.0", 30, 1577)


def test_lstm_es_alias_de_exportado(exportado):
    alias = cargar_modelo_dinamico(cargar_ajustes(modelo_dinamico="lstm"))
    assert isinstance(alias, ModeloExportado) and alias.clases == exportado.clases


@pytest.mark.parametrize("arquitectura", ["tcn", "gru", "lstm"])
def test_exportado_acepta_las_tres_arquitecturas(tmp_path, arquitectura):
    modelo = ModeloExportado(_guardar_exportado(tmp_path / "m.pt", arquitectura))
    assert modelo.meta["arquitectura"] == arquitectura


def test_exportado_con_ninguna_tiene_clase_de_rechazo(tmp_path):
    ruta = _guardar_exportado(tmp_path / "m.pt", clases=("a", CLASE_SIN_SEÑA))
    assert ModeloExportado(ruta).clase_rechazo == CLASE_SIN_SEÑA


def test_exportado_sin_ninguna_no_tiene_clase_de_rechazo(tmp_path):
    assert ModeloExportado(_guardar_exportado(tmp_path / "m.pt")).clase_rechazo is None


def test_exportado_con_arquitectura_no_permitida_no_carga(tmp_path, monkeypatch):
    ruta = _guardar_exportado(tmp_path / "m.pt", "lstm")
    monkeypatch.setattr(ModeloExportado, "ARQUITECTURAS", frozenset({"tcn", "gru"}))
    with pytest.raises(ModeloInvalido, match="arquitectura 'lstm'"):
        ModeloExportado(ruta)


def test_exportado_con_features_1_0_no_carga(tmp_path):
    ruta = _guardar_exportado(tmp_path / "m.pt", spec=FeatureSpec.v1())
    with pytest.raises(ModeloInvalido, match="features 1.0"):
        ModeloExportado(ruta)


@pytest.mark.parametrize("nombre", ["tcn", "exportado"])
def test_ranking_completo_y_ordenado(nombre, tcn, exportado):
    modelo = {"tcn": tcn, "exportado": exportado}[nombre]
    cruda = secuencia_sintetica(2, 3, np.random.default_rng(7))
    ranking = modelo.ranking(cruda)
    assert sorted(s for s, _ in ranking) == sorted(modelo.clases)
    probabilidades = [p for _, p in ranking]
    assert probabilidades == sorted(probabilidades, reverse=True)
    assert sum(probabilidades) == pytest.approx(1.0, abs=1e-5)


@pytest.mark.parametrize("nombre", ["tcn", "exportado"])
@pytest.mark.parametrize("forma", [(0, 527), (10, 526), (10,)])
def test_ranking_vectores_v1_rechaza_formas_invalidas(nombre, forma, tcn, exportado):
    modelo = {"tcn": tcn, "exportado": exportado}[nombre]
    with pytest.raises(ValueError, match="527"):
        modelo.ranking_vectores_v1(np.zeros(forma, np.float32))


def test_ruta_tcn_apuntando_al_exportado_no_carga():
    ajustes = cargar_ajustes(modelo_dinamico="tcn")
    with pytest.raises(ModeloInvalido, match="features 2.0"):
        TCNLegado(str(ajustes.ruta_modelo_exportado), {"fps_muestreo": 30, "confianza_deteccion": 0.5,
                                                  "confianza_landmarks": 0.5})


def test_ruta_exportado_apuntando_a_la_tcn_legada_no_carga():
    ajustes = cargar_ajustes()
    with pytest.raises(ModeloInvalido, match="features 1.0"):
        ModeloExportado(str(ajustes.ruta_modelo_tcn))


def test_tcn_sin_clase_de_rechazo_no_carga(tmp_path):
    from model.tcn import ModeloTCN

    ruta = str(tmp_path / "tcn_sin_ninguna.pt")
    torch.save({"estado": ModeloTCN(527, 2).state_dict(), "etiquetas": ["a", "b"],
                "longitud_secuencia": 60, "entrada": 527}, ruta)
    with pytest.raises(ModeloInvalido, match="ninguna"):
        TCNLegado(ruta, {"fps_muestreo": 30, "confianza_deteccion": 0.5, "confianza_landmarks": 0.5})


def _ranking_legado(cruda, modelo_legado, etiquetas):
    """Lo que hacía el servidor de gestilingo-dev: 527 por frame → T=60 → TCN."""
    matriz = legado.remuestrear_temporal(legado.secuencia_a_matriz(legado.frames_legados(cruda)), 60)
    with torch.no_grad():
        probs = F.softmax(modelo_legado(torch.tensor(matriz).unsqueeze(0)), dim=-1)[0].tolist()
    return sorted(zip(etiquetas, probs), key=lambda par: -par[1])


def test_tcn_da_los_mismos_numeros_que_el_servidor_legado(tcn):
    payload = torch.load(cargar_ajustes().ruta_modelo_tcn, map_location="cpu", weights_only=False)
    modelo_legado = legado.ModeloTCNLegado(entrada=payload["entrada"], clases=len(payload["etiquetas"]))
    modelo_legado.load_state_dict(payload["estado"])
    modelo_legado.eval()

    rng = np.random.default_rng(11)
    for i in range(30):
        cruda = secuencia_sintetica(i % 6, i % 5, rng)
        esperado = _ranking_legado(cruda, modelo_legado, payload["etiquetas"])
        obtenido = tcn.ranking(cruda)
        assert [s for s, _ in obtenido[:3]] == [s for s, _ in esperado[:3]]
        assert np.allclose([p for _, p in obtenido], [p for _, p in esperado], atol=1e-5)
        # Y por la ruta de /clasificar_secuencia (vectores 1.0 ya armados).
        vectores = a_matriz_base(normalizar(cruda, FeatureSpec.v1()))
        assert np.allclose([p for _, p in tcn.ranking_vectores_v1(vectores)],
                           [p for _, p in esperado], atol=1e-5)
