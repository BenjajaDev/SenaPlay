"""Validación de entrada (inferencia/entrada.py) y límites de tamaño del servidor."""

import base64
import json

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

import server
from inferencia import entrada
from inferencia.ajustes import cargar_ajustes
from inferencia.entrada import EntradaInvalida


def _jpeg_b64(color: int = 128, lado: int = 32) -> str:
    ok, jpeg = cv2.imencode(".jpg", np.full((lado, lado, 3), color, np.uint8))
    assert ok
    return base64.b64encode(jpeg.tobytes()).decode()


@pytest.fixture(scope="module")
def cliente():
    ajustes = cargar_ajustes(max_bytes_cuadro=4096, max_bytes_cuerpo_frames=256 * 1024,
                             max_bytes_video=2048, max_bytes_cuerpo_video=8192,
                             max_bytes_cuerpo=16 * 1024)
    with TestClient(server.crear_app(ajustes)) as c:
        yield c


# ── Cuadros JPEG ──────────────────────────────────────────────────────────────

def test_acepta_jpeg_con_y_sin_prefijo():
    cuerpo = _jpeg_b64()
    jpegs = entrada.validar_cuadros([cuerpo, "data:image/jpeg;base64," + cuerpo], 120, 256 * 1024)
    assert len(jpegs) == 2 and jpegs[0] == jpegs[1] and jpegs[0].startswith(b"\xff\xd8\xff")


@pytest.mark.parametrize("cuadro,status,texto", [
    ("data:image/png;base64," + _jpeg_b64(), 422, "El cuadro 2 no es JPEG (data:image/png)"),
    ("data:text/plain,hola", 422, "no es JPEG"),
    ("@@no-es-base64@@", 422, "El cuadro 2 no es base64 válido"),
    (base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"0" * 32).decode(), 422, "El cuadro 2 no es un JPEG"),
    ("A" * 5000, 413, "El cuadro 2 pesa 5 KB; el máximo es 4 KB"),
])
def test_rechaza_cuadros_invalidos(cuadro, status, texto):
    with pytest.raises(EntradaInvalida) as error:
        entrada.validar_cuadros([_jpeg_b64(), cuadro], 120, 4096)
    assert error.value.status == status and texto in error.value.mensaje


def test_tramo_vacio_o_sobre_el_tope():
    with pytest.raises(EntradaInvalida, match="no trae cuadros"):
        entrada.validar_cuadros([], 120, 4096)
    with pytest.raises(EntradaInvalida, match="trae 121 cuadros; el máximo es 120") as error:
        entrada.validar_cuadros([_jpeg_b64()] * 121, 120, 4096)
    assert error.value.status == 422


def test_jpeg_que_no_decodifica_se_salta_y_conserva_el_indice():
    roto = b"\xff\xd8\xff" + b"\x00" * 64   # marca JPEG válida, contenido basura
    bueno = base64.b64decode(_jpeg_b64())
    cuadros = entrada.decodificar_cuadros([roto, bueno, roto, bueno])
    assert [c.indice for c in cuadros] == [1, 3]
    with pytest.raises(EntradaInvalida, match="Ningún cuadro se pudo decodificar"):
        entrada.decodificar_cuadros([roto])


# ── Video ─────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("mime,sufijo", [("video/webm", ".webm"), ("video/webm;codecs=vp8", ".webm"),
                                         ("Video/MP4", ".mp4")])
def test_mime_admitidos(mime, sufijo):
    datos, obtenido = entrada.validar_video(base64.b64encode(b"x").decode(), mime, 1024)
    assert datos == b"x" and obtenido == sufijo


def test_rechaza_videos_invalidos():
    with pytest.raises(EntradaInvalida, match="Formato de video no admitido: video/quicktime"):
        entrada.validar_video("eA==", "video/quicktime", 1024)
    with pytest.raises(EntradaInvalida, match="El video no es base64 válido"):
        entrada.validar_video("no es base64!", "video/webm", 1024)
    with pytest.raises(EntradaInvalida) as error:
        entrada.validar_video("A" * 4096, "video/webm", 2048)
    assert error.value.status == 413


# ── A través del servidor ─────────────────────────────────────────────────────

@pytest.mark.parametrize("landmarks", [[[0.1, 0.2, 0.3]] * 20, [[0.1, 0.2]] * 21,
                                       [[0.1, 0.2, 0.3]] * 20 + [[0.1]]])
def test_clasificar_con_forma_invalida_da_422(cliente, landmarks):
    r = cliente.post("/clasificar", json={"landmarks": landmarks})
    assert r.status_code == 422
    assert r.json() == {"detail": "Se esperan exactamente 21 landmarks con [x, y, z] cada uno"}


def test_clasificar_secuencia_sobre_el_tope_da_422(cliente):
    r = cliente.post("/clasificar_secuencia", json={"frames": [[0.0]] * 121})
    assert r.status_code == 422 and "el máximo es 120" in r.json()["detail"]


def test_frames_invalidos_dan_422_o_413(cliente):
    casos = [
        ({"frames": []}, 422, "El tramo no trae cuadros"),
        ({"frames": ["data:image/png;base64," + _jpeg_b64()]}, 422, "no es JPEG"),
        ({"frames": ["A" * 5000]}, 413, "pesa 5 KB"),
        ({"frames": [_jpeg_b64()] * 121}, 422, "el máximo es 120"),
    ]
    for cuerpo, status, texto in casos:
        r = cliente.post("/clasificar_frames", json=cuerpo)
        assert r.status_code == status and texto in r.json()["detail"], cuerpo


def test_video_invalido_da_422_o_413(cliente):
    r = cliente.post("/clasificar_video", json={"video_base64": "eA==", "mime": "video/ogg"})
    assert r.status_code == 422 and "no admitido" in r.json()["detail"]
    r = cliente.post("/clasificar_video", json={"video_base64": "A" * 4000, "mime": "video/webm"})
    assert r.status_code == 413


def test_video_que_no_abre_no_filtra_detalles(cliente):
    r = cliente.post("/clasificar_video", json={"video_base64": "eA==", "mime": "video/mp4"})
    assert r.status_code == 422 and r.json() == {"detail": "No se pudo procesar el video"}


def test_cuerpo_sobre_el_limite_con_content_length(cliente):
    r = cliente.post("/clasificar", content=b"x" * (17 * 1024),
                     headers={"content-type": "application/json"})
    assert r.status_code == 413 and "16 KB" in r.json()["detail"]


def test_cuerpo_sobre_el_limite_sin_content_length(cliente):
    cuerpo = json.dumps({"landmarks": [[0.1, 0.2, 0.3]] * 2000}).encode()
    assert len(cuerpo) > 16 * 1024

    def en_trozos():
        for i in range(0, len(cuerpo), 4096):
            yield cuerpo[i:i + 4096]

    r = cliente.post("/clasificar", content=en_trozos(), headers={"content-type": "application/json"})
    assert r.status_code == 413


def test_limite_por_ruta(cliente):
    # ~20 KB pasan en /clasificar_frames (256 KB) pero no en /clasificar (16 KB).
    cuadros = [_jpeg_b64()] * 30
    assert len(json.dumps({"frames": cuadros})) > 16 * 1024
    r = cliente.post("/clasificar_frames", json={"frames": cuadros})
    assert r.status_code != 413
