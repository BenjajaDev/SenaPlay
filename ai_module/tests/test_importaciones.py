"""
Lo que importa el servidor y lo que exporta la capa de compatibilidad.

- `server` no debe arrastrar pandas, matplotlib ni training/: la imagen de
  Docker solo trae requirements-server.txt.
- Los scripts legados de scripts/ siguen importando: el merge con
  feat/ia-comparacion-temporal reemplazó holistic_pipeline por una capa de
  compatibilidad sobre preprocessing/.
"""

import ast
import os
import subprocess
import sys

import numpy as np
import pytest

DIR_MODULO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS_LEGADOS = ["scripts.extract_landmarks", "scripts.train_model", "scripts.augmentation",
                   "scripts.generar_negativos", "scripts.visualize_results"]


def _en_proceso_limpio(codigo: str) -> str:
    resultado = subprocess.run([sys.executable, "-c", codigo], cwd=DIR_MODULO,
                               capture_output=True, text=True, timeout=300)
    assert resultado.returncode == 0, resultado.stderr[-2000:]
    return resultado.stdout.strip()


def test_el_servidor_no_carga_dependencias_de_entrenamiento():
    salida = _en_proceso_limpio(
        "import sys, server\n"
        "print(sorted(m for m in ('pandas', 'matplotlib', 'training', 'scripts.holistic_pipeline')"
        " if m in sys.modules))")
    assert salida == "[]"


@pytest.mark.parametrize("modulo", SCRIPTS_LEGADOS)
def test_scripts_legados_importan(modulo):
    _en_proceso_limpio(f"import {modulo}")


def test_la_capa_de_compatibilidad_exporta_todo_lo_que_se_le_pide():
    import scripts.holistic_pipeline as hp

    faltan = []
    for raiz, _, archivos in os.walk(DIR_MODULO):
        if ".venv" in raiz:
            continue
        for archivo in archivos:
            if not archivo.endswith(".py"):
                continue
            ruta = os.path.join(raiz, archivo)
            for nodo in ast.walk(ast.parse(open(ruta, encoding="utf-8").read())):
                if isinstance(nodo, ast.ImportFrom) and nodo.module == "scripts.holistic_pipeline":
                    faltan += [f"{archivo}: {a.name}" for a in nodo.names if not hasattr(hp, a.name)]
    assert faltan == []


def test_normalizar_forma_mano_igual_que_el_legado():
    from scripts.holistic_pipeline import _normalizar_forma_mano
    from tests.referencia_legado import _normalizar_forma_mano as legado

    rng = np.random.default_rng(5)
    for _ in range(50):
        mano = rng.uniform(0, 1, (21, 3)).astype(np.float32)
        np.testing.assert_allclose(_normalizar_forma_mano(mano), legado(mano), atol=1e-6)
    degenerada = np.zeros((21, 3), np.float32)   # escala < 1e-6: no se divide
    np.testing.assert_array_equal(_normalizar_forma_mano(degenerada), legado(degenerada))
