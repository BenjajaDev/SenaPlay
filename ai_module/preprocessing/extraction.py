"""
Extracción de landmarks crudos con MediaPipe Holistic (Tasks API).

Reutiliza la configuración del pipeline legado (`scripts/holistic_pipeline.py`):
`HolisticLandmarker` en modo VIDEO, submuestreo a `fps_muestreo` y las mismas
confianzas. La diferencia es QUÉ se guarda: aquí se guardan los landmarks
CRUDOS (manos 21×3, pose completa 33×3, cara completa 478×3 y flags de
presencia) en un `.npz`, no el vector ya normalizado. Así la normalización,
el subconjunto facial o el marco de las manos se pueden cambiar (y comparar)
sin volver a correr MediaPipe sobre los videos.

MediaPipe y OpenCV se importan dentro de las funciones: el servidor y las
pruebas pueden importar este módulo sin tenerlos cargados.
"""

from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass, field

import numpy as np

from common.rutas import DIR_MODELOS_MEDIAPIPE
from preprocessing.spec import N_CARA_TOTAL, N_MANO, N_POSE_TOTAL

RUTA_MODELO_HOLISTIC = os.path.join(DIR_MODELOS_MEDIAPIPE, "holistic_landmarker.task")


@dataclass
class SecuenciaCruda:
    """Landmarks crudos (coordenadas normalizadas de imagen de MediaPipe) de un video."""

    manos: np.ndarray            # (L, 2, 21, 3)  [izquierda, derecha] de la imagen
    presencia_manos: np.ndarray  # (L, 2)
    pose: np.ndarray             # (L, 33, 3)
    presencia_pose: np.ndarray   # (L,)
    cara: np.ndarray             # (L, 478, 3)
    presencia_cara: np.ndarray   # (L,)
    fps_muestreo: float = 30.0
    info: dict = field(default_factory=dict)  # fps_fuente, n_frames_fuente, duracion_s…

    def __len__(self) -> int:
        return len(self.manos)

    @classmethod
    def vacia(cls, largo: int, fps_muestreo: float = 30.0) -> "SecuenciaCruda":
        return cls(
            manos=np.zeros((largo, 2, N_MANO, 3), np.float32),
            presencia_manos=np.zeros((largo, 2), np.float32),
            pose=np.zeros((largo, N_POSE_TOTAL, 3), np.float32),
            presencia_pose=np.zeros(largo, np.float32),
            cara=np.zeros((largo, N_CARA_TOTAL, 3), np.float32),
            presencia_cara=np.zeros(largo, np.float32),
            fps_muestreo=fps_muestreo,
        )

    def ratio_sin_manos(self) -> float:
        """Fracción de frames sin ninguna mano detectada (1.0 si no hay frames)."""
        if len(self) == 0:
            return 1.0
        con_mano = (self.presencia_manos.max(axis=1) > 0.5).sum()
        return float(1.0 - con_mano / len(self))

    def guardar(self, ruta: str) -> None:
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        np.savez_compressed(
            ruta,
            manos=self.manos, presencia_manos=self.presencia_manos,
            pose=self.pose, presencia_pose=self.presencia_pose,
            cara=self.cara, presencia_cara=self.presencia_cara,
            fps_muestreo=np.float32(self.fps_muestreo),
            info=json.dumps(self.info, ensure_ascii=False),
        )

    @classmethod
    def cargar(cls, ruta: str) -> "SecuenciaCruda":
        with np.load(ruta, allow_pickle=False) as d:
            return cls(
                manos=d["manos"].astype(np.float32),
                presencia_manos=d["presencia_manos"].astype(np.float32),
                pose=d["pose"].astype(np.float32),
                presencia_pose=d["presencia_pose"].astype(np.float32),
                cara=d["cara"].astype(np.float32),
                presencia_cara=d["presencia_cara"].astype(np.float32),
                fps_muestreo=float(d["fps_muestreo"]),
                info=json.loads(str(d["info"])),
            )


# ── MediaPipe ─────────────────────────────────────────────────────────────────

def crear_detector(cfg_extraccion: dict, modo_video: bool = True):
    """Crea un HolisticLandmarker con las confianzas de la configuración."""
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    if not os.path.exists(RUTA_MODELO_HOLISTIC):
        raise FileNotFoundError(
            f"No se encontró {RUTA_MODELO_HOLISTIC}. Descárgalo con:\n"
            "  curl -L -o models_mediapipe/holistic_landmarker.task https://storage.googleapis.com/"
            "mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/"
            "holistic_landmarker.task"
        )
    conf_det = cfg_extraccion.get("confianza_deteccion", 0.5)
    conf_lm = cfg_extraccion.get("confianza_landmarks", 0.5)
    opciones = vision.HolisticLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=RUTA_MODELO_HOLISTIC),
        running_mode=vision.RunningMode.VIDEO if modo_video else vision.RunningMode.IMAGE,
        min_face_detection_confidence=conf_det,
        min_face_landmarks_confidence=conf_lm,
        min_pose_detection_confidence=conf_det,
        min_pose_landmarks_confidence=conf_lm,
        min_hand_landmarks_confidence=conf_lm,
    )
    return vision.HolisticLandmarker.create_from_options(opciones)


def _a_array(landmarks, largo: int) -> tuple[np.ndarray, float]:
    """Lista de NormalizedLandmark → (largo, 3) con relleno en ceros, y flag de presencia."""
    salida = np.zeros((largo, 3), np.float32)
    if not landmarks:
        return salida, 0.0
    puntos = np.array([[p.x, p.y, p.z] for p in landmarks[:largo]], dtype=np.float32)
    salida[: len(puntos)] = puntos
    return salida, 1.0


def detectar_frame(detector, imagen_bgr, timestamp_ms: int | None = None) -> dict:
    """
    Procesa un frame BGR y devuelve los landmarks crudos completos:
    {"mano_izq": (21,3)|None, "mano_der": (21,3)|None, "pose": (33,3)|None, "cara": (478,3)|None}.
    'izquierda'/'derecha' son desde la perspectiva de la IMAGEN, igual que en el pipeline legado.
    """
    import cv2
    import mediapipe as mp

    imagen_rgb = cv2.cvtColor(imagen_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=imagen_rgb)
    if timestamp_ms is None:
        resultado = detector.detect(mp_image)
    else:
        resultado = detector.detect_for_video(mp_image, timestamp_ms)

    salida = {}
    for clave, lista, largo in (("mano_izq", resultado.left_hand_landmarks, N_MANO),
                                ("mano_der", resultado.right_hand_landmarks, N_MANO),
                                ("pose", resultado.pose_landmarks, N_POSE_TOTAL),
                                ("cara", resultado.face_landmarks, N_CARA_TOTAL)):
        arr, presente = _a_array(lista, largo)
        salida[clave] = arr if presente else None
    return salida


def frames_a_secuencia(frames: list[dict], fps_muestreo: float, info: dict | None = None
                       ) -> SecuenciaCruda:
    """Apila una lista de detecciones (`detectar_frame`) en una `SecuenciaCruda`."""
    seq = SecuenciaCruda.vacia(len(frames), fps_muestreo)
    for t, f in enumerate(frames):
        for m, clave in enumerate(("mano_izq", "mano_der")):
            if f.get(clave) is not None:
                seq.manos[t, m] = f[clave]
                seq.presencia_manos[t, m] = 1.0
        if f.get("pose") is not None:
            seq.pose[t] = f["pose"]
            seq.presencia_pose[t] = 1.0
        if f.get("cara") is not None:
            seq.cara[t] = f["cara"]
            seq.presencia_cara[t] = 1.0
    seq.info = dict(info or {})
    return seq


def metadatos_video(ruta_video: str) -> dict:
    """fps, número de frames y duración según OpenCV, más el dispositivo si ffprobe lo informa."""
    import cv2

    cap = cv2.VideoCapture(ruta_video)
    if not cap.isOpened():
        raise RuntimeError(f"No se pudo abrir el video: {ruta_video}")
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    cap.release()
    return {
        "fps_fuente": round(fps, 3),
        "n_frames_fuente": n_frames,
        "duracion_s": round(n_frames / fps, 3) if fps > 0 else 0.0,
        "dispositivo": _dispositivo_ffprobe(ruta_video),
    }


def _dispositivo_ffprobe(ruta_video: str) -> str:
    """Lee las etiquetas de fabricante/modelo del contenedor (.mov de iPhone las trae). '' si no hay."""
    try:
        salida = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", ruta_video],
            capture_output=True, text=True, timeout=20, check=False,
        ).stdout
        etiquetas = {k.lower(): v for k, v in json.loads(salida or "{}")
                     .get("format", {}).get("tags", {}).items()}
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return ""
    marca = etiquetas.get("com.apple.quicktime.make", etiquetas.get("make", ""))
    modelo = etiquetas.get("com.apple.quicktime.model", etiquetas.get("model", ""))
    return " ".join(p for p in (marca, modelo) if p).strip()


def extraer_video(ruta_video: str, cfg_extraccion: dict) -> SecuenciaCruda:
    """
    Recorre el video completo y devuelve sus landmarks crudos. Igual que el
    pipeline legado: si el video tiene más fps que `fps_muestreo` se saltan
    frames intermedios (paso = round(fps_fuente / fps_muestreo)).
    """
    import cv2

    fps_muestreo = float(cfg_extraccion.get("fps_muestreo", 30))
    info = metadatos_video(ruta_video)
    cap = cv2.VideoCapture(ruta_video)
    fps_fuente = info["fps_fuente"] or fps_muestreo
    paso = max(1, round(fps_fuente / fps_muestreo))
    paso_ms = int(1000 / fps_muestreo)

    detector = crear_detector(cfg_extraccion, modo_video=True)
    frames, indice, ts_ms, leidos = [], 0, 0, 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            leidos += 1
            if indice % paso == 0:
                frames.append(detectar_frame(detector, frame, ts_ms))
                ts_ms += paso_ms
            indice += 1
    finally:
        cap.release()
        detector.close()

    # CAP_PROP_FRAME_COUNT es una estimación del contenedor; se prefiere lo leído.
    info["n_frames_fuente"] = leidos
    if info["fps_fuente"]:
        info["duracion_s"] = round(leidos / info["fps_fuente"], 3)
    info["paso_muestreo"] = paso
    return frames_a_secuencia(frames, fps_muestreo, info)
