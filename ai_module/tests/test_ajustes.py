"""Ajustes del servidor (inferencia/ajustes.py): valores por defecto, entorno y errores."""

import pytest
from fastapi.testclient import TestClient

import server
from inferencia.ajustes import DIR_MODULO, AjustesInvalidos, cargar_ajustes


@pytest.fixture(autouse=True)
def _entorno_limpio(monkeypatch):
    for variable in ("MODELO_DINAMICO", "RUTA_MODELO_TCN", "RUTA_MODELO_LSTM",
                     "RUTA_MODELO_ESTATICO", "PRECARGAR_MODELOS", "MAX_CUADROS_VIDEO"):
        monkeypatch.delenv(variable, raising=False)


def test_por_defecto_sirve_la_tcn_legada():
    ajustes = cargar_ajustes()
    assert ajustes.modelo_dinamico == "tcn"
    assert ajustes.ruta_modelo_dinamico == DIR_MODULO / "data" / "models" / "dinamico_tcn.pt"
    assert ajustes.max_cuadros_tramo == 120 and ajustes.max_cuadros_video == 300
    assert ajustes.precargar_modelos is False


def test_lee_el_entorno(monkeypatch):
    monkeypatch.setenv("MODELO_DINAMICO", "lstm")
    monkeypatch.setenv("MAX_CUADROS_VIDEO", "150")
    monkeypatch.setenv("PRECARGAR_MODELOS", "1")
    ajustes = cargar_ajustes()
    assert ajustes.ruta_modelo_dinamico == DIR_MODULO / "models_saved" / "dinamico.pt"
    assert ajustes.max_cuadros_video == 150 and ajustes.precargar_modelos is True


@pytest.mark.parametrize("valor", ["xyz", "TCN", "Lstm", ""])
def test_modelo_dinamico_invalido(monkeypatch, valor):
    monkeypatch.setenv("MODELO_DINAMICO", valor)
    with pytest.raises(AjustesInvalidos) as error:
        cargar_ajustes()
    assert "MODELO_DINAMICO" in str(error.value) and "'tcn' o 'lstm'" in str(error.value)


def test_archivo_inexistente_nombra_la_variable(tmp_path):
    with pytest.raises(AjustesInvalidos, match="RUTA_MODELO_TCN: no existe el archivo"):
        cargar_ajustes(ruta_modelo_tcn=tmp_path / "no_existe.pt")


def test_con_lstm_no_se_exige_la_tcn(tmp_path):
    ajustes = cargar_ajustes(modelo_dinamico="lstm", ruta_modelo_tcn=tmp_path / "no_existe.pt")
    assert ajustes.modelo_dinamico == "lstm"


def test_con_tcn_no_se_exige_la_lstm(tmp_path):
    assert cargar_ajustes(ruta_modelo_lstm=tmp_path / "no_existe.pt").modelo_dinamico == "tcn"


def test_sin_modelo_estatico_no_arranca(tmp_path):
    with pytest.raises(AjustesInvalidos, match="RUTA_MODELO_ESTATICO"):
        cargar_ajustes(ruta_modelo_estatico=tmp_path / "no_existe.pkl")


def test_rutas_relativas_desde_ai_module(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)  # lanzar uvicorn desde otra carpeta no cambia nada
    monkeypatch.setenv("RUTA_MODELO_TCN", "data/models/dinamico_tcn.pt")
    assert cargar_ajustes().ruta_modelo_tcn == DIR_MODULO / "data" / "models" / "dinamico_tcn.pt"


@pytest.mark.parametrize("campo,valor", [("max_cuadros_video", 0), ("max_bytes_cuadro", -1),
                                         ("max_cuadros_tramo", "abc")])
def test_limites_invalidos(campo, valor):
    with pytest.raises(AjustesInvalidos, match=campo.upper()):
        cargar_ajustes(**{campo: valor})


def test_limites_incoherentes():
    with pytest.raises(AjustesInvalidos, match="MAX_BYTES_VIDEO"):
        cargar_ajustes(max_bytes_video=9 * 1024 * 1024, max_bytes_cuerpo_video=9 * 1024 * 1024)
    with pytest.raises(AjustesInvalidos, match="MAX_BYTES_CUADRO"):
        cargar_ajustes(max_bytes_cuadro=2048, max_bytes_cuerpo_frames=1024)


def test_el_servidor_no_arranca_con_ajustes_invalidos(monkeypatch):
    monkeypatch.setenv("MODELO_DINAMICO", "xyz")
    with pytest.raises(AjustesInvalidos):
        with TestClient(server.crear_app()):
            pass


def test_el_servidor_arranca_con_los_ajustes_por_defecto():
    with TestClient(server.crear_app()) as cliente:
        estado = cliente.get("/").json()
    assert estado["modelo_dinamico_listo"] is True
