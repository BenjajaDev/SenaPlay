"""
Entrenamiento del clasificador de señas DINÁMICAS (con movimiento).

Arquitectura: LSTM bidireccional → capa densa → softmax
El modelo aprende patrones temporales de movimiento de la mano.

Flujo:
  1. Lee secuencias de landmarks (N frames × 21 landmarks × 3 coordenadas)
  2. Normaliza cada frame relativo a su propia muñeca
  3. Interpola todas las secuencias a la misma longitud
  4. Entrena el modelo LSTM con PyTorch
  5. Guarda el modelo en models_saved/dinamico.pt

Uso:
    python model/train_dynamic.py --datos data/landmarks_dinamicos --salida models_saved/dinamico.pt

Dataset recomendado para señas con movimiento:
  - WLASL (2000 palabras ASL con video): https://dxli94.github.io/WLASL/
  - MS-ASL: https://www.microsoft.com/en-us/research/project/ms-asl/
  - LSA64 (tiene movimientos): https://facundoq.github.io/datasets/lsa64/
  - AUTSL (Turkish SL, 226 señas): https://cvml.ankara.edu.tr/datasets/
"""

import argparse
import os
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset, random_split


# ── Arquitectura del modelo ───────────────────────────────────────────────────

class ModeloLSTM(nn.Module):
    """
    LSTM bidireccional para clasificar secuencias de movimiento de mano.

    Entrada:  (batch, longitud_secuencia, 63)  — 21 landmarks × 3 coordenadas
    Salida:   (batch, num_clases)              — logits por clase
    """

    def __init__(self, entrada: int = 63, oculto: int = 128,
                 capas: int = 2, clases: int = 10):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=entrada,
            hidden_size=oculto,
            num_layers=capas,
            batch_first=True,
            bidirectional=True,  # bidireccional duplica la capacidad de detección de patrones
            dropout=0.3 if capas > 1 else 0,
        )
        # × 2 por ser bidireccional
        self.clasificador = nn.Sequential(
            nn.Linear(oculto * 2, 128),
            nn.ReLU(),
            nn.Dropout(0.4),
            nn.Linear(128, clases),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # salida del LSTM: (batch, seq, oculto*2)
        salida, _ = self.lstm(x)
        # Usamos solo el último paso temporal para clasificar
        ultimo_paso = salida[:, -1, :]
        return self.clasificador(ultimo_paso)


# ── Preprocesamiento de secuencias ────────────────────────────────────────────

def normalizar_frame(landmarks: np.ndarray) -> np.ndarray:
    """Centra un frame en la muñeca y escala por distancia muñeca→dedo medio."""
    centrado = landmarks - landmarks[0]
    escala = np.linalg.norm(centrado[9])
    if escala > 1e-6:
        centrado /= escala
    return centrado.flatten()  # 63 valores


def interpolar_secuencia(secuencia: np.ndarray, longitud_objetivo: int) -> np.ndarray:
    """
    Redimensiona una secuencia de cualquier longitud a longitud_objetivo frames
    mediante interpolación lineal.
    """
    n = len(secuencia)
    if n == longitud_objetivo:
        return secuencia

    indices = np.linspace(0, n - 1, longitud_objetivo)
    resultado = []
    for i in indices:
        bajo = int(i)
        alto = min(bajo + 1, n - 1)
        peso = i - bajo
        resultado.append(secuencia[bajo] * (1 - peso) + secuencia[alto] * peso)
    return np.array(resultado, dtype=np.float32)


# ── Carga del dataset ─────────────────────────────────────────────────────────

def cargar_dataset_dinamico(
    directorio: str,
    longitud_secuencia: int = 30,
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """
    Espera una estructura de carpetas donde cada subcarpeta es una seña
    y cada archivo .npy es una secuencia (N_frames, 21, 3):

        directorio/
            hola/
                secuencia_001.npy   ← array (N, 21, 3)
                secuencia_002.npy
            gracias/
                ...

    Devuelve:
        X: array (muestras, longitud_secuencia, 63)
        y: array (muestras,) con índices de clase
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
            secuencia_bruta = np.load(os.path.join(carpeta, archivo))  # (N, 21, 3)
            if secuencia_bruta.ndim != 3 or secuencia_bruta.shape[1:] != (21, 3):
                continue

            # Normalizar cada frame
            frames_normalizados = np.array([
                normalizar_frame(frame) for frame in secuencia_bruta
            ], dtype=np.float32)

            # Interpolar a longitud fija
            secuencia_fija = interpolar_secuencia(frames_normalizados, longitud_secuencia)
            X_lista.append(secuencia_fija)
            y_lista.append(mapa_etiqueta[nombre_seña])

        print(f"  [{nombre_seña}] {len(archivos)} secuencias cargadas")

    X = np.array(X_lista, dtype=np.float32)  # (N, T, 63)
    y = np.array(y_lista, dtype=np.int64)
    return X, y, etiquetas


# ── Entrenamiento ─────────────────────────────────────────────────────────────

def entrenar(
    directorio_datos: str,
    ruta_salida: str,
    longitud_secuencia: int = 30,
    epocas: int = 60,
    batch: int = 32,
    lr: float = 1e-3,
    oculto: int = 128,
    capas: int = 2,
):
    dispositivo = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[Entrenamiento] Dispositivo: {dispositivo}")

    print(f"[Entrenamiento] Cargando datos de: {directorio_datos}")
    X, y, etiquetas = cargar_dataset_dinamico(directorio_datos, longitud_secuencia)
    print(f"[Entrenamiento] Total: {len(X)} secuencias, {len(etiquetas)} clases\n")

    # Tensores
    X_t = torch.tensor(X, dtype=torch.float32)
    y_t = torch.tensor(y, dtype=torch.long)
    dataset = TensorDataset(X_t, y_t)

    # Separar 80% entrenamiento / 20% validación
    n_train = int(len(dataset) * 0.8)
    n_val = len(dataset) - n_train
    train_ds, val_ds = random_split(dataset, [n_train, n_val])

    train_dl = DataLoader(train_ds, batch_size=batch, shuffle=True)
    val_dl = DataLoader(val_ds, batch_size=batch)

    # Modelo y optimizador
    modelo = ModeloLSTM(entrada=63, oculto=oculto, capas=capas, clases=len(etiquetas))
    modelo = modelo.to(dispositivo)
    optimizador = optim.Adam(modelo.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizador, patience=5, factor=0.5)
    criterio = nn.CrossEntropyLoss()

    mejor_precision = 0.0

    for epoca in range(1, epocas + 1):
        # ── Entrenamiento ──
        modelo.train()
        perdida_total = 0.0
        for lotes_X, lotes_y in train_dl:
            lotes_X, lotes_y = lotes_X.to(dispositivo), lotes_y.to(dispositivo)
            optimizador.zero_grad()
            logits = modelo(lotes_X)
            perdida = criterio(logits, lotes_y)
            perdida.backward()
            nn.utils.clip_grad_norm_(modelo.parameters(), max_norm=1.0)
            optimizador.step()
            perdida_total += perdida.item()

        # ── Validación ──
        modelo.eval()
        correctos = total = 0
        with torch.no_grad():
            for lotes_X, lotes_y in val_dl:
                lotes_X, lotes_y = lotes_X.to(dispositivo), lotes_y.to(dispositivo)
                predicciones = modelo(lotes_X).argmax(dim=-1)
                correctos += (predicciones == lotes_y).sum().item()
                total += len(lotes_y)

        precision = correctos / total
        scheduler.step(perdida_total)

        if epoca % 10 == 0 or precision > mejor_precision:
            print(f"  Época {epoca:3d}/{epocas} | "
                  f"Pérdida: {perdida_total/len(train_dl):.4f} | "
                  f"Val Acc: {precision:.3f}")

        # Guardar el mejor modelo visto hasta ahora
        if precision > mejor_precision:
            mejor_precision = precision
            os.makedirs(os.path.dirname(ruta_salida), exist_ok=True)
            torch.save({
                "estado": modelo.state_dict(),
                "etiquetas": etiquetas,
                "longitud_secuencia": longitud_secuencia,
                "oculto": oculto,
                "capas": capas,
            }, ruta_salida)

    print(f"\n[Guardado] Mejor modelo (acc={mejor_precision:.3f}) en: {ruta_salida}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Entrena el clasificador dinámico de señas")
    parser.add_argument("--datos", default="data/landmarks_dinamicos")
    parser.add_argument("--salida", default="models_saved/dinamico.pt")
    parser.add_argument("--longitud", type=int, default=30,
                        help="Frames por secuencia (interpolados)")
    parser.add_argument("--epocas", type=int, default=60)
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    args = parser.parse_args()
    entrenar(args.datos, args.salida, args.longitud, args.epocas, args.batch, args.lr)
