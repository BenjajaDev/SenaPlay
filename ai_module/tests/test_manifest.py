"""Manifiesto: resolución del signer, plantilla y descartes (sin MediaPipe)."""

import os

import numpy as np
import pandas as pd
import pytest

from data.manifest import SignersSinResolver, generar_manifiesto
from preprocessing.extraction import SecuenciaCruda


def _cfg(tmp_path):
    return {
        "rutas": {"videos": str(tmp_path / "raw"), "landmarks": str(tmp_path / "lm"),
                  "manifiesto": str(tmp_path / "manifest.csv"),
                  "signers": str(tmp_path / "signers.csv"),
                  "plantilla_signers": str(tmp_path / "signers_template.csv"),
                  "clases": "config/datos/classes.yaml",
                  "preprocesamiento": "config/preprocesamiento/features.yaml"},
        "extensiones": [".mp4", ".mov"],
        "descarte": {"max_ratio_sin_manos": 0.30, "min_frames": 8},
        "lote_por_defecto": "lote_00",
        "patron_nombre": r"^(?P<clase>.+?)_(?P<signer>.+?)_(?P<numero>\d+)$",
    }


def _video(tmp_path, rel):
    ruta = tmp_path / "raw" / rel
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(b"")


def _extractor(ratio_con_mano):
    def extraer(ruta, cfg):
        seq = SecuenciaCruda.vacia(20)
        n = int(round(20 * ratio_con_mano))
        seq.presencia_manos[:n, 1] = 1
        seq.info = {"fps_fuente": 30.0, "n_frames_fuente": 20, "duracion_s": 0.667}
        return seq
    return extraer


def test_plantilla_si_no_se_deduce_el_signer(tmp_path):
    _video(tmp_path, "G/G_ana_01.mp4")
    _video(tmp_path, "G/grabacion.MOV")
    with pytest.raises(SignersSinResolver):
        generar_manifiesto(_cfg(tmp_path), extractor=_extractor(1.0), verbose=False)
    plantilla = pd.read_csv(tmp_path / "signers_template.csv", dtype=str).fillna("")
    assert list(plantilla.columns) == ["video_path", "sign_class", "signer_id", "session_id", "device"]
    assert set(plantilla["signer_id"]) == {"ana", ""}
    assert not (tmp_path / "manifest.csv").exists()    # se detuvo antes de extraer


def test_manifiesto_completo(tmp_path):
    _video(tmp_path, "G/G_ana_01.mp4")         # patrón de nombre
    _video(tmp_path, "Z/beto/toma1.mov")        # carpeta intermedia
    _video(tmp_path, "Q/Q_ana_01.mp4")          # clase sin tipo
    cfg = _cfg(tmp_path)
    df = generar_manifiesto(cfg, batch_id="lote_07", extractor=_extractor(1.0), verbose=False)
    assert list(df.columns) == ["video_path", "sign_class", "sign_type", "signer_id", "session_id",
                                "batch_id", "n_frames", "fps", "duration_s", "device", "status",
                                "discard_reason"]
    fila = df.set_index("sign_class")
    assert fila.loc["G", "signer_id"] == "ana" and fila.loc["G", "sign_type"] == "dynamic"
    assert fila.loc["Z", "signer_id"] == "beto"
    assert fila.loc["Q", "status"] == "discarded"
    assert (df["batch_id"] == "lote_07").all()
    assert os.path.exists(tmp_path / "lm" / "G" / "G_ana_01.npz")


def test_descarte_por_frames_sin_manos_y_lotes(tmp_path):
    _video(tmp_path, "S/S_ana_01.mp4")
    cfg = _cfg(tmp_path)
    df = generar_manifiesto(cfg, extractor=_extractor(0.6), verbose=False)   # 40 % sin manos
    assert df.loc[0, "status"] == "discarded" and "40%" in df.loc[0, "discard_reason"]

    # un video nuevo toma el lote nuevo; el anterior conserva el suyo
    _video(tmp_path, "S/S_beto_01.mp4")
    df = generar_manifiesto(cfg, batch_id="lote_01", extractor=_extractor(0.9), verbose=False)
    lotes = dict(zip(df["signer_id"], df["batch_id"]))
    assert lotes == {"ana": "lote_00", "beto": "lote_01"}


def test_signers_csv_tiene_prioridad(tmp_path):
    _video(tmp_path, "X/X_ana_01.mp4")
    cfg = _cfg(tmp_path)
    video_path = os.path.relpath(tmp_path / "raw" / "X" / "X_ana_01.mp4",
                                 os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    pd.DataFrame([{"video_path": video_path, "sign_class": "X", "signer_id": "p07",
                   "session_id": "s2", "device": "iPhone 13"}]).to_csv(tmp_path / "signers.csv",
                                                                     index=False)
    df = generar_manifiesto(cfg, extractor=_extractor(1.0), verbose=False)
    assert df.loc[0, ["signer_id", "session_id", "device"]].tolist() == ["p07", "s2", "iPhone 13"]
    assert np.isclose(float(df.loc[0, "duration_s"]), 0.667)
