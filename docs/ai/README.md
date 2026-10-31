# Módulo de IA: comparación de arquitecturas temporales

Pipeline reproducible para comparar **TCN, LSTM y GRU** en la clasificación de señas dinámicas de
LSCh, con evaluación **independiente del señante**, y para incorporar nuevos lotes de grabaciones.
Los resultados alimentan el Capítulo IV de la tesis.

Todos los comandos se ejecutan desde `ai_module/`:

```bash
cd ai_module
pip install -r requirements.txt
```

## Estructura

```
ai_module/
├── config/
│   ├── datos/               classes.yaml (tipo de cada clase), manifest.yaml
│   ├── preprocesamiento/    features.yaml (FeatureSpec), aumento.yaml
│   ├── modelos/             tcn.yaml, lstm.yaml, gru.yaml
│   ├── experimentos/        comparacion_temporal.yaml, estatico_rf.yaml, ablaciones/
│   └── dataset_config.yaml  (pipeline legado: scripts/)
├── common/                  rutas, carga de YAML (con herencia), semillas y entorno
├── data/manifest.py         manifiesto de videos → data/manifest.csv
├── preprocessing/           extracción, normalización, remuestreo, features, aumento
├── models/                  base, tcn, lstm, gru, factory (registro), checkpoint
├── training/                datos, cv, train, evaluate, run_all, select_model,
│                            add_batch, eval_static
├── tests/                   pytest + generador de datos sintéticos
├── results/                 una carpeta por corrida + summary_all.{csv,md}
└── models_saved/            estatico.pkl, dinamico.pt, dinamico.meta.json
```

| Patrón | Dónde | Para qué |
|---|---|---|
| Facade | `preprocessing/pipeline.py` (`Preprocesador`) | Una sola entrada al preprocesamiento para entrenamiento y servidor. |
| Registry + Factory | `models/factory.py` | El YAML elige la arquitectura; una nueva no toca el entrenamiento ni el servidor. |
| Repository | `training/datos.py` | El entrenamiento no sabe dónde ni cómo están guardados los landmarks. |
| Configuración declarativa | `config/**` con `hereda:` | Todo parámetro experimental fuera del código; las ablaciones declaran solo lo que cambian. |

## 1. Generar el manifiesto

Coloca los videos en `data/raw_videos/<clase>/` (`.mp4` o `.mov`). El `signer_id` se deduce, en este
orden, de `data/signers.csv`, de una carpeta intermedia (`data/raw_videos/<clase>/<signer>/video.mov`)
o del nombre `<clase>_<signer>_<n>.mov`.

```bash
python -m data.manifest
```

- Si algún video no tiene `signer_id` deducible, se escribe `data/signers_template.csv` y el comando
  se detiene sin extraer nada. Complétala (`signer_id`, y opcionalmente `session_id` y `device`) y
  guárdala como `data/signers.csv`.
- Extrae los landmarks crudos de cada video a `data/processed_landmarks/<clase>/<video>.npz`
  (solo la primera vez; `--overwrite` fuerza la reextracción).
- Descarta los videos con más de 30 % de frames sin manos (`config/datos/manifest.yaml`) y las clases
  que no están en `config/datos/classes.yaml`.
- Imprime las muestras útiles por clase y por señante.

Para ver las particiones sin entrenar (y verificar que no hay filtración de señantes):

```bash
python -m training.cv            # StratifiedGroupKFold(5)
python -m training.cv --loso     # Leave-One-Signer-Out
```

## 2. Entrenar y evaluar

Las tres arquitecturas, con el mismo protocolo y las mismas particiones, más `results/summary_all.md`:

```bash
python -m training.run_all
python -m training.run_all --loso           # Leave-One-Signer-Out
python -m training.run_all --con-estatico   # agrega el Random Forest estático
```

Una sola arquitectura:

```bash
python -m training.train --arquitectura tcn
python -m training.train --arquitectura lstm
python -m training.train --arquitectura gru
```

Protocolo (`config/experimentos/comparacion_temporal.yaml`): 5 pliegues agrupados por señante, 3
señantes de validación por pliegue para la detención temprana, semillas 0, 1 y 2, AdamW, hasta
150 épocas, paciencia 20 sobre el F1 macro de validación, pesos por clase si hay desbalance y aumento
de datos solo en entrenamiento.

Salidas de cada corrida, en `results/<fecha>_<arquitectura>/`:

| Archivo | Contenido |
|---|---|
| `config.yaml` | Configuración resuelta, exactamente la que se usó |
| `commit.txt` | Hash de git (`-dirty` si había código sin commitear) |
| `entorno.json` | Versiones de Python, PyTorch, scikit-learn, MediaPipe, OpenCV, NumPy, FastAPI y CPU |
| `particiones.json` | Señantes y videos de cada partición de cada pliegue |
| `metrics_per_fold.csv` | Accuracy, precisión, recall y F1 (macro y por clase) por pliegue y semilla |
| `metrics_per_class.csv`, `metrics_per_signer.csv` | Detalle por clase y por señante |
| `summary.csv` | Media ± desviación estándar de cada métrica |
| `confusion_matrix.png` / `.csv` | Matriz agregada sobre pliegues y semillas |
| `f1_per_signer.png` | F1 macro por señante |
| `latency.csv` | CPU, batch 1, T frames: 20 de calentamiento, 200 mediciones, media y p95 (ms), tamaño (MB) |
| `predicciones.csv`, `historial.csv` | Predicción por video y curvas de entrenamiento |

`results/summary_all.md` reúne la última corrida de cada arquitectura en tablas listas para la tesis,
con la figura `comparacion_f1_macro.png`. Las figuras van a 300 dpi con textos en español.

### Ablaciones

```bash
python -m training.run_all --experimento config/experimentos/ablaciones/solo_posicion.yaml
python -m training.run_all --experimento config/experimentos/ablaciones/posicion_velocidad.yaml
python -m training.run_all --experimento config/experimentos/ablaciones/manos_corporal.yaml
python -m training.run_all --experimento config/experimentos/ablaciones/causal.yaml
python -m training.run_all --experimento config/experimentos/ablaciones/sin_aumento.yaml
```

Cada ablación aparece como una sección aparte en `summary_all.md`.

### Señas estáticas

```bash
python -m training.eval_static
```

Evalúa el Random Forest de `model/train_static.py` (sin cambiar su lógica) con
`StratifiedGroupKFold(5)` agrupado por **imagen fuente**: el dataset de Roboflow no identifica a los
señantes, y sus copias aumentadas de una misma foto quedaban repartidas entre entrenamiento y prueba.

## 3. Comparar y seleccionar

```bash
python -m training.select_model --solo-seleccionar
```

Escribe `results/selection.md`: gana la arquitectura con mayor F1 macro medio; si otras quedan dentro
de una desviación estándar de ella, se elige la de menor latencia.

## 4. Exportar

```bash
python -m training.select_model                    # selecciona y exporta
python -m training.select_model --arquitectura gru # fuerza una arquitectura
```

Reentrena la elegida con todos los videos (3 señantes reservados para la detención temprana) y escribe
`models_saved/dinamico.pt` y `models_saved/dinamico.meta.json` (arquitectura, hiperparámetros, clases
en orden, T, `feature_spec_version` y parámetros de normalización). El modelo anterior se respalda en
`models_saved/historial/`.

`server.py` lee la arquitectura desde el meta y usa el mismo `preprocessing/`. Los endpoints no
cambian:

| Endpoint | Entrada | Salida |
|---|---|---|
| `POST /clasificar_video` | `{video_base64, mime}` | `{seña, confianza, frames_procesados, ratio_con_mano}` |
| `POST /clasificar_secuencia` | `{frames: (N, 527), fps}` en formato 1.0 | `{seña, confianza}` |

Si no existe `models_saved/dinamico.pt`, el servidor usa el TCN legado de
`data/models/dinamico_tcn.pt`. Un modelo exportado con `marco_manos: corporal` no puede derivar sus
features de los vectores de 527 valores, así que `/clasificar_secuencia` responde 422;
`/clasificar_video` funciona siempre.

## 5. Agregar un lote

```bash
# copia los videos nuevos a data/raw_videos/<clase>/ y luego:
python -m training.add_batch --batch-id lote_01
```

1. Extrae los landmarks nuevos y los agrega al manifiesto con `batch_id = lote_01`.
2. Evalúa la arquitectura del modelo actual con la misma validación agrupada sobre todo el dataset
   acumulado. Cada pliegue entrena **desde cero**: el modelo anterior ya vio a los señantes antiguos,
   y partir de sus pesos filtraría los señantes de prueba.
3. Reentrena el modelo final con todo el dataset partiendo de los pesos anteriores (warm start). Si
   cambian las clases, solo se reinicializa la capa de salida.
4. Escribe `results/batches/lote_01.md` con el F1 por clase antes y después, destacando las clases que
   más cambiaron.

## Pruebas

```bash
python -m pytest            # todo (unos 15 s)
python -m pytest -m "not lento"
```

Cubren: forma de las salidas de los tres modelos, largo tras el remuestreo, ausencia de filtración de
señantes entre particiones, determinismo con semilla fija, equivalencia con el vector legado de 527
valores, el manifiesto y los endpoints de `server.py`.

`tests/sintetico.py` genera un dataset sintético con la misma estructura que el real, útil para probar
el pipeline completo sin videos:

```bash
python -m tests.sintetico --salida /tmp/sintetico --clases 4 --signers 25
```

## Especificación de features

Ver [`feature_spec.md`](feature_spec.md), generado con `python -m preprocessing.spec --doc`.

## Propuesta para Supabase

[`manifest_table.sql`](manifest_table.sql) propone extender `dynamic_sign_captures` con las columnas
del manifiesto. **No se ha aplicado.**
