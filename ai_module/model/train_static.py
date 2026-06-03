"""
Entrenamiento del clasificador de señas ESTÁTICAS.

Flujo:
  1. Lee los landmarks extraídos por data/extract_landmarks.py (archivos .npy o .csv)
  2. Extrae características normalizadas de cada muestra
  3. Entrena un RandomForestClassifier con scikit-learn
  4. Guarda el pipeline en models_saved/estatico.pkl

Uso:
    python model/train_static.py --datos data/landmarks_estaticos --salida models_saved/estatico.pkl

Dataset recomendado para señas estáticas:
  - LSA64 (Argentine Sign Language): https://facundoq.github.io/datasets/lsa64/
  - MS-ASL: https://www.microsoft.com/en-us/research/project/ms-asl/
  - WLASL: https://dxli94.github.io/WLASL/
  Después de descargar, usa data/extract_landmarks.py para obtener los .npy.
"""

import argparse
import os
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report


# ── Extracción de características ─────────────────────────────────────────────

def extraer_caracteristicas(landmarks: np.ndarray) -> np.ndarray:
    """
    Convierte 21 landmarks (21×3) en un vector de características invariante
    a la posición de la mano y a la distancia de la cámara.

    Técnica:
      1. Centrar en la muñeca (landmark 0)
      2. Escalar por la distancia muñeca → base dedo medio (landmark 9)
      3. Aplanar a 63 valores

    Luego añade ángulos de flexión por dedo para más discriminación.
    """
    centrado = landmarks - landmarks[0]
    escala = np.linalg.norm(centrado[9])
    if escala > 1e-6:
        centrado /= escala

    coords_planas = centrado.flatten()  # 63 valores

    # Ángulos de flexión de cada falange (producto punto de vectores consecutivos)
    CONEXIONES_POR_DEDO = [
        [(0,1),(1,2),(2,3),(3,4)],    # pulgar
        [(0,5),(5,6),(6,7),(7,8)],    # índice
        [(0,9),(9,10),(10,11),(11,12)],# medio
        [(0,13),(13,14),(14,15),(15,16)],# anular
        [(0,17),(17,18),(18,19),(19,20)],# meñique
    ]

    angulos = []
    for conexiones in CONEXIONES_POR_DEDO:
        for (a, b), (b2, c) in zip(conexiones[:-1], conexiones[1:]):
            v1 = centrado[b] - centrado[a]
            v2 = centrado[c] - centrado[b2]
            n1, n2 = np.linalg.norm(v1), np.linalg.norm(v2)
            if n1 > 1e-6 and n2 > 1e-6:
                cos_ang = np.clip(np.dot(v1/n1, v2/n2), -1, 1)
                angulos.append(cos_ang)
            else:
                angulos.append(1.0)

    return np.concatenate([coords_planas, angulos])


# ── Carga del dataset ─────────────────────────────────────────────────────────

def cargar_dataset(directorio: str) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """
    Espera una estructura de carpetas donde cada subcarpeta es el nombre de la seña:

        directorio/
            A/
                muestra_001.npy   ← array (21, 3)
                muestra_002.npy
            B/
                ...

    Devuelve:
        X: array (N, n_features)
        y: array (N,) con índices de clase
        etiquetas: lista de nombres de señas
    """
    etiquetas = sorted([
        nombre for nombre in os.listdir(directorio)
        if os.path.isdir(os.path.join(directorio, nombre))
    ])

    if not etiquetas:
        raise ValueError(f"No se encontraron subcarpetas de señas en: {directorio}")

    mapa_etiqueta = {nombre: i for i, nombre in enumerate(etiquetas)}
    X_lista, y_lista = [], []

    for nombre_seña in etiquetas:
        carpeta = os.path.join(directorio, nombre_seña)
        archivos = [f for f in os.listdir(carpeta) if f.endswith(".npy")]

        for archivo in archivos:
            landmarks = np.load(os.path.join(carpeta, archivo))
            if landmarks.shape == (21, 3):
                caracteristicas = extraer_caracteristicas(landmarks)
                X_lista.append(caracteristicas)
                y_lista.append(mapa_etiqueta[nombre_seña])

        print(f"  [{nombre_seña}] {len(archivos)} muestras cargadas")

    X = np.array(X_lista, dtype=np.float32)
    y = np.array(y_lista, dtype=np.int64)
    return X, y, etiquetas


# ── Entrenamiento ─────────────────────────────────────────────────────────────

def entrenar(directorio_datos: str, ruta_salida: str, modelo: str = "rf"):
    """
    Entrena el clasificador y guarda el pipeline en disco.

    Parámetros:
        directorio_datos: carpeta con subcarpetas por seña
        ruta_salida: ruta donde guardar el .pkl
        modelo: 'rf' (RandomForest) o 'svm' (SVM con kernel RBF)
    """
    print(f"\n[Entrenamiento] Cargando datos de: {directorio_datos}")
    X, y, etiquetas = cargar_dataset(directorio_datos)
    print(f"[Entrenamiento] Total muestras: {len(X)}, Clases: {len(etiquetas)}\n")

    # Separar train/test
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Elegir clasificador
    if modelo == "svm":
        clasificador = SVC(kernel="rbf", C=10, gamma="scale", probability=True)
    else:
        # RandomForest es más robusto con pocos datos y no necesita escalar
        clasificador = RandomForestClassifier(
            n_estimators=200,
            max_depth=None,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        )

    # Pipeline: escalado (importante para SVM) + clasificador
    pipeline = Pipeline([
        ("escalador", StandardScaler()),
        ("clasificador", clasificador),
    ])

    print("[Entrenamiento] Entrenando...")
    pipeline.fit(X_train, y_train)

    # Evaluación
    y_pred = pipeline.predict(X_test)
    print("\n[Resultados en test set]")
    print(classification_report(y_test, y_pred, target_names=etiquetas))

    # Validación cruzada adicional
    scores = cross_val_score(pipeline, X, y, cv=5, scoring="accuracy")
    print(f"[CV 5-fold] Accuracy: {scores.mean():.3f} ± {scores.std():.3f}")

    # Guardar modelo
    os.makedirs(os.path.dirname(ruta_salida), exist_ok=True)
    joblib.dump({"pipeline": pipeline, "etiquetas": etiquetas}, ruta_salida)
    print(f"\n[Guardado] Modelo guardado en: {ruta_salida}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Entrena el clasificador estático de señas")
    parser.add_argument("--datos", default="data/landmarks_estaticos",
                        help="Directorio con subcarpetas por seña")
    parser.add_argument("--salida", default="models_saved/estatico.pkl",
                        help="Ruta de salida del modelo .pkl")
    parser.add_argument("--modelo", choices=["rf", "svm"], default="rf",
                        help="Tipo de clasificador: rf=RandomForest, svm=SVM")
    args = parser.parse_args()
    entrenar(args.datos, args.salida, args.modelo)
