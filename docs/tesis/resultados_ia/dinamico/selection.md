# Selección del modelo dinámico

Generado el 2026-11-19 15:47 a partir de `results` (experimento `comparacion_temporal`, validación `kfold`).

## Criterio

1. Se toma la arquitectura con mayor F1 macro promedio sobre pliegues × semillas.
2. Las arquitecturas cuyo F1 macro medio queda dentro de una desviación estándar de la mejor (media ≥ media_mejor − DE_mejor) se consideran empatadas.
3. Entre las empatadas se elige la de menor latencia media (CPU, batch 1).

## Candidatas

| Arquitectura | F1 macro | Latencia media (ms) | Latencia p95 (ms) | Parámetros | Empatada con la mejor |
|---|---:|---:|---:|---:|:---:|
| TCN | 71.4 ± 5.8 | 2.94 | 3.05 | 259134 | sí |
| GRU | 70.1 ± 7.3 | 3.91 | 4.00 | 227342 | sí |
| LSTM | 63.2 ± 10.3 | 1.28 | 1.35 | 268814 | no |

## Resultado

- Mayor F1 macro: **TCN** (71.4 ± 5.8). Umbral de empate: 65.6.
- Empatadas: TCN, GRU.
- **Elegida: TCN** (menor latencia entre las empatadas).
- Corrida de referencia: `results/20261119-144628_tcn` (commit `86bf2c9b5765`).
