"""Criterio de comparación de scripts/verificar_equivalencia.py (§4.3 del diseño)."""

import copy

from scripts.verificar_equivalencia import comparar


def _fila(seña="J", confianza=0.8123, motivo=None, alternativas=(("Z", 0.1), ("G", 0.05)),
          movimiento=0.31, frames=40, ratio=0.95, status=200):
    return {"status": status, "cuerpo": {
        "seña": seña, "confianza": confianza, "es_seña": motivo is None, "motivo": motivo,
        "alternativas": [{"seña": s, "confianza": p} for s, p in alternativas],
        "movimiento_muñeca": movimiento, "frames_procesados": frames, "ratio_con_mano": ratio}}


def test_iguales_dentro_de_la_tolerancia():
    ref, cand = _fila(), _fila(confianza=0.8124)
    assert comparar(ref, cand)[0] == "igual"


def test_confianza_fuera_de_tolerancia():
    assert comparar(_fila(), _fila(confianza=0.8126))[0] == "DIFERENTE"


def test_motivo_o_ratio_distintos():
    assert comparar(_fila(), _fila(motivo="poco_movimiento"))[0] == "DIFERENTE"
    assert comparar(_fila(), _fila(ratio=0.94))[0] == "DIFERENTE"
    assert comparar(_fila(), _fila(movimiento=0.3125))[0] == "DIFERENTE"
    assert comparar(_fila(), _fila(movimiento=0.3105))[0] == "igual"


def test_empate_entre_las_dos_mejores():
    ref = _fila(seña="J", confianza=0.45, alternativas=(("Z", 0.44995), ("G", 0.1)))
    cand = _fila(seña="Z", confianza=0.45, alternativas=(("J", 0.44995), ("G", 0.1)))
    assert comparar(ref, cand)[0] == "empate"
    # Si no casi empatan, cambiar de seña es una diferencia.
    lejos = _fila(seña="J", confianza=0.6, alternativas=(("Z", 0.3), ("G", 0.1)))
    assert comparar(lejos, copy.deepcopy(cand))[0] == "DIFERENTE"


def test_status_y_diferencias_esperadas():
    error = {"status": 422, "cuerpo": {"detail": "x"}}
    assert comparar(error, {"status": 422, "cuerpo": {"detail": "otro texto"}})[0] == "igual"
    assert comparar(error, {"status": 500, "cuerpo": "x"})[0] == "DIFERENTE"
    assert comparar({"status": 500, "cuerpo": ""}, error, esperada=(500, 422))[0] == "diferencia_esperada"
    assert comparar({"status": 200, "cuerpo": {}}, error, esperada=(500, 422))[0] == "DIFERENTE"


def test_respuesta_estatica():
    ref = {"status": 200, "cuerpo": {"seña": "A", "confianza": 0.7}}
    assert comparar(ref, {"status": 200, "cuerpo": {"seña": "A", "confianza": 0.70005}})[0] == "igual"
    assert comparar(ref, {"status": 200, "cuerpo": {"seña": "B", "confianza": 0.7}})[0] == "DIFERENTE"
