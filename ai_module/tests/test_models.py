"""Forma de las salidas y propiedades de los tres modelos."""

import pytest
import torch

from common.config import cargar_yaml
from models.factory import arquitecturas_disponibles, construir_modelo, contar_parametros

ARQUITECTURAS = ["tcn", "lstm", "gru"]


@pytest.mark.parametrize("arquitectura", ARQUITECTURAS)
@pytest.mark.parametrize("B,T,F,C", [(1, 30, 1577, 9), (4, 30, 527, 3), (2, 45, 64, 5)])
def test_forma_de_salida(arquitectura, B, T, F, C):
    modelo = construir_modelo(cargar_yaml(f"config/modelos/{arquitectura}.yaml"), F, C).eval()
    y = modelo(torch.randn(B, T, F))
    assert y.shape == (B, C)
    assert torch.isfinite(y).all()


@pytest.mark.parametrize("cfg", [
    {"arquitectura": "tcn", "causal": True, "pooling": "ultimo"},
    {"arquitectura": "lstm", "bidireccional": False, "pooling": "ultimo", "capas": 1},
    {"arquitectura": "gru", "proyeccion": None, "cabeza_oculta": 32},
])
def test_variantes_de_ablacion(cfg):
    y = construir_modelo(cfg, 100, 4).eval()(torch.randn(3, 30, 100))
    assert y.shape == (3, 4)


def test_entrada_con_forma_incorrecta_falla():
    modelo = construir_modelo({"arquitectura": "gru"}, 100, 4)
    with pytest.raises(ValueError):
        modelo(torch.randn(3, 100))


def test_tcn_causal_no_mira_el_futuro():
    torch.manual_seed(0)
    m = construir_modelo({"arquitectura": "tcn", "causal": True}, 10, 3).eval()
    x = torch.randn(1, 30, 10)
    x2 = x.clone()
    x2[:, 20:] += 5.0
    h1 = m.tcn(m.proyeccion(x).transpose(1, 2))
    h2 = m.tcn(m.proyeccion(x2).transpose(1, 2))
    assert torch.allclose(h1[..., :20], h2[..., :20])
    assert not torch.allclose(h1[..., 20:], h2[..., 20:])


def test_parametros_del_mismo_orden():
    conteos = {a: contar_parametros(construir_modelo(cargar_yaml(f"config/modelos/{a}.yaml"), 1577, 9))
               for a in ARQUITECTURAS}
    assert max(conteos.values()) / min(conteos.values()) < 1.5, conteos


def test_tcn_legada_carga_checkpoint_de_la_version_anterior():
    from model.tcn import ModeloTCN

    legado = ModeloTCN(527, 9)
    claves = set(legado.state_dict())
    assert "tcn.0.conv1.weight" in claves and "clasificador.3.weight" in claves
    assert not any(k.startswith("proyeccion") for k in claves)
    assert legado(torch.randn(2, 60, 527)).shape == (2, 9)


def test_fabrica():
    assert arquitecturas_disponibles() == ["gru", "lstm", "tcn"]
    with pytest.raises(ValueError):
        construir_modelo({"arquitectura": "transformer"}, 10, 2)
