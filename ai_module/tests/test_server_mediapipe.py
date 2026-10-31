"""
/clasificar_frames y /clasificar_video de extremo a extremo con MediaPipe real,
en los dos modos. Las imágenes y el video son sintéticos (ruido, colores
planos, degradados): no hay manos, así que la respuesta esperada es sin_mano.
"""

import base64

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

import server
from inferencia.ajustes import cargar_ajustes
from tests.test_server import CLAVES_DINAMICA, mp4_b64

pytestmark = pytest.mark.mediapipe


@pytest.fixture(scope="module", params=["tcn", "lstm"])
def cliente(request):
    with TestClient(server.crear_app(cargar_ajustes(modelo_dinamico=request.param))) as c:
        yield c


def _cuadros_sinteticos(cantidad: int) -> list[str]:
    rng = np.random.default_rng(0)
    cuadros = []
    for i in range(cantidad):
        if i % 3 == 0:
            imagen = rng.integers(0, 255, (360, 480, 3), dtype=np.uint8)
        elif i % 3 == 1:
            imagen = np.full((360, 480, 3), (i * 20) % 255, np.uint8)
        else:
            imagen = np.tile(np.linspace(0, 255, 480, dtype=np.uint8), (360, 1))[..., None].repeat(3, 2)
        ok, jpeg = cv2.imencode(".jpg", imagen, [cv2.IMWRITE_JPEG_QUALITY, 70])
        cuadros.append("data:image/jpeg;base64," + base64.b64encode(jpeg.tobytes()).decode())
    return cuadros


def test_frames_con_mediapipe_real(cliente):
    r = cliente.post("/clasificar_frames", json={"frames": _cuadros_sinteticos(20), "fps": 15})
    assert r.status_code == 200
    cuerpo = r.json()
    assert set(cuerpo) == CLAVES_DINAMICA
    assert cuerpo["frames_procesados"] == 20
    assert cuerpo["ratio_con_mano"] == 0.0 and cuerpo["motivo"] == "sin_mano"


def test_video_con_mediapipe_real(cliente, tmp_path):
    r = cliente.post("/clasificar_video", json={"video_base64": mp4_b64(tmp_path, 30),
                                                "mime": "video/mp4"})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["frames_procesados"] == 30 and cuerpo["motivo"] == "sin_mano"
