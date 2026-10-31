# Resultados de IA para el Capítulo IV

Evidencias agregadas de la comparación de arquitecturas temporales (TCN, LSTM y GRU) para las
señas dinámicas, de la ablación sin aumento de datos y de la evaluación del modelo estático.
Generadas el **2026-10-31** en la rama `feat/ia-comparacion-temporal`. Solo hay métricas,
conteos y figuras: no se incluyen videos, landmarks, predicciones por video ni particiones.

## Entorno

Python **3.12.10**, PyTorch y scikit-learn 1.9.0, en CPU (ver `dinamico/entorno.json` y
`estatico/entorno.json`). El encabezado de `ai_module/requirements.txt` todavía dice 3.11; las
versiones que valen son las registradas en `entorno.json`.

## Corridas y commits

Todas las corridas se hicieron con el árbol de git limpio; el hash queda en el `commit.txt` de
cada carpeta.

| Qué | Comando (desde `ai_module/`) | Commit |
|---|---|---|
| Comparación TCN / LSTM / GRU | `python -m training.run_all --con-estatico` | `8391f05` |
| Selección (sin exportar) | `python -m training.select_model --solo-seleccionar` | `8391f05` |
| Ablación sin aumento | `python -m training.run_all --experimento config/experimentos/ablaciones/sin_aumento.yaml` | `354c16c` |
| Modelo estático | `python -m training.eval_static_produccion` | `4794e36` |
| Exportación de la LSTM | `python -m training.select_model --arquitectura lstm` | entrenada en `4794e36`, commiteada en `09aceae` |
| Figuras | `python -m training.curvas` y `python -m training.figuras_tesis` | `354c16c` |

## Protocolo de las señas dinámicas

- **Datos:** 256 videos de 29 señantes; 233 útiles de 28 señantes (23 descartados por más de
  30 % de cuadros sin manos; **s21 quedó fuera** porque se descartaron sus 3 videos). Detalle en
  `tablas/descartes.csv`.
- **Videos útiles por clase:** G 27 · J 26 · Mi 26 · Nombre 22 · Presento 30 · S 29 · X 27 ·
  Yo 22 · Z 24 (desbalance 1,36; sin pesos de clase).
- **Validación:** `StratifiedGroupKFold(5)` agrupado por señante (ningún señante en
  entrenamiento y prueba a la vez), 3 señantes de validación por pliegue para la detención
  temprana, semillas 0, 1 y 2 (15 entrenamientos por arquitectura). Entrada `[B, 30, 1577]`
  (FeatureSpec 2.0), AdamW, hasta 150 épocas, paciencia 20 sobre el F1 macro de validación.
- **Criterio de selección (fijado antes de ver los datos):** mayor F1 macro medio; las
  arquitecturas con media ≥ mejor − DE de la mejor se consideran empatadas y gana la de menor
  latencia media.
- La clase de rechazo `ninguna` queda **fuera** del experimento.

## Resultados dinámicos

Media ± DE sobre 15 entrenamientos. Latencia: solo el modelo, CPU con 1 hilo, batch 1, 200
mediciones.

| Arquitectura | F1 macro | Accuracy | Latencia media / mediana / p95 (ms) | Parámetros | Tamaño |
|---|---|---|---|---|---|
| TCN | 0,627 ± 0,077 | 0,648 ± 0,072 | 12,81 / 11,67 / 29,51 | 258 729 | 1,01 MB |
| LSTM | 0,585 ± 0,095 | 0,606 ± 0,092 | 5,59 / 4,17 / 14,43 | 268 169 | 1,03 MB |
| GRU | 0,631 ± 0,066 | 0,642 ± 0,065 | 7,19 / 6,21 / 13,66 | 226 697 | 0,87 MB |

- Umbral de empate 0,631 − 0,066 = 0,565: las tres empatan y **se elige la LSTM** por menor
  latencia (`dinamico/selection.md`). La TCN no gana.
- Comparación pareada (`tablas/comparacion_pareada.csv`): TCN − LSTM = +0,042 (gana en 8 de 15
  entrenamientos y en 5 de 5 pliegues); GRU − LSTM = +0,046 (11 de 15; 4 de 5);
  TCN − GRU = −0,004 (7 de 15; 2 de 5). Las diferencias son menores que la variabilidad entre
  pliegues y semillas.
- La latencia es una sola medición por arquitectura y es ruidosa (la LSTM midió 5,59 ms aquí y
  1,72 ms en la ablación); las tres están muy por debajo de 33 ms (un cuadro a 30 fps).
- Por clase (`tablas/por_clase.csv`): Presento ≈ 0,96–0,98; las más difíciles son Z
  (0,25–0,40), X y S (se confunden entre sí) y Mi ↔ Yo.
- Por señante (`tablas/por_senante.csv`): **s20 (1 video) y s25 (2 videos) tienen menos de 4
  videos útiles y no se deben interpretar.**
- Curvas (`dinamico/<arquitectura>/curvas_entrenamiento.png`): la pérdida de validación sube
  desde la época 15–25 mientras el F1 se mantiene (sobreconfianza con señantes nuevos).

## Ablación sin aumento de datos

`ablacion/ablacion_sin_aumento.csv`. Se reporta como ablación; no cambia el modelo elegido.

| Arquitectura | F1 macro con aumento | F1 macro sin aumento | Diferencia (con − sin) | Con aumento gana |
|---|---|---|---|---|
| TCN | 0,627 ± 0,077 | 0,656 ± 0,072 | −0,029 ± 0,070 | 4 de 15 entrenamientos; 2 de 5 pliegues |
| LSTM | 0,585 ± 0,095 | 0,565 ± 0,064 | +0,020 ± 0,081 | 7 de 15; 3 de 5 |
| GRU | 0,631 ± 0,066 | 0,607 ± 0,062 | +0,024 ± 0,075 | 8 de 15; 4 de 5 |

Ninguna diferencia supera la variabilidad; el aumento no muestra un efecto consistente.

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

`modelo_exportado/dinamico.meta.json`: LSTM, clases `G, J, Mi, Nombre, Presento, S, X, Yo, Z`,
T = 30, `feature_spec_version` 2.0, manos en marco local, reentrenada con los 233 videos (mejor
época 34, F1 de validación 0,821 sobre s03, s19 y s22).

Latencia frente al TCN anterior (`data/models/dinamico_tcn.pt` de `gestilingo-dev`, 10 clases,
T = 60, 527 valores), medidos igual: CPU con 1 hilo, 20 de calentamiento y 200 mediciones
(`modelo_exportado/latencia_exportado_vs_tcn.csv`).

| Modelo | Medida | Media (ms) | Mediana (ms) | p95 (ms) |
|---|---|---|---|---|
| LSTM exportada | solo el modelo | 1,87 | 2,04 | 2,73 |
| | preprocesamiento + modelo | 3,57 | 3,57 | 5,14 |
| TCN anterior | solo el modelo | 7,16 | 6,91 | 9,38 |
| | preprocesamiento + modelo | 7,59 | 7,52 | 10,33 |

La medición «preprocesamiento + modelo» parte de 45 vectores sintéticos de 527 valores ya
extraídos: **no incluye la extracción con MediaPipe ni la red**, que dominan la latencia que
percibe la app.

El servidor de esta rama todavía **no es compatible** con la app (falta `/clasificar_frames`,
no hay barreras de rechazo y trae el modelo estático antiguo): ver
`modelo_exportado/compatibilidad_app.md`. Lo desplegado sigue usando el TCN anterior.

## Contenido

| Carpeta | Archivos |
|---|---|
| `dinamico/` | `selection.md`, `comparacion_f1_macro_tesis.png` (figura de la tesis), `comparacion_f1_macro.png` (la genera `evaluate.py`), `commit.txt`, `entorno.json`, y por arquitectura `summary.csv`, `metrics_per_fold.csv`, `metrics_per_class.csv`, `confusion_matrix.png`, `f1_per_signer.png`, `latency.csv`, `curvas_entrenamiento.png` |
| `ablacion/` | `ablacion_sin_aumento.csv`, `comparacion_f1_macro_sin_aumento.png` y, por arquitectura, `summary.csv`, `metrics_per_fold.csv`, `confusion_matrix.png` |
| `estatico/` | `metricas.csv`, `metricas_por_clase.csv`, `metricas_por_pliegue.csv`, 4 matrices de confusión, `commit.txt`, `entorno.json` |
| `modelo_exportado/` | `dinamico.meta.json`, `latencia_exportado_vs_tcn.csv`, `prueba_rutas_sinteticas.json`, `compatibilidad_app.md` |
| `tablas/` | `comparacion_pareada.csv`, `por_clase.csv`, `por_senante.csv`, `latencia_mediana.csv`, `descartes.csv` |

## Integración con la app (`integracion/`)

Generado el 2026-10-31 en la rama `feat/integracion-pipeline`, que une este pipeline con
`gestilingo-dev`. Detalle e interpretación en `docs/ai/integracion_verificacion.md`.

| Archivo | Qué es | Script | Commit |
|---|---|---|---|
| `equivalencia.csv`, `equivalencia_resumen.json`, `entorno_equivalencia.json` | El servidor nuevo con `MODELO_DINAMICO=tcn` frente al de producción (`gestilingo-dev@d9f6cd4`), en 666 casos sintéticos: 662 iguales, 4 diferencias aprobadas, ninguna distinta | `scripts/verificar_equivalencia.py` | `3a28e44` |
| `latencia_servidor.csv`, `latencia_servidor_resumen.csv`, `entorno_latencia.json` | Latencia de `/clasificar_frames` por etapa (decodificación, detector, MediaPipe, modelo y total), 30 cuadros sintéticos, 200 mediciones por modelo. **No incluye la red ni el teléfono**; MediaPipe sin personas es una cota inferior | `scripts/medir_latencia.py` | `832ca2b` |

Python 3.11.15, `requirements-server.txt` de `3a28e44` (mediapipe 0.10.35, scikit-learn 1.9.0,
torch 2.14.0 CPU). Las mediciones con cuadros reales del teléfono están en
`docs/ai/integracion_verificacion.md` §2 y no tienen archivo aquí: el registro se borró después
de pasarlo al documento.
