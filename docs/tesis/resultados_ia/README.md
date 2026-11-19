# Resultados de IA para el Capítulo IV

Evidencias agregadas de la comparación de arquitecturas temporales (TCN, LSTM y GRU) para las
señas dinámicas, de la ablación sin aumento de datos y de la evaluación del modelo estático.
Solo hay métricas, conteos y figuras: no se incluyen videos, landmarks, predicciones por video
ni particiones.

`dinamico/`, `tablas/`, `ablacion/`, `modelo_exportado/` y la latencia de `integracion/` se
**regeneraron el 2026-11-19** en `gestilingo-dev` con el conjunto ampliado (562 videos útiles,
57 señantes, 14 clases). `estatico/` y la equivalencia de `integracion/` siguen siendo del
**2026-10-31**: no dependen de los videos dinámicos.

## Entorno

Comparación dinámica del 2026-11-19: Python **3.11.0**, PyTorch 2.14.0 (CPU) y scikit-learn
1.9.0 (ver `dinamico/entorno.json`). El modelo estático del 2026-10-31 se evaluó con Python
3.12.10 (`estatico/entorno.json`).

## Corridas y commits

Todas las corridas se hicieron con el árbol de git limpio; el hash queda en el `commit.txt` de
cada carpeta.

| Qué | Comando (desde `ai_module/`) | Commit |
|---|---|---|
| Comparación TCN / LSTM / GRU | `python -m training.run_all` | `86bf2c9` |
| Selección | `python -m training.select_model --solo-seleccionar` | `86bf2c9` |
| Exportación de la TCN | `python -m training.select_model --arquitectura tcn` | entrenada en `86bf2c9`, commiteada en `9ddce9a` |
| Figuras | `python -m training.curvas` y `python -m training.figuras_tesis` | `86bf2c9` |
| Ablación sin aumento | `python -m training.run_all --experimento config/experimentos/ablaciones/sin_aumento.yaml` | `a72e09c` (mismo código que `86bf2c9`) |
| Figura de la ablación | `python -m training.figuras_tesis --experimento ablacion_sin_aumento --salida comparacion_f1_macro_sin_aumento.png` | `a72e09c` |
| Latencia del servidor | `python -m scripts.medir_latencia` | `9ddce9a` |
| Modelo estático (2026-10-31) | `python -m training.eval_static_produccion` | `4794e36` |

## Protocolo de las señas dinámicas

- **Datos:** 575 videos de 57 señantes en las 14 clases; 562 útiles (13 descartados por más de
  50 % de cuadros sin manos). Ningún señante quedó fuera. Detalle en `tablas/descartes.csv`.
- **Videos útiles por clase:** Alergia 27 · Dolor 73 · G 39 · J 40 · Mi 30 · Mucho 41 ·
  Nombre 27 · Presento 30 · S 43 · Tengo 34 · X 44 · Yo 49 · Z 39 · ninguna 46 (desbalance
  2,70 > 1,5: se usan pesos de clase).
- **Validación:** `StratifiedGroupKFold(5)` agrupado por señante (ningún señante en
  entrenamiento y prueba a la vez), 3 señantes de validación por pliegue para la detención
  temprana, semillas 0, 1 y 2 (15 entrenamientos por arquitectura). Entrada `[B, 30, 1577]`
  (FeatureSpec 2.0), AdamW, hasta 150 épocas, paciencia 20 sobre el F1 macro de validación.
- **Criterio de selección (fijado antes de ver los datos):** mayor F1 macro medio; las
  arquitecturas con media ≥ mejor − DE de la mejor se consideran empatadas y gana la de menor
  latencia media.
- La clase de rechazo `ninguna` **entra** al experimento como una clase más.

## Resultados dinámicos

Media ± DE sobre 15 entrenamientos. Latencia: solo el modelo, CPU con 1 hilo, batch 1, 200
mediciones.

| Arquitectura | F1 macro | Accuracy | Latencia media / mediana / p95 (ms) | Parámetros | Tamaño |
|---|---|---|---|---|---|
| TCN | 0,714 ± 0,058 | 0,724 ± 0,061 | 2,94 / 2,91 / 3,05 | 259 134 | 1,01 MB |
| LSTM | 0,632 ± 0,103 | 0,639 ± 0,100 | 1,28 / 1,27 / 1,35 | 268 814 | 1,03 MB |
| GRU | 0,701 ± 0,073 | 0,703 ± 0,074 | 3,91 / 3,88 / 4,00 | 227 342 | 0,87 MB |

- Umbral de empate 0,714 − 0,058 = 0,656: empatan TCN y GRU (la LSTM queda fuera) y **se elige
  la TCN** por menor latencia entre las empatadas (`dinamico/selection.md`).
- Comparación pareada (`tablas/comparacion_pareada.csv`): TCN − LSTM = +0,082 (gana en 11 de 15
  entrenamientos y en 5 de 5 pliegues); TCN − GRU = +0,013 (7 de 15; 3 de 5);
  GRU − LSTM = +0,069 (11 de 15; 5 de 5). La diferencia TCN − GRU es menor que la variabilidad
  entre pliegues y semillas.
- Las métricas coinciden con las de la corrida del 2026-11-13 sobre los mismos datos: el
  entrenamiento es reproducible. La latencia sí varía entre mediciones; las tres están muy por
  debajo de 33 ms (un cuadro a 30 fps).
- Por clase (`tablas/por_clase.csv`, F1 de la TCN): Mucho 0,95 y Presento 0,92 son las más
  fáciles; las más difíciles son S (0,42), Z (0,44) y X (0,54).
- Por señante (`tablas/por_senante.csv`): **s19 (1 video), s20 (3) y s24 (2) tienen menos de
  4 videos útiles y no se deben interpretar.**
- Curvas por arquitectura en `dinamico/<arquitectura>/curvas_entrenamiento.png`.

## Ablación sin aumento de datos

`ablacion/ablacion_sin_aumento.csv`. Mismas particiones y semillas que el experimento principal;
solo se apaga el aumento. Se reporta como ablación; no cambia el modelo elegido.

| Arquitectura | F1 macro con aumento | F1 macro sin aumento | Diferencia (con − sin) | Con aumento gana |
|---|---|---|---|---|
| TCN | 0,714 ± 0,058 | 0,776 ± 0,052 | −0,062 ± 0,051 | 3 de 15 entrenamientos; 0 de 5 pliegues |
| LSTM | 0,632 ± 0,103 | 0,645 ± 0,076 | −0,013 ± 0,121 | 8 de 15; 1 de 5 |
| GRU | 0,701 ± 0,073 | 0,670 ± 0,070 | +0,032 ± 0,063 | 11 de 15; 5 de 5 |

- **La TCN rinde mejor sin aumento** en los 5 pliegues (diferencia de −0,062, del orden de una
  DE) y su mejor época llega más tarde (47 frente a 28).
- A la GRU el aumento sí la ayuda (5 de 5 pliegues, +0,032); en la LSTM no hay un efecto
  consistente.
- Con 233 videos (2026-10-31) el aumento no mostraba un efecto consistente en ninguna de las
  tres; el resultado cambió con el conjunto ampliado.

## Modelo estático

Configuración de producción: 21 letras (sin G, J, Ñ, S, X ni Z), 85 características, los
hiperparámetros de `model/train_static.py` y 8 variantes aumentadas por muestra de
entrenamiento. Intervalo de Wilson al 95 % para la accuracy.

| Protocolo | Modelo | n | Accuracy [IC 95 %] | Precisión macro | Recall macro | F1 macro |
|---|---|---|---|---|---|---|
| Roboflow, 5 pliegues por imagen fuente | Random Forest | 906 | 0,972 [0,960; 0,981] | 0,971 | 0,971 | 0,971 |
| | SVM-RBF | 906 | 0,975 [0,962; 0,983] | 0,975 | 0,972 | 0,973 |
| Entrena Roboflow, prueba Kaggle (personas no vistas) | Random Forest | 147 | 0,728 [0,651; 0,793] | 0,712 | 0,693 | 0,662 |
| | SVM-RBF | 147 | 0,619 [0,538; 0,694] | 0,526 | 0,586 | 0,530 |

- La accuracy del RF con personas no vistas coincide con la cifra anterior de la tesis
  (0,728); el F1 macro da 0,662 frente a 0,659. La causa probable es la versión de
  scikit-learn: con la misma semilla, otra versión arma árboles algo distintos. Solo cambiar la
  semilla del RF mueve el F1 entre 0,664 y 0,711.
- Errores frecuentes con personas no vistas: V → R, D → T, W → B, H → K.
- El modelo desplegado entrena con Roboflow + Kaggle; este protocolo mide el modelo sin Kaggle,
  la única forma de tener personas no vistas.

## Modelo exportado

`modelo_exportado/dinamico.meta.json` (copia de `ai_module/models_saved/dinamico.meta.json`):
TCN de 259 134 parámetros (1,02 MB), 14 clases (`Alergia, Dolor, G, J, Mi, Mucho, Nombre,
Presento, S, Tengo, X, Yo, Z, ninguna`), T = 30, `feature_spec_version` 2.0, reentrenada con
los 562 videos (mejor época 85 de 105, F1 de validación 0,896 sobre s08, s29 y s44).

El servidor la sirve con `MODELO_DINAMICO=exportado`. **No está desplegada**: el valor por
defecto sigue siendo `tcn` (la TCN legada de `data/models/dinamico_tcn.pt`).

- Compatibilidad con la app (`modelo_exportado/compatibilidad_app.md` y
  `prueba_rutas_sinteticas.json`): las rutas que usa la app responden con el formato esperado,
  las tres barreras de rechazo quedan activas porque el modelo tiene la clase `ninguna`, y sus
  13 señas coinciden con las de `DynamicSignMonitorScreen.js`.
- La latencia frente a la TCN legada está en `integracion/` (etapa `modelo`).

## Contenido

| Carpeta | Archivos |
|---|---|
| `dinamico/` | `selection.md`, `summary_all.csv`, `summary_all.md`, `comparacion_f1_macro_tesis.png` (figura de la tesis), `comparacion_f1_macro.png` (la genera `evaluate.py`), `commit.txt`, `entorno.json`, y por arquitectura `summary.csv`, `metrics_per_fold.csv`, `metrics_per_class.csv`, `confusion_matrix.png`, `f1_per_signer.png`, `latency.csv`, `curvas_entrenamiento.png` |
| `ablacion/` | `ablacion_sin_aumento.csv`, `comparacion_f1_macro_sin_aumento.png` y, por arquitectura, `summary.csv`, `metrics_per_fold.csv`, `confusion_matrix.png` |
| `estatico/` | `metricas.csv`, `metricas_por_clase.csv`, `metricas_por_pliegue.csv`, 4 matrices de confusión, `commit.txt`, `entorno.json` |
| `modelo_exportado/` | `dinamico.meta.json`, `prueba_rutas_sinteticas.json`, `compatibilidad_app.md` |
| `tablas/` | `comparacion_pareada.csv`, `por_clase.csv`, `por_senante.csv`, `latencia_mediana.csv`, `descartes.csv` |

## Integración con la app (`integracion/`)

Detalle e interpretación en `docs/ai/integracion_verificacion.md`.

| Archivo | Qué es | Script | Fecha y commit |
|---|---|---|---|
| `equivalencia.csv`, `equivalencia_resumen.json`, `entorno_equivalencia.json` | El servidor nuevo con `MODELO_DINAMICO=tcn` frente al de producción (`gestilingo-dev@d9f6cd4`), en 666 casos sintéticos: 662 iguales, 4 diferencias aprobadas, ninguna distinta. Solo compara la TCN legada, que no cambió | `scripts/verificar_equivalencia.py` | 2026-10-31, `3a28e44` |
| `latencia_servidor.csv`, `latencia_servidor_resumen.csv`, `entorno_latencia.json` | Latencia de `/clasificar_frames` por etapa (decodificación, detector, MediaPipe, modelo y total), 30 cuadros sintéticos, 200 mediciones por modelo, con la TCN legada (`tcn`) y la TCN nueva (`exportado`). **No incluye la red ni el teléfono**; MediaPipe sin personas es una cota inferior | `scripts/medir_latencia.py` | 2026-11-19, `9ddce9a` |

Latencia del servidor (mediana y p95 en ms, CPU con 1 hilo para PyTorch):

| Etapa | TCN legada | TCN nueva |
|---|---|---|
| Decodificación | 32,9 / 34,5 | 33,0 / 34,7 |
| Crear detector | 160,7 / 171,2 | 160,6 / 173,0 |
| MediaPipe | 492,9 / 511,2 | 491,5 / 506,6 |
| Modelo (features + red) | 5,2 / 5,6 | 4,6 / 4,9 |
| Total de la petición | 728,6 / 807,5 | 725,0 / 772,1 |

El modelo pesa menos del 1 % de la petición: MediaPipe y la creación del detector dominan. La
medición de 2026-11-19 se hizo con Python 3.11.0 en otro equipo que la del 2026-10-31, así que
los tiempos absolutos no son comparables con los anteriores. Las mediciones con cuadros reales
del teléfono están en `docs/ai/integracion_verificacion.md` §2 y no tienen archivo aquí.
