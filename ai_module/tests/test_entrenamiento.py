"""Determinismo con semilla fija y flujo de extremo a extremo sobre datos sintéticos."""

import os

import numpy as np
import pytest
import torch

from tests.sintetico import experimento_rapido


@pytest.fixture(scope="module")
def cfg_y_datos(dataset_sintetico, tmp_path_factory):
    from training.train import preparar

    cfg = experimento_rapido({"manifiesto": dataset_sintetico["manifiesto"],
                              "config_manifiesto": dataset_sintetico["config_manifiesto"]},
                             str(tmp_path_factory.mktemp("resultados")), epocas=2,
                             n_pliegues=2, n_val=2)
    _, datos = preparar(cfg)
    return cfg, datos


def _entrenar(cfg, datos, semilla, arquitectura="gru"):
    from common.reproducibilidad import fijar_semilla
    from models.factory import construir_modelo
    from training.train import entrenar_modelo

    cfg_modelo = next(m for m in cfg["modelos"] if m["arquitectura"] == arquitectura)
    rng = fijar_semilla(semilla)
    modelo = construir_modelo(cfg_modelo, datos.preprocesador.dim_entrada, len(datos.clases))
    idx = np.arange(len(datos))
    entrenar_modelo(modelo, datos, idx[::2], idx[1::2], cfg["entrenamiento"], rng)
    return modelo.state_dict()


@pytest.mark.parametrize("arquitectura", ["tcn", "lstm", "gru"])
def test_determinismo_con_semilla_fija(cfg_y_datos, arquitectura):
    cfg, datos = cfg_y_datos
    a = _entrenar(cfg, datos, 0, arquitectura)
    b = _entrenar(cfg, datos, 0, arquitectura)
    c = _entrenar(cfg, datos, 1, arquitectura)
    assert all(torch.equal(a[k], b[k]) for k in a)
    assert not all(torch.equal(a[k], c[k]) for k in a)


@pytest.mark.lento
def test_run_all_seleccion_y_exportacion(cfg_y_datos, tmp_path):
    from models import checkpoint
    from training import evaluate
    from training.run_all import correr_todo
    from training.select_model import construir_meta, entrenar_final, seleccionar

    cfg, datos = cfg_y_datos
    infos = correr_todo(cfg, verbose=False)
    assert {i["arquitectura"] for i in infos} == {"tcn", "lstm", "gru"}
    for i in infos:
        d = i["directorio"]
        for archivo in ("config.yaml", "commit.txt", "metrics_per_fold.csv", "summary.csv",
                        "confusion_matrix.png", "f1_per_signer.png", "latency.csv",
                        "particiones.json"):
            assert os.path.exists(os.path.join(evaluate.resolver(d), archivo)), archivo

    df = evaluate.resumir_todo(cfg["salidas"]["directorio"], dpi=60)
    assert len(df) == 3
    assert os.path.exists(os.path.join(cfg["salidas"]["directorio"], "summary_all.md"))

    elegida, texto = seleccionar(cfg["salidas"]["directorio"], cfg["nombre"])
    assert elegida["arquitectura"] in texto
    cfg_modelo = next(m for m in cfg["modelos"] if m["arquitectura"] == elegida["arquitectura"])
    modelo, r, signers_val = entrenar_final(cfg, cfg_modelo, datos, verbose=False)
    assert not set(signers_val) & set(datos.grupos[np.isin(datos.grupos, signers_val, invert=True)])
    ruta = str(tmp_path / "dinamico.pt")
    checkpoint.guardar(modelo, construir_meta(cfg, cfg_modelo, datos, modelo, r, signers_val, 0), ruta)
    recargado, meta = checkpoint.cargar(ruta)
    assert meta["clases"] == datos.clases and meta["T"] == 30
    assert os.path.exists(checkpoint.ruta_meta(ruta))
    x = datos.lote([0, 1])
    torch.testing.assert_close(recargado(x), modelo.eval()(x))
