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

# Índices de las puntas de cada dedo en el esquema de MediaPipe Hands
PUNTAS_DEDOS = [4, 8, 12, 16, 20]  # pulgar, índice, medio, anular, meñique

# Pares de puntas cuya distancia discrimina señas que el modelo suele confundir:
#  - pulgar → cada otra punta: distingue A/E/S/O/C (cuánto se cierra la mano)
#  - puntas adyacentes índice-medio-anular-meñique: distingue U/V/R/W
#    (qué dedos van juntos y cuáles separados)
PARES_DISTANCIA_PUNTAS = [
    (4, 8), (4, 12), (4, 16), (4, 20),   # pulgar con el resto
    (8, 12), (12, 16), (16, 20),          # puntas vecinas
]


def extraer_caracteristicas(landmarks: np.ndarray) -> np.ndarray:
    """
    Convierte 21 landmarks (21×3) en un vector de características invariante
    a la posición de la mano y a la distancia de la cámara.

    Técnica:
      1. Centrar en la muñeca (landmark 0)
      2. Escalar por la distancia muñeca → base dedo medio (landmark 9)
      3. Aplanar a 63 valores

    Luego añade:
      - ángulos de flexión por dedo (15 valores) para captar cuánto se dobla
        cada falange,
      - distancias entre puntas de dedos (7 valores) para captar qué dedos
        están juntos o separados, que es justo lo que distingue los pares de
        letras más confundidos (U/V/R, A/E/S, M/N...).

    Vector resultante: 63 + 15 + 7 = 85 características.
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

    # Distancias entre puntas de dedos (ya en escala normalizada por 'centrado')
    distancias = [
        np.linalg.norm(centrado[a] - centrado[b])
        for (a, b) in PARES_DISTANCIA_PUNTAS
    ]

    return np.concatenate([coords_planas, angulos, distancias])


# ── Data augmentation sobre landmarks ─────────────────────────────────────────
# Se aplica a los landmarks CRUDOS (21×3) antes de extraer características, para
# que el modelo vea variaciones realistas de la misma seña: la mano un poco
# rotada, ruido de detección de MediaPipe y manos zurdas (espejo). Esto reduce
# el sobreajuste a las fotos de estudio del dataset y mejora la robustez en la
# cámara real del usuario, sin necesidad de capturar más muestras.

def _rotar_landmarks(landmarks: np.ndarray, rng: np.random.Generator,
                     max_grados: float = 15.0) -> np.ndarray:
    """Aplica una pequeña rotación 3D aleatoria alrededor de la muñeca."""
    angs = np.deg2rad(rng.uniform(-max_grados, max_grados, size=3))
    cx, cy, cz = np.cos(angs)
    sx, sy, sz = np.sin(angs)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    R = Rz @ Ry @ Rx
    pivote = landmarks[0]
    return (landmarks - pivote) @ R.T + pivote


def aumentar_muestra(landmarks: np.ndarray, rng: np.random.Generator,
                     espejo: bool = False) -> np.ndarray:
    """
    Genera una variante de una muestra (21×3): rotación leve + ruido gaussiano,
    y opcionalmente reflejo horizontal (mano contraria).
    """
    out = landmarks.copy()
    if espejo:
        out[:, 0] = -out[:, 0]  # reflejar eje X → mano zurda/diestra
    out = _rotar_landmarks(out, rng)
    out = out + rng.normal(0, 0.01, size=out.shape).astype(np.float32)  # ruido ~1%
    return out.astype(np.float32)


def aumentar_landmarks(X_raw: np.ndarray, y: np.ndarray, n_aug: int = 4,
                       incluir_espejo: bool = True,
                       semilla: int = 42) -> tuple[np.ndarray, np.ndarray]:
    """
    Por cada muestra cruda (21×3) genera `n_aug` variantes aumentadas y las
    concatena a las originales. Devuelve (X_raw_aumentado, y_aumentado).
    """
    rng = np.random.default_rng(semilla)
    X_lista = [X_raw]
    y_lista = [y]
    for k in range(n_aug):
        espejo = incluir_espejo and (k % 2 == 1)  # la mitad de las variantes en espejo
        variantes = np.array(
            [aumentar_muestra(lm, rng, espejo=espejo) for lm in X_raw],
            dtype=np.float32,
        )
        X_lista.append(variantes)
        y_lista.append(y)
    return np.concatenate(X_lista, axis=0), np.concatenate(y_lista, axis=0)


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

    Devuelve los landmarks CRUDOS (no las características) para poder hacer el
    split train/test ANTES de aumentar y así evitar fugas de datos (variantes
    aumentadas de una misma muestra cayendo en train y test a la vez).

        X_raw: array (N, 21, 3)
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

        cargadas = 0
        for archivo in archivos:
            landmarks = np.load(os.path.join(carpeta, archivo))
            if landmarks.shape == (21, 3):
                X_lista.append(landmarks.astype(np.float32))
                y_lista.append(mapa_etiqueta[nombre_seña])
                cargadas += 1

        print(f"  [{nombre_seña}] {cargadas} muestras cargadas")

    X_raw = np.array(X_lista, dtype=np.float32)  # (N, 21, 3)
    y = np.array(y_lista, dtype=np.int64)
    return X_raw, y, etiquetas


def _features_de_lote(X_raw: np.ndarray) -> np.ndarray:
    """Aplica extraer_caracteristicas a cada muestra cruda de un lote (N,21,3)."""
    return np.array([extraer_caracteristicas(lm) for lm in X_raw], dtype=np.float32)


# ── Entrenamiento ─────────────────────────────────────────────────────────────

def entrenar(directorio_datos: str, ruta_salida: str, modelo: str = "rf",
             n_aug: int = 4):
    """
    Entrena el clasificador y guarda el pipeline en disco.

    Parámetros:
        directorio_datos: carpeta con subcarpetas por seña
        ruta_salida: ruta donde guardar el .pkl
        modelo: 'rf' (RandomForest) o 'svm' (SVM con kernel RBF)
        n_aug: variantes aumentadas por muestra de entrenamiento (0 = sin augmentation)
    """
    print(f"\n[Entrenamiento] Cargando datos de: {directorio_datos}")
    X_raw, y, etiquetas = cargar_dataset(directorio_datos)
    print(f"[Entrenamiento] Total muestras: {len(X_raw)}, Clases: {len(etiquetas)}\n")

    # Separar train/test sobre landmarks CRUDOS, antes de aumentar.
    X_raw_train, X_raw_test, y_train, y_test = train_test_split(
        X_raw, y, test_size=0.2, random_state=42, stratify=y
    )

    # Aumentar SOLO el train (el test queda intacto para una evaluación honesta).
    if n_aug > 0:
        X_raw_train, y_train = aumentar_landmarks(X_raw_train, y_train, n_aug=n_aug)
        print(f"[Entrenamiento] Train aumentado a {len(X_raw_train)} muestras "
              f"(x{n_aug + 1} con augmentation)\n")

    # Extraer características una vez hecho el split/augmentation.
    X_train = _features_de_lote(X_raw_train)
    X_test = _features_de_lote(X_raw_test)

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

    # Validación cruzada sobre los datos SIN aumentar (medida honesta; aumentar
    # dentro de CV filtraría variantes de una misma muestra entre folds).
    X_full = _features_de_lote(X_raw)
    scores = cross_val_score(pipeline, X_full, y, cv=5, scoring="accuracy")
    print(f"[CV 5-fold, sin augmentation] Accuracy: {scores.mean():.3f} ± {scores.std():.3f}")

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
    parser.add_argument("--aug", type=int, default=4,
                        help="Variantes aumentadas por muestra de train (0 = desactivar)")
    args = parser.parse_args()
    entrenar(args.datos, args.salida, args.modelo, n_aug=args.aug)
