"""
Preprocesamiento y aumentación de datos de landmarks para entrenamiento.

Funciones:
  - normalizar_mano()        → Centrar en muñeca, escalar invariante
  - aumentar_estatico()      → Rotación, espejo, ruido para señas estáticas
  - aumentar_dinamico()      → Time-warp, ruido para señas dinámicas
  - balancear_clases()       → Oversample/undersample para equilibrar el dataset
  - exportar_para_entrenamiento() → Guarda X.npy, y.npy, etiquetas.json listos para usar
"""

import os
import json
import numpy as np


# ── Normalización ─────────────────────────────────────────────────────────────

def normalizar_mano(landmarks: np.ndarray) -> np.ndarray:
    """
    Normaliza 21 landmarks (21×3) de forma invariante a posición y escala.

    1. Centra todos los puntos respecto a la muñeca (landmark 0)
    2. Escala por la distancia muñeca → base dedo medio (landmark 9)
    """
    centrado = landmarks - landmarks[0]
    escala = np.linalg.norm(centrado[9])
    if escala > 1e-6:
        centrado /= escala
    return centrado


def normalizar_secuencia(secuencia: np.ndarray) -> np.ndarray:
    """Aplica normalización frame por frame a una secuencia (N, 21, 3)."""
    return np.array([normalizar_mano(frame) for frame in secuencia], dtype=np.float32)


# ── Aumentación de datos estáticos ────────────────────────────────────────────

def rotar_mano_2d(landmarks: np.ndarray, angulo_rad: float) -> np.ndarray:
    """Rota los landmarks en el plano XY (simula inclinación de la mano)."""
    cos_a, sin_a = np.cos(angulo_rad), np.sin(angulo_rad)
    resultado = landmarks.copy()
    resultado[:, 0] = landmarks[:, 0] * cos_a - landmarks[:, 1] * sin_a
    resultado[:, 1] = landmarks[:, 0] * sin_a + landmarks[:, 1] * cos_a
    return resultado


def espejar_mano(landmarks: np.ndarray) -> np.ndarray:
    """
    Espeja la mano horizontalmente (X = -X).
    Útil para convertir muestras de mano derecha a izquierda.
    """
    resultado = landmarks.copy()
    resultado[:, 0] = -resultado[:, 0]
    return resultado


def añadir_ruido(landmarks: np.ndarray, intensidad: float = 0.02) -> np.ndarray:
    """Añade ruido gaussiano pequeño para simular imprecisión de MediaPipe."""
    return landmarks + np.random.normal(0, intensidad, landmarks.shape).astype(np.float32)


def aumentar_estatico(landmarks: np.ndarray, n_aumentaciones: int = 5) -> list[np.ndarray]:
    """
    Genera N variaciones de un landmark estático mediante:
    - Rotaciones pequeñas (±15°)
    - Espejo (mano izquierda/derecha)
    - Ruido gaussiano

    Útil cuando el dataset tiene pocas muestras por clase.
    """
    variaciones = []
    for _ in range(n_aumentaciones):
        lm = landmarks.copy()

        # Rotación aleatoria ±15°
        if np.random.rand() > 0.4:
            angulo = np.random.uniform(-0.26, 0.26)  # ±15° en radianes
            lm = rotar_mano_2d(lm, angulo)

        # Espejo con 30% de probabilidad
        if np.random.rand() > 0.7:
            lm = espejar_mano(lm)

        # Siempre añadir algo de ruido
        lm = añadir_ruido(lm, intensidad=np.random.uniform(0.01, 0.03))

        variaciones.append(lm)

    return variaciones


# ── Aumentación de datos dinámicos ────────────────────────────────────────────

def time_warp(secuencia: np.ndarray, factor: float = 0.9) -> np.ndarray:
    """
    Estira o comprime temporalmente la secuencia (simula velocidad de ejecución diferente).
    Devuelve una secuencia de la misma longitud que la original.
    """
    n = len(secuencia)
    nueva_longitud = max(3, int(n * factor))
    indices = np.linspace(0, n - 1, nueva_longitud)

    # Interpolar
    estirada = []
    for i in indices:
        bajo = int(i)
        alto = min(bajo + 1, n - 1)
        peso = i - bajo
        estirada.append(secuencia[bajo] * (1 - peso) + secuencia[alto] * peso)
    estirada = np.array(estirada, dtype=np.float32)

    # Volver a la longitud original
    return interpolar_a_longitud(estirada, n)


def interpolar_a_longitud(secuencia: np.ndarray, longitud: int) -> np.ndarray:
    """Interpola una secuencia a una longitud específica."""
    n = len(secuencia)
    if n == longitud:
        return secuencia
    indices = np.linspace(0, n - 1, longitud)
    resultado = []
    for i in indices:
        bajo = int(i)
        alto = min(bajo + 1, n - 1)
        peso = i - bajo
        resultado.append(secuencia[bajo] * (1 - peso) + secuencia[alto] * peso)
    return np.array(resultado, dtype=np.float32)


def aumentar_dinamico(secuencia: np.ndarray, n_aumentaciones: int = 3) -> list[np.ndarray]:
    """
    Genera N variaciones de una secuencia dinámica mediante:
    - Time-warp (velocidad diferente)
    - Ruido por frame
    - Espejo horizontal de cada frame
    """
    variaciones = []
    for _ in range(n_aumentaciones):
        seq = secuencia.copy()

        # Time-warp con factor aleatorio (±20% de velocidad)
        if np.random.rand() > 0.3:
            factor = np.random.uniform(0.8, 1.2)
            seq = time_warp(seq, factor)

        # Espejo con 30% de probabilidad
        if np.random.rand() > 0.7:
            seq = np.array([espejar_mano(frame) for frame in seq])

        # Ruido
        seq = seq + np.random.normal(0, 0.02, seq.shape).astype(np.float32)

        variaciones.append(seq)

    return variaciones


# ── Balance de clases ─────────────────────────────────────────────────────────

def balancear_clases(
    X: np.ndarray,
    y: np.ndarray,
    metodo: str = "oversample",
    objetivo: int | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Equilibra el número de muestras por clase.

    metodo:
        'oversample' → Duplica/aumenta las clases con menos muestras
        'undersample' → Reduce las clases con más muestras al mínimo
    objetivo: número de muestras objetivo por clase (None = usar la mayoría/minoría)
    """
    clases_unicas, conteos = np.unique(y, return_counts=True)

    if metodo == "undersample":
        n_objetivo = objetivo or int(np.min(conteos))
    else:
        n_objetivo = objetivo or int(np.max(conteos))

    X_bal, y_bal = [], []
    for clase in clases_unicas:
        mascara = y == clase
        X_clase = X[mascara]

        if len(X_clase) >= n_objetivo:
            # Undersample: tomar aleatoriamente
            indices = np.random.choice(len(X_clase), n_objetivo, replace=False)
            X_bal.append(X_clase[indices])
        else:
            # Oversample: repetir con reemplazo
            indices = np.random.choice(len(X_clase), n_objetivo, replace=True)
            X_bal.append(X_clase[indices])

        y_bal.append(np.full(n_objetivo, clase))

    return np.vstack(X_bal), np.concatenate(y_bal)


# ── Exportación final para entrenamiento ──────────────────────────────────────

def exportar_para_entrenamiento(
    directorio_entrada: str,
    directorio_salida: str,
    modo: str = "estatico",
    longitud_secuencia: int = 30,
    aumentar: bool = True,
):
    """
    Lee los archivos .npy de landmarks, los preprocesa y guarda
    X.npy, y.npy, etiquetas.json listos para train_static.py o train_dynamic.py.

    modo: 'estatico' → (21, 3) por muestra | 'dinamico' → (N, 21, 3) por muestra
    """
    señas = sorted([
        d for d in os.listdir(directorio_entrada)
        if os.path.isdir(os.path.join(directorio_entrada, d))
    ])

    mapa_etiqueta = {nombre: i for i, nombre in enumerate(señas)}
    X_lista, y_lista = [], []

    for nombre_seña in señas:
        carpeta = os.path.join(directorio_entrada, nombre_seña)
        archivos = [f for f in os.listdir(carpeta) if f.endswith(".npy")]
        clase_idx = mapa_etiqueta[nombre_seña]

        for archivo in archivos:
            datos = np.load(os.path.join(carpeta, archivo))

            if modo == "estatico":
                if datos.shape != (21, 3):
                    continue
                lm_norm = normalizar_mano(datos)
                X_lista.append(lm_norm.flatten())
                y_lista.append(clase_idx)

                if aumentar:
                    for lm_aug in aumentar_estatico(lm_norm, n_aumentaciones=4):
                        X_lista.append(lm_aug.flatten())
                        y_lista.append(clase_idx)

            elif modo == "dinamico":
                if datos.ndim != 3 or datos.shape[1:] != (21, 3):
                    continue
                seq_norm = normalizar_secuencia(datos)
                seq_interp = interpolar_a_longitud(
                    seq_norm.reshape(len(seq_norm), -1), longitud_secuencia
                )
                X_lista.append(seq_interp)
                y_lista.append(clase_idx)

                if aumentar:
                    for seq_aug in aumentar_dinamico(seq_norm, n_aumentaciones=2):
                        seq_aug_interp = interpolar_a_longitud(
                            seq_aug.reshape(len(seq_aug), -1), longitud_secuencia
                        )
                        X_lista.append(seq_aug_interp)
                        y_lista.append(clase_idx)

        print(f"  [{nombre_seña}] {len([f for f in archivos])} muestras (con aumento={aumentar})")

    os.makedirs(directorio_salida, exist_ok=True)
    np.save(os.path.join(directorio_salida, "X.npy"), np.array(X_lista, dtype=np.float32))
    np.save(os.path.join(directorio_salida, "y.npy"), np.array(y_lista, dtype=np.int64))

    with open(os.path.join(directorio_salida, "etiquetas.json"), "w", encoding="utf-8") as f:
        json.dump(señas, f, ensure_ascii=False, indent=2)

    print(f"\n[Exportado] {len(X_lista)} muestras totales → {directorio_salida}")
    print(f"  X.npy: {np.array(X_lista).shape}")
    print(f"  Etiquetas: {señas}")
