import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture(scope="session")
def dataset_sintetico(tmp_path_factory):
    """3 clases × 8 signers de secuencias crudas sintéticas, con manifiesto."""
    from tests.sintetico import generar

    salida = tmp_path_factory.mktemp("sintetico")
    datos = generar(str(salida), n_clases=3, n_signers=8, semilla=0)
    return {"dir": str(salida), **datos}


@pytest.fixture
def rng():
    return np.random.default_rng(0)
