# Pendientes para integrar el pipeline nuevo con la app

Esta rama (`feat/ia-comparacion-temporal`) **no se puede unir todavía con `gestilingo-dev` ni
desplegarse**: rompería el reconocimiento de la app. Revisado el 2026-10-31 contra
`src/features/camera/presentation/signCamera.js` y `ai_module/server.py` de `gestilingo-dev`.

| Ruta que usa la app | Estado en esta rama |
|---|---|
| `POST /clasificar` | Mismo formato, pero sirve el `estatico.pkl` antiguo (26 letras). |
| `POST /clasificar_frames` | No existe: la app recibe 404 y queda solo la heurística de trayectoria (J/Z). |
| `POST /clasificar_video` | Mismo formato de entrada; la respuesta no trae `es_seña`, `motivo` ni `alternativas`. |

## Tareas, en orden

1. **Portar `/clasificar_frames`.** Recibe `{frames, fps}`, donde `frames` son cuadros JPEG en
   base64 (con o sin prefijo `data:image/jpeg;base64,`, hasta 120) que manda el visor
   (`handTrackingHtml.js`). Decodificarlos, pasarlos por MediaPipe con los parámetros de
   extracción del modelo (`ClasificadorDinamico.cfg_extraccion`) y armar una
   `SecuenciaCruda` para `Preprocesador.desde_cruda`. No reutilizar `scripts/holistic_pipeline`
   (formato 1.0): el modelo exportado espera FeatureSpec 2.0.

2. **Portar las barreras de rechazo y el formato de respuesta.**
   - `sin_mano`: fracción de cuadros con mano < 0,3.
   - `poco_movimiento`: desplazamiento de la muñeca más activa en el marco de hombros < 0,08
     (solo si hay pose en al menos la mitad de los cuadros). Calcularlo desde la
     `SecuenciaCruda`, no desde la matriz de 527 valores.
   - `modelo_sin_seña`: el modelo responde la clase de rechazo (ver tarea 4).
   - Devolver `es_seña`, `motivo` y `alternativas` (las 2 siguientes con su confianza) en
     `/clasificar_frames` y `/clasificar_video`. Para eso, agregar a `ClasificadorDinamico` un
     método que devuelva el ranking completo de probabilidades.

3. **Conservar el `estatico.pkl` de 21 letras** de `gestilingo-dev` (sin G, J, Ñ, S, X ni Z,
   entrenado con Roboflow + Kaggle). Al unir, resolver el conflicto del binario a favor de esa
   rama, y también el de `model/train_static.py` (esta rama extrajo `construir_pipeline`;
   `gestilingo-dev` agregó `LETRAS_CON_MOVIMIENTO`, varios directorios y `--aug 8`).

4. **Agregar la clase `ninguna` con negativos reales.** Grabar videos de personas que no hacen
   una seña dinámica (mano quieta, acomodarse, deletrear con el alfabeto estático), con
   consentimiento de cada señante y su `signer_id` en el manifiesto, para que
   `StratifiedGroupKFold` no reparta a una misma persona entre pliegues. Evaluar el modelo con
   el mismo protocolo que la comparación y **reportarlo aparte**: no es el modelo comparado en
   el Capítulo IV. Los negativos sintéticos de `scripts/generar_negativos.py` (formato 1.0, sin
   señante) no sirven para esta validación.

5. **Recalibrar umbrales con señas reales.**
   - El umbral dinámico de la app (`UMBRAL_DINAMICO = 0.6` en `signCamera.js`) y la barrera de
     movimiento (0,08) se fijaron con el TCN anterior.
   - Las curvas de entrenamiento muestran sobreconfianza: la pérdida de validación sube desde
     la época 15–25 mientras el F1 se mantiene. Evaluar *temperature scaling* sobre los
     pliegues de validación (ECE antes y después) antes de fijar el umbral.

6. **Normalizar los separadores al leer `data/signers.csv`.** `cargar_signers()` usa
   `video_path` tal cual como clave; si el CSV se escribe a mano en Windows con `\`, la fila
   no calza con la clave del manifiesto (siempre con `/`) y el señante se toma en silencio del
   nombre del archivo. Normalizar con `replace("\\", "/")` y agregar su test. En un commit aparte.

7. **Recuperar los videos descartados recortando los tramos sin mano.** Los videos de iPhone
   (s01–s05) se descartan mucho más (27,5 % frente a 4,4 %), pero la causa no es técnica: los
   archivos están en H.264 a 30 fps constantes, sin rotación en los metadatos (se recodificaron
   al compartirse), y rotar los cuadros no cambia la detección. La causa es el contenido:
   - la mayoría de los clips trae un tramo largo al inicio o al final con la mano fuera del
     cuadro, y el criterio (más de 30 % de cuadros sin manos) cuenta el clip completo;
   - en Mi y Yo, la mano que apunta al propio pecho se pierde a mitad de la seña.

   Recortar los tramos sin mano del inicio y del final antes de aplicar el criterio
   recuperaría 14 de los 23 descartes (8 de 14 de iPhone), según los landmarks ya extraídos.
   Cambia el dataset y el protocolo: hay que volver a correr la comparación y reportarla
   aparte. Los descartes por pérdida a mitad de la seña requieren regrabar.

## Antes de desplegar

- Probar las tres rutas con la app real contra un servidor local.
- No desplegar en Hugging Face hasta cerrar las tareas 1 a 3.
