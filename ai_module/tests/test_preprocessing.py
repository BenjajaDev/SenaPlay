"""Remuestreo, features, normalización y equivalencia con el vector legado."""

import numpy as np
import pytest

from preprocessing.augmentation import Aumentador, permutacion_espejo_pose
from preprocessing.extraction import SecuenciaCruda, frames_a_secuencia
from preprocessing.features import matriz_entrada
from preprocessing.normalization import a_matriz_base, desde_matriz_base, normalizar
from preprocessing.pipeline import Preprocesador
from preprocessing.resampling import remuestrear
from preprocessing.spec import GRUPOS_CARA, GRUPOS_CARA_V1, FeatureSpec, indices_cara
from tests import referencia_legado as legado
from tests.sintetico import secuencia_sintetica


def _frames_aleatorios(rng, n=47):
    frames = []
    for _ in range(n):
        frames.append({
            "mano_izq": rng.random((21, 3)).astype(np.float32) if rng.random() > .3 else None,
            "mano_der": rng.random((21, 3)).astype(np.float32) if rng.random() > .3 else None,
            "pose": rng.random((33, 3)).astype(np.float32) if rng.random() > .2 else None,
            "cara": rng.random((478, 3)).astype(np.float32) if rng.random() > .2 else None,
        })
    return frames


@pytest.mark.parametrize("largo", [1, 7, 29, 30, 31, 90, 200])
@pytest.mark.parametrize("T", [15, 30, 60])
def test_largo_tras_remuestreo(largo, T, rng):
    x = rng.random((largo, 5, 3)).astype(np.float32)
    y = remuestrear(x, T)
    assert y.shape == (T, 5, 3)
    np.testing.assert_allclose(y[0], x[0], atol=1e-6)
    np.testing.assert_allclose(y[-1], x[-1], atol=1e-6)


def test_remuestreo_de_secuencia_vacia():
    assert remuestrear(np.zeros((0, 4), np.float32), 30).shape == (30, 4)


@pytest.mark.parametrize("largo", [12, 30, 75])
def test_preprocesador_devuelve_T_por_dim_entrada(largo, rng):
    spec = FeatureSpec()
    cruda = frames_a_secuencia(_frames_aleatorios(rng, largo), 30)
    x = Preprocesador(spec).desde_cruda(cruda)
    assert x.shape == (spec.T, spec.dim_entrada) == (30, 1577)
    assert x.dtype == np.float32


def test_reproduce_vector_legado(rng):
    """FeatureSpec.v1() reproduce el vector de 527 del pipeline anterior (remuestreado a 60)."""
    frames = _frames_aleatorios(rng)
    idx = indices_cara(GRUPOS_CARA_V1)
    frames_legado = [{"mano_izq": f["mano_izq"], "mano_der": f["mano_der"],
                      "pose_superior": None if f["pose"] is None else f["pose"][:17],
                      "cara": None if f["cara"] is None else f["cara"][idx]} for f in frames]
    esperado = legado.remuestrear_temporal(legado.secuencia_a_matriz(frames_legado), 60)
    obtenido = Preprocesador(FeatureSpec.v1(T=60)).desde_cruda(frames_a_secuencia(frames, 30))
    np.testing.assert_allclose(obtenido, esperado, atol=1e-5)


def test_capa_de_compatibilidad_legada(rng):
    import scripts.holistic_pipeline as hp

    frames = [{"mano_izq": rng.random((21, 3)), "mano_der": None,
               "pose_superior": rng.random((17, 3)) if i % 3 else None,
               "cara": rng.random((116, 3)) if i % 4 else None} for i in range(12)]
    np.testing.assert_allclose(hp.secuencia_a_matriz(frames), legado.secuencia_a_matriz(frames),
                               atol=1e-5)
    assert hp.N_FEATURES_FRAME == 527


def test_vectores_v1_ida_y_vuelta(rng):
    spec = FeatureSpec.v1()
    sn = normalizar(frames_a_secuencia(_frames_aleatorios(rng, 20), 30), spec)
    base = a_matriz_base(sn)
    np.testing.assert_allclose(a_matriz_base(desde_matriz_base(base, spec)), base)


def test_vectores_v1_incompatibles_con_manos_corporales(rng):
    pre = Preprocesador(FeatureSpec(marco_manos="corporal"))
    with pytest.raises(ValueError):
        pre.desde_vectores_v1(np.zeros((20, 527), np.float32))


def test_indices_faciales_congelados_coinciden_con_mediapipe():
    fl = pytest.importorskip("mediapipe.tasks.python.vision.face_landmarker")
    C = fl.FaceLandmarksConnections
    grupos = {"labios": C.FACE_LANDMARKS_LIPS, "ojo_izq": C.FACE_LANDMARKS_LEFT_EYE,
              "ojo_der": C.FACE_LANDMARKS_RIGHT_EYE, "ceja_izq": C.FACE_LANDMARKS_LEFT_EYEBROW,
              "ceja_der": C.FACE_LANDMARKS_RIGHT_EYEBROW, "nariz": C.FACE_LANDMARKS_NOSE,
              "ovalo": C.FACE_LANDMARKS_FACE_OVAL}
    for nombre, conexiones in grupos.items():
        assert GRUPOS_CARA[nombre] == sorted({c.start for c in conexiones} | {c.end for c in conexiones})
    assert len(indices_cara(GRUPOS_CARA_V1)) == 116


def test_layout_y_ablacion_de_bloques():
    for pos, vel, acc in [(1, 0, 0), (1, 1, 0), (0, 1, 1), (1, 1, 1)]:
        spec = FeatureSpec(posicion=bool(pos), velocidad=bool(vel), aceleracion=bool(acc))
        assert spec.layout()[-1][2] == spec.dim_entrada
        assert spec.dim_entrada == 527 * pos + 525 * (vel + acc)
    with pytest.raises(ValueError):
        FeatureSpec(posicion=False, velocidad=False, aceleracion=False)


def test_subconjunto_facial_configurable():
    spec = FeatureSpec.desde_config({"partes": {"cara": {"grupos": ["labios", "ovalo"]}}})
    assert spec.n_cara == 76 and spec.dim_base == 128 + 51 + 76 * 3


def test_normalizacion_marco_hombros_y_presencia():
    seq = SecuenciaCruda.vacia(3)
    seq.pose[:, 11] = [0.4, 0.5, 0.0]
    seq.pose[:, 12] = [0.6, 0.5, 0.0]
    seq.presencia_pose[:] = 1
    seq.manos[:, 1] = 0.5
    seq.manos[:, 1, 9] = [0.5, 0.4, 0.0]
    seq.presencia_manos[:, 1] = 1
    sn = normalizar(seq, FeatureSpec(marco_manos="corporal"))
    np.testing.assert_allclose(sn.pose[0, 11], [-0.5, 0, 0], atol=1e-6)   # (0.4-0.5)/0.2
    np.testing.assert_allclose(sn.pose[0, 12], [0.5, 0, 0], atol=1e-6)
    assert np.all(sn.manos[:, 0] == 0) and np.all(sn.presencia_manos[:, 0] == 0)
    np.testing.assert_allclose(sn.manos[0, 1, 9], [0, -0.5, -0.0], atol=1e-6)
    local = normalizar(seq, FeatureSpec(marco_manos="local"))
    np.testing.assert_allclose(local.manos[0, 1, 0], 0, atol=1e-6)  # muñeca en el origen


def test_referencia_vecina_cuando_falta_la_pose():
    seq = SecuenciaCruda.vacia(3)
    seq.pose[:, 11], seq.pose[:, 12] = [0.4, 0.5, 0], [0.6, 0.5, 0]
    seq.presencia_pose[:] = [1, 0, 1]
    seq.cara[:, :, :] = 0.5
    seq.presencia_cara[:] = 1
    vecino = normalizar(seq, FeatureSpec(referencia_sin_pose="vecino"))
    neutral = normalizar(seq, FeatureSpec(referencia_sin_pose="neutral"))
    np.testing.assert_allclose(vecino.cara[1], vecino.cara[0])
    assert not np.allclose(neutral.cara[1], neutral.cara[0])


def test_velocidad_enmascarada_cuando_aparece_la_mano():
    spec = FeatureSpec(posicion=False, velocidad=True, aceleracion=False)
    seq = SecuenciaCruda.vacia(4)
    seq.manos[2:, 1] = np.random.default_rng(0).random((2, 21, 3))
    seq.presencia_manos[2:, 1] = 1
    sn = normalizar(seq, spec)
    v = matriz_entrada(sn, spec)
    assert np.all(v[2, 63:126] == 0)      # aparece en t=2: sin velocidad espuria
    assert np.all(v[0] == 0)              # primer frame relleno con ceros


def test_aumento_conserva_forma_y_partes_ausentes(rng):
    spec = FeatureSpec()
    sn = normalizar(secuencia_sintetica(1, 2, rng), spec)
    aum = Aumentador({"espejo": {"activo": True, "probabilidad": 1.0}}, spec)
    tw = aum.temporal(sn, rng)
    assert len(tw) == len(sn)
    esp = aum.espacial(sn, rng)
    assert esp.manos.shape == sn.manos.shape
    # con espejo la mano derecha pasa a la izquierda; la ausente sigue en ceros
    assert np.all(esp.manos[sn.presencia_manos[:, 1] == 0, 0] == 0)
    np.testing.assert_array_equal(esp.presencia_manos[:, 0], sn.presencia_manos[:, 1])


def test_aumento_desactivado_por_defecto_no_espeja():
    assert Aumentador(None, FeatureSpec()).cfg["espejo"]["activo"] is False
    assert permutacion_espejo_pose(list(range(17)))[11] == 12


def test_aumento_solo_con_entrenar(rng):
    pre = Preprocesador(FeatureSpec(), {"activo": True})
    sn = pre.normalizar(secuencia_sintetica(0, 1, rng))
    a = pre.desde_normalizada(sn)
    b = pre.desde_normalizada(sn)
    np.testing.assert_array_equal(a, b)
    c = pre.desde_normalizada(sn, np.random.default_rng(1), entrenar=True)
    assert not np.allclose(a, c)
