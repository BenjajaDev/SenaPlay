"""
Barreras de rechazo sobre SecuenciaCruda (inferencia/barreras.py), comparadas
con el cálculo legado sobre la matriz de 527 valores (tests/referencia_legado).
"""

import numpy as np
import pytest

from inferencia import barreras
from preprocessing.extraction import SecuenciaCruda
from tests import referencia_legado as legado
from tests.sintetico import secuencia_sintetica

HOMBRO_IZQ, HOMBRO_DER = 11, 12


def _secuencia(largo: int, con_mano: int, amplitud: float = 0.5,
               con_pose: int | None = None) -> SecuenciaCruda:
    """
    `con_mano` cuadros con la mano derecha (los primeros), `con_pose` cuadros
    con pose (todos si es None) y la muñeca derecha recorriendo `amplitud`
    anchos de hombro en x.
    """
    seq = SecuenciaCruda.vacia(largo)
    ancho = 0.2
    for t in range(largo):
        if t < con_mano:
            seq.manos[t, 1] = np.linspace(0.5, 0.6, 63).reshape(21, 3)
            seq.presencia_manos[t, 1] = 1.0
        if con_pose is None or t < con_pose:
            seq.pose[t, HOMBRO_IZQ] = [0.4, 0.6, 0.0]
            seq.pose[t, HOMBRO_DER] = [0.6, 0.6, 0.0]
            fase = t / max(largo - 1, 1)
            seq.pose[t, 16] = [0.55 + amplitud * ancho * fase, 0.4, 0.0]
            seq.pose[t, 15] = [0.45, 0.4, 0.0]
            seq.presencia_pose[t] = 1.0
    return seq


def _legado(seq: SecuenciaCruda, mejor: str = "J"):
    frames = legado.frames_legados(seq)
    matriz = legado.secuencia_a_matriz(frames)
    ratio = legado.ratio_con_mano_legado(frames)
    return ratio, legado._movimiento_muñecas(matriz), legado.motivo_legado(mejor, matriz, ratio)


# ── sin_mano en el límite ─────────────────────────────────────────────────────

@pytest.mark.parametrize("largo,con_mano", [
    (80, 23), (80, 24), (80, 25),          # 0,2875 · 0,3 exacto · 0,3125
    (80, 1), (80, 3), (40, 7),             # 1/80, 3/80 y 7/40: un 5 en el cuarto decimal
    (80, 7), (80, 21),                     # donde 1 − (1 − x) redondea distinto que x
    (10, 3), (10, 2), (7, 2), (120, 36), (120, 35),
])
def test_ratio_y_sin_mano_igual_que_el_legado(largo, con_mano):
    seq = _secuencia(largo, con_mano)
    ratio_legado, _, motivo_esperado = _legado(seq)
    evaluacion = barreras.evaluar(seq, "J", "ninguna")
    assert evaluacion.ratio_con_mano == ratio_legado
    assert (evaluacion.motivo == "sin_mano") == (motivo_esperado == "sin_mano")


def test_ochenta_cuadros_en_el_limite():
    assert barreras.evaluar(_secuencia(80, 23), "J", "ninguna").motivo == "sin_mano"
    assert barreras.evaluar(_secuencia(80, 24), "J", "ninguna").motivo is None   # 0,3 no es < 0,3
    assert barreras.evaluar(_secuencia(80, 25), "J", "ninguna").motivo is None


def test_ratio_no_usa_uno_menos_ratio_sin_manos():
    # Con L ≤ 120, las dos fórmulas difieren en 10 casos, todos con L = 80
    # (1/80 → 0,013 frente a 0,012). El servidor legado usaba con_mano / L.
    for con_mano in (1, 7, 21):
        seq = _secuencia(80, con_mano)
        assert barreras.ratio_con_mano(seq) == round(con_mano / 80, 3)
        assert barreras.ratio_con_mano(seq) != round(1 - seq.ratio_sin_manos(), 3)


def test_secuencia_vacia():
    seq = SecuenciaCruda.vacia(0)
    evaluacion = barreras.evaluar(seq, "J", "ninguna")
    assert evaluacion.ratio_con_mano == 0.0 and evaluacion.motivo == "sin_mano"
    assert evaluacion.movimiento_muñeca is None


# ── poco_movimiento ───────────────────────────────────────────────────────────

def test_mano_quieta_da_poco_movimiento():
    evaluacion = barreras.evaluar(_secuencia(30, 30, amplitud=0.0), "J", "ninguna")
    assert evaluacion.motivo == "poco_movimiento"
    assert evaluacion.movimiento_muñeca == pytest.approx(0.0, abs=1e-6)


@pytest.mark.parametrize("amplitud", [0.079, 0.0799, 0.0801, 0.081, 0.3])
def test_movimiento_igual_que_el_legado(amplitud):
    seq = _secuencia(30, 30, amplitud=amplitud)
    _, movimiento_legado, motivo_esperado = _legado(seq)
    evaluacion = barreras.evaluar(seq, "J", "ninguna")
    assert evaluacion.movimiento_muñeca == pytest.approx(movimiento_legado, abs=1e-6)
    assert evaluacion.movimiento_muñeca == pytest.approx(amplitud, abs=1e-5)
    assert evaluacion.motivo == motivo_esperado


@pytest.mark.parametrize("con_pose", [0, 14])
def test_sin_pose_suficiente_no_mide_movimiento(con_pose):
    # Con pose en menos de la mitad de los cuadros no hay marco fiable: decide el modelo.
    seq = _secuencia(30, 30, amplitud=0.0, con_pose=con_pose)
    evaluacion = barreras.evaluar(seq, "J", "ninguna")
    assert evaluacion.movimiento_muñeca is None and evaluacion.motivo is None
    assert _legado(seq)[1] is None


def test_con_pose_en_la_mitad_si_mide():
    seq = _secuencia(30, 30, amplitud=0.0, con_pose=15)
    assert barreras.evaluar(seq, "J", "ninguna").motivo == "poco_movimiento"


# ── modelo_sin_seña y precedencia ─────────────────────────────────────────────

def test_modelo_sin_seña_cuando_el_modelo_rechaza():
    assert barreras.evaluar(_secuencia(30, 30), "ninguna", "ninguna").motivo == "modelo_sin_seña"


def test_sin_clase_de_rechazo_nunca_hay_modelo_sin_seña():
    # Aunque el modelo respondiera «ninguna», sin clase de rechazo la barrera no existe.
    for seq in (_secuencia(30, 30), _secuencia(30, 30, amplitud=0.0), _secuencia(30, 5)):
        assert barreras.evaluar(seq, "ninguna", None).motivo != "modelo_sin_seña"
    assert barreras.evaluar(_secuencia(30, 30), "ninguna", None).motivo is None


def test_precedencia():
    quieta_sin_mano = _secuencia(30, 3, amplitud=0.0)
    assert barreras.evaluar(quieta_sin_mano, "ninguna", "ninguna").motivo == "sin_mano"
    quieta = _secuencia(30, 30, amplitud=0.0)
    assert barreras.evaluar(quieta, "ninguna", "ninguna").motivo == "poco_movimiento"


def test_barreras_activas():
    assert barreras.barreras_activas("ninguna") == {
        "sin_mano": True, "poco_movimiento": True, "modelo_sin_seña": True}
    assert barreras.barreras_activas(None)["modelo_sin_seña"] is False


# ── Equivalencia con el legado en secuencias variadas ────────────────────────

def test_equivalencia_en_secuencias_sinteticas():
    rng = np.random.default_rng(3)
    for i in range(500):
        seq = secuencia_sintetica(i % 6, i % 10, rng)
        # Mezclar casos: sin pose en parte de los cuadros y manos que se pierden.
        if i % 4 == 1:
            seq.presencia_pose[: len(seq) // 2 + i % 7] = 0.0
            seq.pose[seq.presencia_pose < 0.5] = 0.0
        if i % 3 == 2:
            seq.presencia_manos[: int(len(seq) * 0.75)] = 0.0
            seq.manos[seq.presencia_manos < 0.5] = 0.0
        mejor = "ninguna" if i % 5 == 0 else "J"
        ratio, movimiento, motivo = _legado(seq, mejor)
        evaluacion = barreras.evaluar(seq, mejor, "ninguna")
        assert evaluacion.ratio_con_mano == ratio
        assert evaluacion.motivo == motivo, i
        if movimiento is None:
            assert evaluacion.movimiento_muñeca is None
        else:
            assert evaluacion.movimiento_muñeca == pytest.approx(movimiento, abs=1e-6)
