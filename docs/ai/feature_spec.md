# Especificación del vector de features

`feature_spec_version`: **2.0**. Generado con `python -m preprocessing.spec --doc` desde `config/preprocesamiento/features.yaml`.

## Versiones

| Versión | Cambios |
|---|---|
| 1.0 | Vector legado de `scripts/holistic_pipeline.py`: 527 valores por frame, manos en marco local, marco neutro si falta la pose, sin bloques temporales, T = 60. Se reproduce con `FeatureSpec.v1()`. |
| 2.0 | Mismo orden base. Agrega: subconjuntos de pose y cara configurables, índices faciales congelados, marco de manos configurable (`local` o `corporal`), marco por frame vecino cuando falta la pose, y bloques de velocidad y aceleración. |

## 1. Vector base por frame

El orden es el mismo de la versión 1.0 (vector legado de 527 valores). Cada punto aporta `x, y, z` en ese orden.

| Segmento | Rango | Largo | Contenido | Normalización |
|---|---|---|---|---|
| `mano_izq` | [0:63] | 63 | 21 landmarks de la mano izquierda (de la imagen), índices 0-20 de MediaPipe Hands | Según `marco_manos`: *local* = origen en la muñeca (0) y escala muñeca→base del dedo medio (9); *corporal* = marco de hombros. Ceros si no se detectó. |
| `mano_der` | [63:126] | 63 | 21 landmarks de la mano derecha | Igual que la mano izquierda. |
| `presencia` | [126:128] | 2 | Flags de presencia: [izquierda, derecha] | 1.0 detectada, 0.0 ausente. |
| `pose` | [128:179] | 51 | Pose, índices [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] | Origen en el punto medio entre hombros (11, 12), escala por la distancia entre hombros. Ceros si no hay pose. |
| `cara` | [179:527] | 348 | Cara (116 puntos): grupos ['labios', 'ojo_izq', 'ojo_der', 'ceja_izq', 'ceja_der', 'nariz'] | Mismo marco que la pose. Ceros si no hay cara. |

Largo del vector base: **527**.

Si en un frame falta la pose, el marco corporal se toma del frame con pose más cercano (`referencia_sin_pose: vecino`) o de un marco neutro centrado en la imagen (`neutral`, comportamiento de la versión 1.0).

### Índices faciales (orden ascendente)

`[0, 1, 2, 4, 5, 6, 7, 13, 14, 17, 19, 33, 37, 39, 40, 45, 46, 48, 52, 53, 55, 61, 63, 64, 65, 66, 70, 78, 80, 81, 82, 84, 87, 88, 91, 94, 95, 97, 98, 105, 107, 115, 133, 144, 145, 146, 153, 154, 155, 157, 158, 159, 160, 161, 163, 168, 173, 178, 181, 185, 191, 195, 197, 220, 246, 249, 263, 267, 269, 270, 275, 276, 278, 282, 283, 285, 291, 293, 294, 295, 296, 300, 308, 310, 311, 312, 314, 317, 318, 321, 324, 326, 327, 334, 336, 344, 362, 373, 374, 375, 380, 381, 382, 384, 385, 386, 387, 388, 390, 398, 402, 405, 409, 415, 440, 466]`

## 2. Vector de entrada al modelo

Cada secuencia se remuestrea a **T = 30** frames por interpolación lineal. Después se concatenan los bloques temporales activos, en este orden:

| Segmento | Rango | Largo |
|---|---|---|
| `posicion.mano_izq` | [0:63] | 63 |
| `posicion.mano_der` | [63:126] | 63 |
| `posicion.presencia` | [126:128] | 2 |
| `posicion.pose` | [128:179] | 51 |
| `posicion.cara` | [179:527] | 348 |
| `velocidad.mano_izq` | [527:590] | 63 |
| `velocidad.mano_der` | [590:653] | 63 |
| `velocidad.pose` | [653:704] | 51 |
| `velocidad.cara` | [704:1052] | 348 |
| `aceleracion.mano_izq` | [1052:1115] | 63 |
| `aceleracion.mano_der` | [1115:1178] | 63 |
| `aceleracion.pose` | [1178:1229] | 51 |
| `aceleracion.cara` | [1229:1577] | 348 |

Largo total por frame: **1577**. Tensor de entrada: `[B, 30, 1577]`.

- **Velocidad**: `v[t] = x[t] − x[t−1]`, con `v[0] = 0`. Excluye los flags de presencia.
- **Aceleración**: `a[t] = v[t] − v[t−1]`, con `a[0] = 0`.
- Para cada parte (mano, pose, cara), la derivada vale 0 si la parte no está presente en `t` o en `t−1`, para que la aparición o desaparición de una mano no se lea como un movimiento brusco.

## 3. Configuración usada

```yaml
feature_spec_version: '2.0'
extraccion:
  fps_muestreo: 30
  confianza_deteccion: 0.5
  confianza_landmarks: 0.5
partes:
  pose_indices:
  - 0
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
  - 9
  - 10
  - 11
  - 12
  - 13
  - 14
  - 15
  - 16
  cara:
    grupos:
    - labios
    - ojo_izq
    - ojo_der
    - ceja_izq
    - ceja_der
    - nariz
    indices_extra: []
normalizacion:
  marco_manos: local
  referencia_sin_pose: vecino
remuestreo:
  T: 30
bloques_temporales:
  posicion: true
  velocidad: true
  aceleracion: true
```

