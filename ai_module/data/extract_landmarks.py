"""
Extracción de landmarks de mano con MediaPipe desde videos o imágenes.

Lee un dataset de videos/imágenes de señas y genera archivos .npy
con los landmarks de MediaPipe, listos para entrenar los modelos.

Estructura de salida:
    salida/
        nombre_seña/
            muestra_001.npy    ← (21, 3) para imágenes estáticas
            muestra_002.npy    ← (N, 21, 3) para videos/secuencias

Uso para imágenes (señas estáticas):
    python data/extract_landmarks.py --entrada ruta/dataset --salida data/landmarks_estaticos --modo imagen

Uso para videos (señas con movimiento):
    python data/extract_landmarks.py --entrada ruta/dataset --salida data/landmarks_dinamicos --modo video
"""

import argparse
import os
import numpy as np
import cv2
import mediapipe as mp
from tqdm import tqdm


# ── Configuración de MediaPipe (Tasks API) ─────────────────────────────────────
# La API antigua (mp.solutions.hands) fue removida en mediapipe >= 0.10.3x, así
# que usamos HandLandmarker de la Tasks API, que requiere el modelo .task.

_DIR_AI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # carpeta ai_module
RUTA_MODELO_MANOS = os.path.join(_DIR_AI, "models_mediapipe", "hand_landmarker.task")


def crear_detector_manos(confianza_deteccion: float = 0.5, confianza_seguimiento: float = 0.5):
    """Crea un HandLandmarker (MediaPipe Tasks API) para una mano."""
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    if not os.path.exists(RUTA_MODELO_MANOS):
        raise FileNotFoundError(
            f"No se encontró el modelo en {RUTA_MODELO_MANOS}.\n"
            "Descárgalo con:\n"
            "  curl -L -o models_mediapipe/hand_landmarker.task \\\n"
            "  https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
        )

    opciones = vision.HandLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=RUTA_MODELO_MANOS),
        num_hands=1,
        min_hand_detection_confidence=confianza_deteccion,
        min_tracking_confidence=confianza_seguimiento,
    )
    return vision.HandLandmarker.create_from_options(opciones)


def detectar_landmarks(detector, imagen_bgr) -> np.ndarray | None:
    """
    Detecta una mano en una imagen BGR (OpenCV) y devuelve (21, 3) o None.
    Salida idéntica a antes: landmarks normalizados [x, y, z].
    """
    imagen_rgb = cv2.cvtColor(imagen_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=imagen_rgb)
    resultado = detector.detect(mp_image)
    if not resultado.hand_landmarks:
        return None
    lm = resultado.hand_landmarks[0]
    return np.array([[p.x, p.y, p.z] for p in lm], dtype=np.float32)


# ── Procesamiento de imágenes estáticas ───────────────────────────────────────

def extraer_de_imagen(ruta_imagen: str, detector) -> np.ndarray | None:
    """
    Extrae los 21 landmarks de una imagen de seña.
    Devuelve array (21, 3) o None si no detectó mano.
    """
    imagen = cv2.imread(ruta_imagen)
    if imagen is None:
        return None
    return detectar_landmarks(detector, imagen)


def procesar_dataset_imagenes(directorio_entrada: str, directorio_salida: str):
    """
    Procesa un dataset de imágenes organizadas por carpetas (una por seña).

        entrada/
            A/imagen1.jpg, imagen2.jpg, ...
            B/imagen1.jpg, ...
    """
    señas = sorted([
        d for d in os.listdir(directorio_entrada)
        if os.path.isdir(os.path.join(directorio_entrada, d))
    ])

    print(f"[Extracción] {len(señas)} señas encontradas: {señas}\n")
    extensiones_validas = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

    detector = crear_detector_manos(confianza_deteccion=0.6)

    for nombre_seña in señas:
        carpeta_entrada = os.path.join(directorio_entrada, nombre_seña)
        carpeta_salida = os.path.join(directorio_salida, nombre_seña)
        os.makedirs(carpeta_salida, exist_ok=True)

        archivos = [
            f for f in os.listdir(carpeta_entrada)
            if os.path.splitext(f)[1].lower() in extensiones_validas
        ]

        detectados = 0
        for i, archivo in enumerate(tqdm(archivos, desc=f"  {nombre_seña}")):
            ruta = os.path.join(carpeta_entrada, archivo)
            landmarks = extraer_de_imagen(ruta, detector)

            if landmarks is not None:
                ruta_npy = os.path.join(carpeta_salida, f"muestra_{i:04d}.npy")
                np.save(ruta_npy, landmarks)
                detectados += 1

        print(f"  [{nombre_seña}] {detectados}/{len(archivos)} imágenes con mano detectada")

    detector.close()
    print(f"\n[Extracción] Completado → {directorio_salida}")


# ── Procesamiento de videos ───────────────────────────────────────────────────

def extraer_de_video(
    ruta_video: str,
    detector,
    max_frames: int = 90,
    saltar_frames: int = 1,
) -> np.ndarray | None:
    """
    Extrae una secuencia de landmarks de un video.
    Devuelve array (N, 21, 3) donde N es la cantidad de frames con mano detectada.
    """
    cap = cv2.VideoCapture(ruta_video)
    if not cap.isOpened():
        return None

    frames_landmarks = []
    contador = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Saltar frames para reducir correlación entre muestras
        contador += 1
        if contador % (saltar_frames + 1) != 0:
            continue

        lm = detectar_landmarks(detector, frame)

        if lm is not None:
            frames_landmarks.append(lm)

        if len(frames_landmarks) >= max_frames:
            break

    cap.release()

    if len(frames_landmarks) < 5:
        return None  # Muy pocos frames, descartar

    return np.array(frames_landmarks, dtype=np.float32)  # (N, 21, 3)


def procesar_dataset_videos(directorio_entrada: str, directorio_salida: str):
    """
    Procesa un dataset de videos organizados por carpetas (una por seña).

        entrada/
            hola/video1.mp4, video2.mp4, ...
            gracias/video1.mp4, ...
    """
    señas = sorted([
        d for d in os.listdir(directorio_entrada)
        if os.path.isdir(os.path.join(directorio_entrada, d))
    ])

    print(f"[Extracción] {len(señas)} señas encontradas: {señas}\n")
    extensiones_validas = {".mp4", ".avi", ".mov", ".mkv", ".webm"}

    # Para videos usamos static_image_mode=False para mejor seguimiento
    detector = crear_detector_manos(confianza_deteccion=0.5, confianza_seguimiento=0.4)

    for nombre_seña in señas:
        carpeta_entrada = os.path.join(directorio_entrada, nombre_seña)
        carpeta_salida = os.path.join(directorio_salida, nombre_seña)
        os.makedirs(carpeta_salida, exist_ok=True)

        archivos = [
            f for f in os.listdir(carpeta_entrada)
            if os.path.splitext(f)[1].lower() in extensiones_validas
        ]

        detectados = 0
        for i, archivo in enumerate(tqdm(archivos, desc=f"  {nombre_seña}")):
            ruta = os.path.join(carpeta_entrada, archivo)
            secuencia = extraer_de_video(ruta, detector)

            if secuencia is not None:
                ruta_npy = os.path.join(carpeta_salida, f"secuencia_{i:04d}.npy")
                np.save(ruta_npy, secuencia)
                detectados += 1

        print(f"  [{nombre_seña}] {detectados}/{len(archivos)} videos con mano detectada")

    detector.close()
    print(f"\n[Extracción] Completado → {directorio_salida}")


# ── Captura desde webcam (para agregar muestras propias al dataset) ───────────

def capturar_desde_webcam(nombre_seña: str, directorio_salida: str, n_muestras: int = 50):
    """
    Herramienta interactiva para capturar muestras de una seña con la webcam.

    Teclas:
        ESPACIO  → Capturar muestra de la pose actual
        Q / ESC  → Salir
    """
    carpeta = os.path.join(directorio_salida, nombre_seña)
    os.makedirs(carpeta, exist_ok=True)

    existentes = len([f for f in os.listdir(carpeta) if f.endswith(".npy")])
    print(f"[Webcam] Capturando seña '{nombre_seña}' | {n_muestras} muestras")
    print("[Webcam] ESPACIO=capturar  Q=salir\n")

    detector = crear_detector_manos()

    cap = cv2.VideoCapture(0)
    capturadas = 0

    while capturadas < n_muestras:
        ret, frame = cap.read()
        if not ret:
            break

        lm = detectar_landmarks(detector, frame)

        # Dibujar los puntos detectados como círculos sobre el frame
        if lm is not None:
            h, w = frame.shape[:2]
            for (x, y, _z) in lm:
                cv2.circle(frame, (int(x * w), int(y * h)), 4, (0, 255, 0), -1)

        # Mostrar estado
        color_estado = (0, 200, 0) if lm is not None else (0, 0, 200)
        estado = f"MANO DETECTADA" if lm is not None else "SIN MANO"
        cv2.putText(frame, f"{nombre_seña} | {capturadas}/{n_muestras}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        cv2.putText(frame, estado, (10, 70),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, color_estado, 2)
        cv2.imshow(f"Captura: {nombre_seña}", frame)

        tecla = cv2.waitKey(1) & 0xFF
        if tecla == ord(' ') and lm is not None:
            indice = existentes + capturadas
            np.save(os.path.join(carpeta, f"muestra_{indice:04d}.npy"), lm)
            capturadas += 1
            print(f"  Capturada muestra {capturadas}/{n_muestras}")
        elif tecla in [ord('q'), 27]:
            break

    cap.release()
    cv2.destroyAllWindows()
    detector.close()
    print(f"[Webcam] {capturadas} muestras guardadas en {carpeta}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extrae landmarks de mano desde imágenes o videos")
    parser.add_argument("--entrada", required=True, help="Directorio del dataset original")
    parser.add_argument("--salida", required=True, help="Directorio de salida para los .npy")
    parser.add_argument("--modo", choices=["imagen", "video", "webcam"], default="imagen")
    parser.add_argument("--seña", default="", help="(Solo modo webcam) Nombre de la seña a capturar")
    parser.add_argument("--muestras", type=int, default=50, help="(Solo modo webcam) Cuántas capturar")
    args = parser.parse_args()

    if args.modo == "imagen":
        procesar_dataset_imagenes(args.entrada, args.salida)
    elif args.modo == "video":
        procesar_dataset_videos(args.entrada, args.salida)
    elif args.modo == "webcam":
        if not args.seña:
            parser.error("--seña es obligatorio en modo webcam")
        capturar_desde_webcam(args.seña, args.salida, args.muestras)
