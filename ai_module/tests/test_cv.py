"""Particiones agrupadas: ningún signer compartido entre entrenamiento, validación y prueba."""

import numpy as np
import pytest

from training.cv import FugaDeSignersError, Particion, generar_particiones, verificar_sin_fuga


def _dataset(n_signers=25, n_clases=9, faltantes=0.1, semilla=0):
    rng = np.random.default_rng(semilla)
    y, grupos = [], []
    for s in range(n_signers):
        for c in range(n_clases):
            if rng.random() > faltantes:
                y.append(c)
                grupos.append(f"s{s:02d}")
    return np.array(y), np.array(grupos)


@pytest.mark.parametrize("loso", [False, True])
def test_sin_fuga_de_signers(loso):
    y, grupos = _dataset()
    cfg = {"esquema": "kfold", "n_pliegues": 5, "n_signers_validacion": 3, "semilla_particion": 42}
    particiones = generar_particiones(y, grupos, cfg, loso=loso)
    assert len(particiones) == (25 if loso else 5)
    en_prueba = []
    for p in particiones:
        s_ent, s_val, s_pru = (set(grupos[i]) for i in (p.entrenamiento, p.validacion, p.prueba))
        assert not (s_ent & s_val) and not (s_ent & s_pru) and not (s_val & s_pru)
        assert len(s_val) == 3
        assert len(p.entrenamiento) + len(p.validacion) + len(p.prueba) == len(y)
        en_prueba += sorted(s_pru)
    # cada signer queda en prueba exactamente una vez
    assert sorted(en_prueba) == sorted(set(grupos))


def test_particiones_deterministas():
    y, grupos = _dataset()
    cfg = {"n_pliegues": 5, "n_signers_validacion": 3, "semilla_particion": 7}
    a = generar_particiones(y, grupos, cfg)
    b = generar_particiones(y, grupos, cfg)
    for pa, pb in zip(a, b):
        np.testing.assert_array_equal(pa.prueba, pb.prueba)
        np.testing.assert_array_equal(pa.validacion, pb.validacion)


def test_verificacion_detecta_fuga():
    grupos = np.array(["a", "a", "b", "c"])
    fuga = Particion(0, np.array([0]), np.array([2]), np.array([1, 3]))
    with pytest.raises(FugaDeSignersError):
        verificar_sin_fuga(fuga, grupos)


def test_pocos_signers_para_los_pliegues():
    y, grupos = _dataset(n_signers=4, n_clases=2, faltantes=0)
    with pytest.raises(ValueError):
        generar_particiones(y, grupos, {"n_pliegues": 5, "n_signers_validacion": 1})
