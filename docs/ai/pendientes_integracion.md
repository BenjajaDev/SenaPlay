# Pendientes para integrar el pipeline nuevo con la app

Actualizado el 2026-10-31 en `feat/integracion-pipeline`, que une `feat/ia-comparacion-temporal`
con `gestilingo-dev`. Diseño en [`integracion_diseno.md`](integracion_diseno.md); verificación
(equivalencia y prueba con la app) en [`integracion_verificacion.md`](integracion_verificacion.md).

| Ruta que usa la app | Estado en `feat/integracion-pipeline` |
|---|---|
| `POST /clasificar` | `estatico.pkl` de 21 letras (prueba: `tests/test_estatico.py`). Forma inválida → 422. |
| `POST /clasificar_frames` | Portada sobre `preprocessing.extraction`, con barreras y `es_seña`, `motivo` y `alternativas`. |
| `POST /clasificar_video` | Igual que `/clasificar_frames`, sin `ffprobe` y con tope de 300 cuadros (413). |

Con `MODELO_DINAMICO=tcn` (por defecto), el servidor responde igual que `gestilingo-dev@d9f6cd4`:
662 de 666 casos sintéticos son iguales, 4 muestran las diferencias aprobadas y ninguno difiere.

## Tareas

### Cerradas

1. ~~**Portar `/clasificar_frames`.**~~ Hecho en `145d100`: decodifica los JPEG, pasa por
   MediaPipe con el `cfg_extraccion` del modelo activo y arma la `SecuenciaCruda`, sin
   `scripts/holistic_pipeline`.

2. ~~**Portar las barreras de rechazo y el formato de respuesta.**~~ Hecho en `f51d2c5` y
   `c5e9710`: `inferencia/barreras.py` calcula `sin_mano`, `poco_movimiento` y
   `modelo_sin_seña` sobre la `SecuenciaCruda`. `modelo_sin_seña` solo existe si el modelo tiene
   clase de rechazo. Las dos rutas dinámicas devuelven `es_seña`, `motivo` y `alternativas`.

3. ~~**Conservar el `estatico.pkl` de 21 letras.**~~ El merge (`ffe319c`) lo conservó sin
   conflicto, y `train_static.py` quedó con `construir_pipeline` más lo de `gestilingo-dev`.
   `tests/test_estatico.py` verifica las 21 clases, sin G, J, Ñ, S, X ni Z.

6. ~~**Normalizar los separadores al leer `data/signers.csv`.**~~ Hecho en `2fa17ed`, con su
   prueba.

### Abiertas: condición para usar `MODELO_DINAMICO=lstm` en producción

La prueba con la app (`integracion_verificacion.md` §2.5) lo confirma: sin clase de rechazo, la
LSTM aceptó **7 de 7 tramos sin seña en vivo** (mano quieta y cambio de letra) y **2 de 2 clips**
con la mano a la vista, con confianzas de 0,73 a 0,97. La TCN los rechazó todos. Hasta cerrar
las tareas 4 y 5, `lstm` es solo para pruebas locales.

4. **Agregar la clase `ninguna` con negativos reales.** Grabar videos de personas que no hacen
   una seña dinámica (mano quieta, acomodarse, deletrear con el alfabeto estático), con
   consentimiento de cada señante y su `signer_id` en el manifiesto, para que
   `StratifiedGroupKFold` no reparta a una misma persona entre pliegues. Evaluar el modelo con
   el mismo protocolo que la comparación y **reportarlo aparte**: no es el modelo comparado en
   el Capítulo IV. Los negativos sintéticos de `scripts/generar_negativos.py` (formato 1.0, sin
   señante) no sirven para esta validación.

5. **Recalibrar umbrales con señas reales.**
   - El umbral dinámico de la app (`UMBRAL_DINAMICO = 0.6` en `signCamera.js`) y la barrera de
     movimiento (0,08) se fijaron con el TCN anterior. En la prueba con la app,
     `poco_movimiento` no se activó nunca: el movimiento más bajo de un caso sin seña fue 0,167.
   - Las curvas de entrenamiento muestran sobreconfianza: la pérdida de validación sube desde
     la época 15–25 mientras el F1 se mantiene. Evaluar *temperature scaling* sobre los
     pliegues de validación (ECE antes y después) antes de fijar el umbral.

### Abierta, fuera de este trabajo

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

   Relacionado: los clips de la pantalla «Señas dinámicas» tampoco se recortan. Ahí la TCN
   respondió Z en 6 de 8 errores (§2.2 de la verificación).

## Pendientes menores

- **`n_jobs=-1` del Random Forest estático.** `predict_proba` suma los árboles en paralelo en un
  orden que varía, así que la probabilidad cambia en el último bit. Si cae en el borde del
  redondeo a 4 decimales, la confianza informada difiere en 1e-4 entre corridas: pasó en 2 o 3 de
  200 casos en cada corrida de la equivalencia. También ocurre en producción. Con `n_jobs=1` es
  determinista. Decidir si el servidor lo fija al cargar el modelo; no hay que reentrenar.
- **La fórmula `1 − ratio_sin_manos()` de la rama de entrenamiento.**
  - En el servidor ya no se usa: `inferencia/barreras.py` calcula `con_mano / L`. Con
    `1 − (1 − x)`, el ratio informado redondeaba distinto en 10 casos con L ≤ 120.
  - Sigue en `data/manifest.py:159`, que descarta un clip si `ratio_sin_manos() > 0,30`. Con
    **exactamente** 30 % de cuadros sin manos, `1 − 0,7` da 0,30000000000000004 y el clip se
    descarta, aunque el criterio dice «más de 30 %». Pasa en los 30 largos posibles hasta 300
    cuadros (L = 10, 20, …, 300). No se revisó si afectó a algún video real: hay que contarlo en
    `manifest.csv`. Corregirlo cambia el dataset, igual que la tarea 7.

## Hallazgos de la prueba con la app

No son de esta integración: también ocurren con el servidor de producción.

- **Clips de 3 o 4 cuadros en «Señas dinámicas».** 5 de 32 clips de hasta 4 s se procesaron con
  3 o 4 cuadros. Hipótesis sin verificar: el webm de MediaRecorder no trae la tasa de cuadros,
  OpenCV informa un valor alto y `paso = round(fps_fuente / fps_muestreo)` salta casi todos los
  cuadros. Para comprobarlo hace falta un clip de prueba sin personas grabado en el WebView.
- **Confusión G/J con confianza alta.** En vivo, el primer tramo de J dio G con 0,95 y la app lo
  mostró. Ni las barreras ni el umbral detienen un error del modelo entre dos señas reales.
- **Versiones.** El Space corría mediapipe 1.0.1 y scikit-learn 1.9.1, distintos de los de
  extracción y guardado de los modelos. `3a28e44` los fija en 0.10.35 y 1.9.0; el próximo
  despliegue los cambia en producción.

## Antes de desplegar

- [x] Probar las tres rutas con la app real contra un servidor local (`integracion_verificacion.md` §2).
- [x] Cerrar las tareas 1 a 3.
- [ ] Revisar y unir `feat/integracion-pipeline` a `gestilingo-dev` y a `main` (el Space se
      publica desde `main`). Desplegar con `MODELO_DINAMICO=tcn`, que es el valor por defecto.
