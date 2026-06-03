"""
Guía y scripts de descarga para los datasets de lenguaje de señas recomendados.

Datasets incluidos:
  1. LSA64   → 64 señas de Lengua de Señas Argentina (estático + movimiento)
  2. WLASL   → 2000 palabras de ASL (videos, el más completo)
  3. MS-ASL  → 1000 clases ASL de Microsoft (videos)
  4. AUTSL   → 226 señas de Lengua de Señas Turca (buena calidad)
  5. HaGRID  → 18 gestos de mano (solo estáticos, muy limpio)

Para lenguaje de señas en español/latinoamérica:
  - LSA64 es la opción más accesible y directamente relevante.
  - PUCP-PSL cubre Lengua de Señas Peruana.
  - Para crear tu propio dataset en LSE (Lengua de Señas Española),
    usa el modo webcam de extract_landmarks.py.

Uso:
    python data/download_datasets.py --dataset lsa64 --salida data/raw/lsa64
    python data/download_datasets.py --dataset wlasl --salida data/raw/wlasl
    python data/download_datasets.py --info
"""

import argparse
import os
import urllib.request
import zipfile
import json


# ── Información de cada dataset ───────────────────────────────────────────────

DATASETS = {
    "lsa64": {
        "nombre": "LSA64 - Lengua de Señas Argentina",
        "descripcion": (
            "64 señas de la LSA (Lengua de Señas Argentina), grabadas por 10 personas.\n"
            "Incluye señas estáticas Y de movimiento. Es el más relevante para el contexto\n"
            "hispanohablante y es descarga directa (sin registro).\n"
            "Tamaño: ~3 GB en videos, ~300 MB en landmarks extraídos."
        ),
        "url_info": "https://facundoq.github.io/datasets/lsa64/",
        "url_descarga": "https://facundoq.github.io/datasets/lsa64/lsa64.html",
        "tipo": ["estatica", "movimiento"],
        "señas": 64,
        "sujetos": 10,
        "muestras_por_seña": 100,
        "requiere_registro": False,
        "instrucciones": """
1. Ve a: https://facundoq.github.io/datasets/lsa64/
2. Descarga los videos desde el enlace 'Download' (puede requerir enviar un email)
3. Extrae en data/raw/lsa64/
4. Ejecuta: python data/extract_landmarks.py --entrada data/raw/lsa64 --salida data/landmarks_dinamicos --modo video
        """,
    },

    "wlasl": {
        "nombre": "WLASL - World Level American Sign Language",
        "descripcion": (
            "2000 palabras de ASL (American Sign Language) en video.\n"
            "El dataset más grande y diverso para señas con movimiento.\n"
            "Requiere descargar los videos desde YouTube (script incluido).\n"
            "Tamaño: variable (~50 GB completo, subconjuntos disponibles)."
        ),
        "url_info": "https://dxli94.github.io/WLASL/",
        "url_descarga": "https://github.com/dxli94/WLASL",
        "tipo": ["movimiento"],
        "señas": 2000,
        "sujetos": "varios",
        "muestras_por_seña": "variable",
        "requiere_registro": False,
        "instrucciones": """
1. Ve a: https://github.com/dxli94/WLASL
2. Clona el repo: git clone https://github.com/dxli94/WLASL
3. Instala yt-dlp: pip install yt-dlp
4. Descarga los videos: python start_download.py
5. Mueve los videos a data/raw/wlasl/ organizados por seña
6. Ejecuta: python data/extract_landmarks.py --entrada data/raw/wlasl --salida data/landmarks_dinamicos --modo video
        """,
    },

    "ms-asl": {
        "nombre": "MS-ASL - Microsoft American Sign Language",
        "descripcion": (
            "1000 clases de ASL con 25,000 videos de alta diversidad.\n"
            "Buena calidad y mucha variedad de firmantes.\n"
            "Requiere registro en Microsoft Research."
        ),
        "url_info": "https://www.microsoft.com/en-us/research/project/ms-asl/",
        "url_descarga": "https://www.microsoft.com/en-us/research/project/ms-asl/downloads/",
        "tipo": ["movimiento"],
        "señas": 1000,
        "requiere_registro": True,
        "instrucciones": """
1. Registrarse en: https://www.microsoft.com/en-us/research/project/ms-asl/downloads/
2. Descargar el dataset tras aprobación (1-2 días)
3. Extraer y organizar en data/raw/ms-asl/
4. Ejecutar: python data/extract_landmarks.py --entrada data/raw/ms-asl --salida data/landmarks_dinamicos --modo video
        """,
    },

    "autsl": {
        "nombre": "AUTSL - Turkish Sign Language Dataset",
        "descripcion": (
            "226 señas de la Lengua de Señas Turca (TID/AUTSL).\n"
            "Muy bien documentado, incluye depth maps además de RGB.\n"
            "Buen punto de partida para señas de movimiento aunque no sea español/inglés.\n"
            "La arquitectura de movimientos es transferible entre lenguas de señas."
        ),
        "url_info": "https://cvml.ankara.edu.tr/datasets/",
        "url_descarga": "https://cvml.ankara.edu.tr/datasets/",
        "tipo": ["movimiento"],
        "señas": 226,
        "sujetos": 43,
        "muestras_por_seña": 756,
        "requiere_registro": True,
        "instrucciones": """
1. Solicitar acceso en: https://cvml.ankara.edu.tr/datasets/
2. Descargar tras aprobación
3. Extraer en data/raw/autsl/
4. Ejecutar: python data/extract_landmarks.py --entrada data/raw/autsl --salida data/landmarks_dinamicos --modo video
        """,
    },

    "hagrid": {
        "nombre": "HaGRID - Hand Gesture Recognition Image Dataset",
        "descripcion": (
            "18 gestos estáticos de mano, 552,992 imágenes de alta calidad.\n"
            "Ideal para empezar: descarga directa, muy limpio, bien etiquetado.\n"
            "Solo señas estáticas (sin movimiento).\n"
            "Disponible en Hugging Face: huggingface.co/datasets/hagrid"
        ),
        "url_info": "https://github.com/hukenovs/hagrid",
        "url_descarga": "https://huggingface.co/datasets/hagrid",
        "tipo": ["estatica"],
        "señas": 18,
        "muestras": 552992,
        "requiere_registro": False,
        "instrucciones": """
1. pip install datasets huggingface-hub
2. Ejecuta el script de descarga de este archivo (opción hagrid)
   o descarga manualmente desde: https://github.com/hukenovs/hagrid/releases
3. Ejecutar: python data/extract_landmarks.py --entrada data/raw/hagrid --salida data/landmarks_estaticos --modo imagen
        """,
    },
}


# ── Funciones de descarga ─────────────────────────────────────────────────────

def mostrar_info_todos():
    """Imprime un resumen de todos los datasets disponibles."""
    print("\n" + "="*70)
    print("  DATASETS DE LENGUAJE DE SEÑAS DISPONIBLES")
    print("="*70)

    for clave, info in DATASETS.items():
        tipos = ", ".join(info["tipo"])
        registro = "SÍ" if info["requiere_registro"] else "NO"
        print(f"\n  [{clave}] {info['nombre']}")
        print(f"  Señas: {info.get('señas', '?')} | Tipo: {tipos} | Registro: {registro}")
        print(f"  {info['descripcion'][:100]}...")
        print(f"  Más info: {info['url_info']}")

    print("\n" + "="*70)
    print("  RECOMENDACIÓN para OratioLingo (LSE/LSA):")
    print("  1. LSA64  → Empezar aquí (64 señas, español, movimiento+estático)")
    print("  2. HaGRID → Para señas estáticas adicionales (18 gestos, fácil)")
    print("  3. WLASL  → Para ampliar vocabulario (2000 palabras, más trabajo)")
    print("="*70 + "\n")


def descargar_hagrid(directorio_salida: str):
    """Descarga HaGRID desde Hugging Face (el más accesible sin registro)."""
    try:
        from datasets import load_dataset
    except ImportError:
        print("[Error] Instala las dependencias: pip install datasets huggingface-hub")
        return

    print("[Descarga] Descargando HaGRID desde Hugging Face...")
    print("[Descarga] Esto puede tardar varios minutos según tu conexión.\n")

    os.makedirs(directorio_salida, exist_ok=True)

    # Descarga solo un subconjunto para empezar
    dataset = load_dataset(
        "hagrid",
        "hagrid_120k",  # versión reducida, ~15 GB
        split="train",
        trust_remote_code=True,
    )

    print(f"[Descarga] {len(dataset)} imágenes descargadas")
    print(f"[Descarga] Clases: {dataset.features['label'].names}")

    # Organizar en carpetas por clase
    from PIL import Image
    import io

    for i, muestra in enumerate(dataset):
        clase = dataset.features["label"].int2str(muestra["label"])
        carpeta = os.path.join(directorio_salida, clase)
        os.makedirs(carpeta, exist_ok=True)
        ruta = os.path.join(carpeta, f"imagen_{i:06d}.jpg")
        muestra["image"].save(ruta, "JPEG")

        if i % 1000 == 0:
            print(f"  Guardadas {i}/{len(dataset)} imágenes...")

    print(f"\n[Descarga] HaGRID guardado en: {directorio_salida}")


def mostrar_instrucciones_dataset(nombre_dataset: str):
    """Muestra las instrucciones de descarga de un dataset específico."""
    if nombre_dataset not in DATASETS:
        print(f"[Error] Dataset desconocido: {nombre_dataset}")
        print(f"Disponibles: {', '.join(DATASETS.keys())}")
        return

    info = DATASETS[nombre_dataset]
    print(f"\n{'='*60}")
    print(f"  {info['nombre']}")
    print(f"{'='*60}")
    print(f"\nDescripción:\n  {info['descripcion']}\n")
    print(f"URL de información: {info['url_info']}")
    print(f"\nInstrucciones de descarga:{info['instrucciones']}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Descarga datasets de lenguaje de señas")
    parser.add_argument("--info", action="store_true",
                        help="Mostrar información de todos los datasets disponibles")
    parser.add_argument("--dataset", choices=list(DATASETS.keys()),
                        help="Dataset a descargar o ver instrucciones")
    parser.add_argument("--salida", default="data/raw",
                        help="Directorio donde guardar el dataset")
    args = parser.parse_args()

    if args.info or not args.dataset:
        mostrar_info_todos()
    elif args.dataset == "hagrid":
        descargar_hagrid(os.path.join(args.salida, "hagrid"))
    else:
        mostrar_instrucciones_dataset(args.dataset)
