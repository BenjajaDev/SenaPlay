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

    "lsch-roboflow": {
        "nombre": "Lengua de Señas Chilena 'desde cero' (Roboflow)",
        "descripcion": (
            "~1105 imágenes del ALFABETO de la Lengua de Señas Chilena (LSCh).\n"
            "Es el dataset más relevante para esta app: son las letras reales chilenas,\n"
            "no gestos genéricos ni señas de otro país.\n"
            "Descarga directa con API key gratuita de Roboflow."
        ),
        "url_info": "https://universe.roboflow.com/project-jak2u/lengua-de-senas-chilena-desde-cero/dataset/10",
        "url_descarga": "https://universe.roboflow.com/project-jak2u/lengua-de-senas-chilena-desde-cero",
        "tipo": ["estatica"],
        "señas": 27,
        "muestras": 1105,
        "requiere_registro": True,
        "instrucciones": """
1. Crea una cuenta gratis en https://roboflow.com y copia tu API key (Settings → API).
2. pip install roboflow
3. Ejecuta (reemplaza TU_API_KEY):
   python data/download_datasets.py --dataset lsch-roboflow --api-key TU_API_KEY --salida data/raw
4. Extrae landmarks:
   python data/extract_landmarks.py --entrada data/raw/lsch_alfabeto --salida data/landmarks_estaticos --modo imagen
5. Entrena:
   python model/train_static.py --datos data/landmarks_estaticos --salida models_saved/estatico.pkl
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


def descargar_roboflow_lsch(api_key: str, directorio_salida: str):
    """
    Descarga el dataset del alfabeto LSCh desde Roboflow Universe.

    El proyecto es de tipo OBJECT-DETECTION, así que lo bajamos en formato VOC
    (cada imagen trae un .xml con la clase de la letra) y reorganizamos las
    imágenes en carpetas por letra, dejándolas listas para
    extract_landmarks.py --modo imagen.

    Resultado:
        directorio_salida/lsch_alfabeto/
            A/  ...jpg
            B/  ...jpg
            ...
    """
    try:
        from roboflow import Roboflow
    except ImportError:
        print("[Error] Instala el paquete primero:  pip install roboflow")
        return

    import shutil
    import glob
    import xml.etree.ElementTree as ET

    destino = os.path.join(directorio_salida, "lsch_alfabeto")
    carpeta_descarga = os.path.join(destino, "_descarga")
    os.makedirs(destino, exist_ok=True)

    print("[Roboflow] Descargando 'lengua-de-senas-chilena-desde-cero' v10 (VOC → organizando por letra)...")
    try:
        rf = Roboflow(api_key=api_key)
        proyecto = rf.workspace("project-jak2u").project("lengua-de-senas-chilena-desde-cero")
        dataset = proyecto.version(10).download("voc", location=carpeta_descarga)
    except Exception as e:
        print(f"[Error] No se pudo descargar desde Roboflow: {e}")
        print("        Verifica tu API key (Account → Roboflow Keys).")
        return

    origen = getattr(dataset, "location", carpeta_descarga)
    extensiones = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

    def clase_desde_xml(ruta_xml):
        """Lee la clase del primer objeto anotado en un XML Pascal VOC."""
        try:
            raiz = ET.parse(ruta_xml).getroot()
            obj = raiz.find("object")
            if obj is None:
                return None, None
            clase = (obj.findtext("name") or "").strip()
            archivo = (raiz.findtext("filename") or "").strip()
            return (clase or None), (archivo or None)
        except Exception:
            return None, None

    # Recorrer splits, leer cada XML y copiar su imagen a la carpeta de su letra
    total = 0
    for split in ("train", "valid", "test"):
        ruta_split = os.path.join(origen, split)
        if not os.path.isdir(ruta_split):
            continue

        for ruta_xml in glob.glob(os.path.join(ruta_split, "*.xml")):
            clase, archivo = clase_desde_xml(ruta_xml)
            if not clase:
                continue

            # Resolver la imagen: por <filename> o por el mismo nombre base del XML
            img_src = os.path.join(ruta_split, archivo) if archivo else ""
            if not img_src or not os.path.exists(img_src):
                base = os.path.splitext(os.path.basename(ruta_xml))[0]
                candidatos = [
                    f for f in os.listdir(ruta_split)
                    if os.path.splitext(f)[0] == base
                    and os.path.splitext(f)[1].lower() in extensiones
                ]
                if not candidatos:
                    continue
                archivo = candidatos[0]
                img_src = os.path.join(ruta_split, archivo)

            destino_clase = os.path.join(destino, clase)
            os.makedirs(destino_clase, exist_ok=True)
            shutil.copy2(img_src, os.path.join(destino_clase, f"{split}_{archivo}"))
            total += 1

    if total == 0:
        print("[Aviso] No se pudieron organizar imágenes por clase.")
        print(f"        Revisa la estructura descargada en: {origen}")
        return

    clases = sorted([
        d for d in os.listdir(destino)
        if os.path.isdir(os.path.join(destino, d)) and d != "_descarga"
    ])
    print(f"\n[Roboflow] {total} imágenes organizadas en: {destino}")
    print(f"[Roboflow] Clases ({len(clases)}): {clases}")
    print("\nSiguiente paso:")
    print(f"  python data/extract_landmarks.py --entrada {destino} --salida data/landmarks_estaticos --modo imagen")


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
    parser.add_argument("--api-key", default="",
                        help="(Solo lsch-roboflow) API key de Roboflow")
    args = parser.parse_args()

    if args.info or not args.dataset:
        mostrar_info_todos()
    elif args.dataset == "hagrid":
        descargar_hagrid(os.path.join(args.salida, "hagrid"))
    elif args.dataset == "lsch-roboflow":
        if not args.api_key:
            parser.error("--api-key es obligatorio para lsch-roboflow (cópiala de roboflow.com → Settings → API)")
        descargar_roboflow_lsch(args.api_key, args.salida)
    else:
        mostrar_instrucciones_dataset(args.dataset)
