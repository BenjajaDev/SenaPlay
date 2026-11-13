"""
El modelo estático que sirve la app es el de 21 letras de gestilingo-dev
(Roboflow + Kaggle, sin las letras con movimiento). Si un merge o un
reentrenamiento lo cambiara, esta prueba falla.
"""

import numpy as np
from fastapi.testclient import TestClient

import server
from inferencia.ajustes import cargar_ajustes
from model.predict import ClasificadorEstatico
from model.train_static import LETRAS_CON_MOVIMIENTO

LETRAS_CON_MOVIMIENTO_ESPERADAS = {"G", "J", "Ñ", "S", "X", "Z"}


def test_estatico_pkl_tiene_21_letras_sin_las_de_movimiento():
    modelo = ClasificadorEstatico(str(cargar_ajustes().ruta_modelo_estatico))
    clases = set(modelo._etiquetas)
    assert len(modelo._etiquetas) == 21 and len(clases) == 21
    assert clases.isdisjoint(LETRAS_CON_MOVIMIENTO_ESPERADAS)
    assert set(LETRAS_CON_MOVIMIENTO) == LETRAS_CON_MOVIMIENTO_ESPERADAS


def test_clasificar_responde_una_de_las_21():
    modelo = ClasificadorEstatico(str(cargar_ajustes().ruta_modelo_estatico))
    mano = np.random.default_rng(0).uniform(0.3, 0.7, (21, 3)).round(4).tolist()
    with TestClient(server.crear_app()) as cliente:
        r = cliente.post("/clasificar", json={"landmarks": mano})
    assert r.status_code == 200 and set(r.json()) == {"seña", "confianza"}
    assert r.json()["seña"] in modelo._etiquetas
