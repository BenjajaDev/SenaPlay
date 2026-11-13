"""
Adaptadores del puerto ModeloDinamico con los checkpoints reales del repo:
TCNLegado (producción) y LSTMExportado (solo pruebas locales).
"""

import numpy as np
import pytest
import torch
import torch.nn.functional as F

from inferencia.ajustes import cargar_ajustes
from inferencia.modelos import cargar_modelo_dinamico
from inferencia.puerto import ModeloDinamico
from model.predict import CLASE_SIN_SEÑA, LSTMExportado, ModeloInvalido, TCNLegado
from preprocessing.normalization import a_matriz_base, normalizar
from preprocessing.spec import FeatureSpec
from tests import referencia_legado as legado
from tests.sintetico import secuencia_sintetica

CLASES_TCN = ["G", "J", "Mi", "Nombre", "Presento", "S", "X", "Yo", "Z", "ninguna"]
CLASES_LSTM = ["G", "J", "Mi", "Nombre", "Presento", "S", "X", "Yo", "Z"]


@pytest.fixture(scope="module")
def tcn() -> TCNLegado:
    return cargar_modelo_dinamico(cargar_ajustes(modelo_dinamico="tcn"))


@pytest.fixture(scope="module")
def lstm() -> LSTMExportado:
    return cargar_modelo_dinamico(cargar_ajustes(modelo_dinamico="lstm"))


def test_tcn_legada(tcn):
    assert isinstance(tcn, TCNLegado) and isinstance(tcn, ModeloDinamico)
    assert tcn.nombre == "tcn" and list(tcn.clases) == CLASES_TCN
    assert tcn.clase_rechazo == CLASE_SIN_SEÑA
    assert (tcn.spec.version, tcn.spec.T, tcn.spec.dim_entrada) == ("1.0", 60, 527)
    # Mismos parámetros de MediaPipe que usaba el servidor (config/dataset_config.yaml).
    assert dict(tcn.cfg_extraccion) == {"fps_muestreo": 30, "confianza_deteccion": 0.5,
                                        "confianza_landmarks": 0.5}


def test_lstm_exportada(lstm):
    assert isinstance(lstm, LSTMExportado) and isinstance(lstm, ModeloDinamico)
    assert lstm.nombre == "lstm" and list(lstm.clases) == CLASES_LSTM
    assert lstm.clase_rechazo is None
    assert (lstm.spec.version, lstm.spec.T, lstm.spec.dim_entrada) == ("2.0", 30, 1577)


@pytest.mark.parametrize("nombre", ["tcn", "lstm"])
def test_ranking_completo_y_ordenado(nombre, tcn, lstm):
    modelo = {"tcn": tcn, "lstm": lstm}[nombre]
    cruda = secuencia_sintetica(2, 3, np.random.default_rng(7))
    ranking = modelo.ranking(cruda)
    assert sorted(s for s, _ in ranking) == sorted(modelo.clases)
    probabilidades = [p for _, p in ranking]
    assert probabilidades == sorted(probabilidades, reverse=True)
    assert sum(probabilidades) == pytest.approx(1.0, abs=1e-5)


@pytest.mark.parametrize("nombre", ["tcn", "lstm"])
@pytest.mark.parametrize("forma", [(0, 527), (10, 526), (10,)])
def test_ranking_vectores_v1_rechaza_formas_invalidas(nombre, forma, tcn, lstm):
    modelo = {"tcn": tcn, "lstm": lstm}[nombre]
    with pytest.raises(ValueError, match="527"):
        modelo.ranking_vectores_v1(np.zeros(forma, np.float32))


def test_ruta_tcn_apuntando_a_la_lstm_no_carga():
    ajustes = cargar_ajustes(modelo_dinamico="tcn")
    with pytest.raises(ModeloInvalido, match="arquitectura 'lstm'"):
        TCNLegado(str(ajustes.ruta_modelo_lstm), {"fps_muestreo": 30, "confianza_deteccion": 0.5,
                                                  "confianza_landmarks": 0.5})


def test_ruta_lstm_apuntando_a_la_tcn_no_carga():
    ajustes = cargar_ajustes()
    with pytest.raises(ModeloInvalido, match="arquitectura 'tcn'"):
        LSTMExportado(str(ajustes.ruta_modelo_tcn))


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
