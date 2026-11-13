# Selección del modelo dinámico

Generado el 2026-10-31 03:18 a partir de `results` (experimento `comparacion_temporal`, validación `kfold`).

## Criterio

1. Se toma la arquitectura con mayor F1 macro promedio sobre pliegues × semillas.
2. Las arquitecturas cuyo F1 macro medio queda dentro de una desviación estándar de la mejor (media ≥ media_mejor − DE_mejor) se consideran empatadas.
3. Entre las empatadas se elige la de menor latencia media (CPU, batch 1).

## Candidatas

| Arquitectura | F1 macro | Latencia media (ms) | Latencia p95 (ms) | Parámetros | Empatada con la mejor |
|---|---:|---:|---:|---:|:---:|
| GRU | 63.1 ± 6.6 | 7.19 | 13.66 | 226697 | sí |
| TCN | 62.7 ± 7.7 | 12.81 | 29.51 | 258729 | sí |
| LSTM | 58.5 ± 9.5 | 5.59 | 14.43 | 268169 | sí |

## Resultado

- Mayor F1 macro: **GRU** (63.1 ± 6.6). Umbral de empate: 56.5.
- Empatadas: TCN, LSTM, GRU.
- **Elegida: LSTM** (menor latencia entre las empatadas).
- Corrida de referencia: `results/20261031-015148_lstm` (commit `8391f05b00eb`).
