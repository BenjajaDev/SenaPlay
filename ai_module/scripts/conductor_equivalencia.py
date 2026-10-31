"""
Conductor de la verificación de equivalencia (lo lanza scripts/verificar_equivalencia.py).

Corre DENTRO de un árbol de ai_module (el de referencia, gestilingo-dev@d9f6cd4,
o el candidato) e importa SU server.py, así los módulos `server`, `model` y
`scripts` de un árbol no se mezclan con los del otro. Manda los casos con
TestClient y escribe cada respuesta en JSONL.

En los casos con `parchear: deteccion` solo se reemplaza la detección de
MediaPipe: la llamada i devuelve el cuadro i de una secuencia cruda sintética
(sin personas). En la referencia se entrega en el dict legado (pose 0-16 y
cara reducida con su ÍNDICES_CARA), que es lo que devolvía su detectar_frame.
Todo lo demás (decodificación de JPEG y de video, submuestreo, features,
modelo, barreras y respuesta) es el código real de cada árbol.

Solo usa numpy y la API de cada servidor: no importa preprocessing/, que el
árbol de referencia no tiene.

    python -P scripts/conductor_equivalencia.py --arbol <ai_module> --modo referencia|candidato \
        --casos <dir> --salida <respuestas.jsonl>
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys

import numpy as np


class _Detector:
    def close(self) -> None:
        pass


class Deteccion:
    """Detección sintética: devuelve, llamada a llamada, los cuadros de `cruda`."""

    def __init__(self, indices_cara_v1: list[int] | None):
        self.cruda: dict[str, np.ndarray] | None = None
        self.llamadas = 0
        self.indices_cara_v1 = indices_cara_v1

    def cargar(self, ruta_npz: str) -> None:
        with np.load(ruta_npz) as datos:
            self.cruda = {clave: datos[clave] for clave in datos.files}
        self.llamadas = 0

    def _cuadro(self) -> dict:
        t = self.llamadas
        self.llamadas += 1
        c = self.cruda
        return {
            "mano_izq": c["manos"][t, 0] if c["presencia_manos"][t, 0] > 0.5 else None,
            "mano_der": c["manos"][t, 1] if c["presencia_manos"][t, 1] > 0.5 else None,
            "pose": c["pose"][t] if c["presencia_pose"][t] > 0.5 else None,
            "cara": c["cara"][t] if c["presencia_cara"][t] > 0.5 else None,
        }

    def nueva(self, _detector, _imagen, timestamp_ms=None) -> dict:
        return self._cuadro()

    def legada(self, _detector, _imagen, timestamp_ms=None) -> dict:
        f = self._cuadro()
        return {
            "mano_izq": f["mano_izq"],
            "mano_der": f["mano_der"],
            "pose_superior": None if f["pose"] is None else f["pose"][:17],
            "cara": None if f["cara"] is None else f["cara"][self.indices_cara_v1],
        }


def _cuerpo(caso: dict, casos_dir: str, jpegs: dict[str, str]) -> dict:
    tipo, datos = caso["cuerpo"]["tipo"], caso["cuerpo"]
    if tipo == "json":
        return datos["json"]
    if tipo == "npy_frames":
        return {"frames": np.load(os.path.join(casos_dir, datos["archivo"])).tolist(),
                "fps": datos.get("fps", 15.0)}
    if tipo == "jpegs":
        frames = [jpegs[clave] for clave in datos["jpegs"]]
        return {"frames": frames, "fps": datos["fps"]}
    if tipo == "video":
        with open(os.path.join(casos_dir, datos["archivo"]), "rb") as f:
            return {"video_base64": base64.b64encode(f.read()).decode(), "mime": datos["mime"]}
    raise ValueError(f"Tipo de cuerpo desconocido: {tipo}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--arbol", required=True)
    parser.add_argument("--modo", choices=["referencia", "candidato"], required=True)
    parser.add_argument("--casos", required=True)
    parser.add_argument("--salida", required=True)
    args = parser.parse_args()

    arbol = os.path.abspath(args.arbol)
    os.chdir(arbol)
    sys.path.insert(0, arbol)

    from fastapi.testclient import TestClient

    import server

    with open(os.path.join(args.casos, "casos.json"), encoding="utf-8") as f:
        casos = json.load(f)
    with open(os.path.join(args.casos, "jpegs.json"), encoding="utf-8") as f:
        jpegs = json.load(f)

    if args.modo == "referencia":
        import scripts.extract_landmarks as extract_landmarks
        import scripts.holistic_pipeline as holistic

        deteccion = Deteccion(list(holistic.ÍNDICES_CARA))
        reemplazos = [(server, "crear_detector_holistic", lambda *a, **k: _Detector()),
                      (server, "detectar_frame", deteccion.legada),
                      (extract_landmarks, "crear_detector_holistic", lambda *a, **k: _Detector()),
                      (extract_landmarks, "detectar_frame", deteccion.legada)]
        contexto = TestClient(server.app, raise_server_exceptions=False)
    else:
        import preprocessing.extraction as extraction

        deteccion = Deteccion(None)
        reemplazos = [(extraction, "crear_detector", lambda *a, **k: _Detector()),
                      (extraction, "detectar_frame", deteccion.nueva)]
        llamadas_ffprobe = []

        def _ffprobe(ruta):
            llamadas_ffprobe.append(ruta)
            return ""

        extraction._dispositivo_ffprobe = _ffprobe
        contexto = TestClient(server.crear_app(), raise_server_exceptions=False)
    originales = [(modulo, nombre, getattr(modulo, nombre)) for modulo, nombre, _ in reemplazos]

    with contexto as cliente, open(args.salida, "w", encoding="utf-8") as salida:
        for caso in casos:
            if caso.get("parchear") == "deteccion":
                deteccion.cargar(os.path.join(args.casos, caso["cruda"]))
                for modulo, nombre, valor in reemplazos:
                    setattr(modulo, nombre, valor)
            else:
                for modulo, nombre, valor in originales:
                    setattr(modulo, nombre, valor)
                deteccion.llamadas = 0
            r = cliente.post(caso["ruta"], json=_cuerpo(caso, args.casos, jpegs))
            try:
                cuerpo = r.json()
            except ValueError:
                cuerpo = r.text[:500]
            fila = {"id": caso["id"], "status": r.status_code, "cuerpo": cuerpo,
                    "llamadas_deteccion": deteccion.llamadas}
            if args.modo == "candidato":
                fila["llamadas_ffprobe"] = len(llamadas_ffprobe)
            salida.write(json.dumps(fila, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
