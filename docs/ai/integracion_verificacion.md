# Integración del pipeline nuevo: verificación

Rama `feat/integracion-pipeline`. Diseño en [`integracion_diseno.md`](integracion_diseno.md).

## 1. Equivalencia con `gestilingo-dev` (fase 2)

**Pregunta:** con `MODELO_DINAMICO=tcn`, ¿el servidor nuevo responde lo mismo que el de
producción?

**Resultado:** sí. **Aprobada:** 662 de 666 casos son iguales, 4 muestran las diferencias
aprobadas en el diseño y ninguno difiere.

| | |
|---|---|
| Referencia | `gestilingo-dev@d9f6cd4` (`ai_module/` extraído con `git archive`) |
| Candidato | `feat/integracion-pipeline@3a28e44`, árbol limpio |
| Script | `ai_module/scripts/verificar_equivalencia.py` (commit `de54114`) |
| Entorno | el mismo `ai_module/.venv` para los dos árboles: Python 3.11.15, `requirements-server.txt` de `3a28e44` (mediapipe 0.10.35, scikit-learn 1.9.0, numpy 2.3.5, torch 2.14.0 CPU, opencv-contrib 5.0.0.93). `pip freeze` en `entorno_equivalencia.json` |

**Corridas.** La primera (`43cf91e`, mediapipe 1.0.1 y scikit-learn 1.9.1) y la vigente
(`3a28e44`, con las versiones fijadas a las de los modelos) dieron el mismo resultado. Como los
dos árboles corren siempre con el mismo entorno, esta prueba compara **código**: no mide qué
cambia en la TCN de producción al pasar de mediapipe 1.0.1 a 0.10.35. Eso solo se ve con
personas reales, en la prueba con la app (§2), porque las imágenes sintéticas de D no tienen
manos.
| Datos | sintéticos, con semillas fijas; ninguna persona |
| Salidas | [`docs/tesis/resultados_ia/integracion/`](../tesis/resultados_ia/integracion/): `equivalencia.csv`, `equivalencia_resumen.json` y `entorno_equivalencia.json` |

| Categoría | Ruta | Casos | Resultado |
|---|---|---|---|
| A | `/clasificar_secuencia`, 527 valores, N de 8 a 120 | 200 | 200 iguales |
| B | `/clasificar_frames`, detección sintética | 190 | 190 iguales |
| C | `/clasificar_video`, MP4 decodificado de verdad (30 y 60 fps) | 57 | 57 iguales |
| D | `/clasificar_frames` y `/clasificar_video` con MediaPipe real, sin personas | 8 | 8 iguales (`sin_mano`) |
| E | `/clasificar`, 200 manos | 200 | 200 iguales |
| F | entradas inválidas | 11 | 7 iguales y 4 diferencias esperadas |

**Cobertura de las barreras.** En B y C, la referencia respondió `modelo_sin_seña` 114 veces,
`poco_movimiento` 32, `sin_mano` 28 y sin motivo 73. El candidato coincidió en todas.

**Borde de `sin_mano` (L = 80).** Con 1, 3, 7, 21 y 23 cuadros con mano, ambos servidores dan
`sin_mano` con el mismo ratio (0,013, 0,037, 0,087, 0,263 y 0,287). Con 24 cuadros (0,300),
25 (0,312) y 40 (0,500), ninguno da ese motivo. Con 7 y 21 cuadros, `1 − ratio_sin_manos()`
habría informado 0,088 y 0,262; por eso el servidor calcula `con_mano / L`.

**`ffprobe`.** El candidato no lo ejecutó ninguna vez en las 60 peticiones a
`/clasificar_video`.

**Diferencias de confianza.** El máximo es 1e-4 y se da solo en casos de E (`/clasificar`):
3 en la corrida vigente (E_102, E_146 y E_149) y 2 en la primera (E_127 y E_139).
No las produce la integración: el Random Forest del estático predice con `n_jobs=-1` y suma
las probabilidades de los árboles en paralelo, en un orden que cambia entre corridas. En esos
casos la probabilidad cae justo en el borde del redondeo a 4 decimales; en E_102, por
ejemplo, es exactamente 0,42525. Según el orden de la suma queda en 0,42524999… o en
0,4252500…01. Prueba local: con `n_jobs=-1` salen 3 valores distintos en 200 repeticiones, y con
`n_jobs=1`, uno solo. Pasa igual en producción, y lo confirma que cada corrida afecta casos
distintos. En las rutas
dinámicas (A a D), la diferencia de confianza fue 0 en todos los casos.

**Diferencias esperadas** (§1.3 del diseño, solo con entradas que la app no manda):

| Caso | Referencia | Candidato |
|---|---|---|
| `/clasificar_frames` con cuadros PNG | 200 | 422 |
| `/clasificar_secuencia` con ancho 10 | 500 | 422 |
| `/clasificar_secuencia` vacía | 200 | 422 |
| `/clasificar` con 20×3 | 500 | 422 |

Reproducir:

```bash
git archive d9f6cd4 ai_module | tar -x -C <dir_ref>
cd ai_module
.venv/Scripts/python.exe -m scripts.verificar_equivalencia --referencia <dir_ref>/ai_module
```

## 2. Prueba con la app (fase 3)

Servidor local en `feat/integracion-pipeline@f2d8b86`, lanzado con
`scripts/prueba_en_vivo.py` (`.venv`, versiones de `3a28e44`). La app corre en el dev client
contra `http://192.168.1.12:8000`. Una persona hace las señas y marca cada caso con
`scripts/marcar.py`. El registro solo guardó las respuestas del servidor (nunca cuadros ni
videos) y se borró después de pasar los datos aquí.

Las duraciones se miden en el servidor. La etapa «MediaPipe» incluye crear el detector, uno por
petición. Durante la prueba, la PC corría además Metro y el editor.

**Corrección de medición (commit `066df52`).** En §2.1 y §2.2, el «Total» empieza a contar al
llegar los encabezados de la petición, así que **incluye la subida del cuerpo por Wi-Fi**, que
queda dentro de «Resto». Las columnas «Decodif.», «MediaPipe» y «Modelo» sí son tiempo de
servidor puro: se miden dentro del endpoint, con el cuerpo ya recibido. Desde ese commit,
`duracion_ms` empieza a contar al llegar el último trozo del cuerpo, y la subida va aparte, en
`recepcion_cuerpo_ms` (§2.3 en adelante).

### 2.1 Modo `tcn` · Traducción en vivo (`/clasificar_frames`), 2026-10-31

| Caso | Pet. | Seña | Confianza | es_seña | Motivo | Ratio mano | Movimiento | Total ms | Decodif. | MediaPipe | Modelo | Resto | La app mostró |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Nombre | 1 | ninguna | 0,7261 | no | modelo_sin_seña | 0,957 | 0,946 | 5693,8 | 374,4 | 4649,0 | 242,7 | 427,7 | Nombre |
| | 2 | Nombre | 0,9996 | sí | — | 0,909 | 0,957 | 1233,8 | 21,8 | 993,8 | 12,3 | 205,8 | |
| Presento | 1 | Presento | 0,8328 | sí | — | 0,750 | 1,766 | 1649,9 | 24,4 | 1417,3 | 23,2 | 185,0 | Presento |
| J | 1 | G | 0,9492 | sí | — | 0,913 | 0,804 | 4594,7 | 175,0 | 4182,0 | 25,2 | 212,4 | G y luego J |
| | 2 | J | 0,7865 | sí | — | 1,000 | 0,888 | 2662,5 | 47,0 | 2333,6 | 26,8 | 255,0 | |
| Mano quieta | 1 | J | 0,9481 | no | sin_mano | 0,088 | 1,648 | 3090,0 | 45,5 | 2773,2 | 35,1 | 236,1 | «No estoy seguro» |
| | 2 | X | 0,9943 | no | sin_mano | 0,000 | 0,956 | 5944,3 | 79,4 | 5532,0 | 57,0 | 275,9 | |
| Cambio de letra (A → B) | 1 | ninguna | 0,9986 | no | modelo_sin_seña | 1,000 | 0,889 | 4061,0 | 116,5 | 3561,5 | 150,7 | 232,3 | A → B (modelo estático) |
| Acomodarse en la silla | 0 | — | — | — | — | — | — | — | — | — | — | — | «No estoy seguro» |
| Salir del cuadro | 1 | ninguna | 1,0000 | no | modelo_sin_seña | 0,929 | 0,269 | 1061,3 | 18,8 | 783,1 | 52,4 | 206,9 | «No estoy seguro» |

Observaciones:

- **Las 3 señas dinámicas se reconocieron.** En Nombre, el primer tramo lo rechazó la clase
  «ninguna» (0,73) y el segundo dio Nombre (0,9996).
- **En J, la app mostró primero una G** (confirmado por quien hizo la seña). El primer tramo dio
  G con 0,95 y pasó las barreras; el segundo, unos 10 s después, dio J con 0,79. Es un **falso
  positivo del modelo dinámico con una seña real**, no con un movimiento sin seña: la confusión
  G/J que ya se conocía. Ni las barreras ni `UMBRAL_DINAMICO = 0.6` lo detienen, porque la
  confianza es alta.
- **Ningún caso sin seña produjo una seña aceptada.** En mano quieta, el visor mandó 2 tramos,
  pero el servidor casi no detectó la mano (ratio 0,088 y 0,0) y los rechazó por `sin_mano`. El
  cambio de letra y salir del cuadro los rechazó `modelo_sin_seña`. Al acomodarse, el visor no
  mandó ningún tramo.
- **`poco_movimiento` no se activó en ningún caso:** el menor desplazamiento de muñeca fue 0,269,
  frente al umbral de 0,08.
- **MediaPipe se llevó entre el 74 % y el 93 % del tiempo total** de cada tramo (de 14 a 35
  cuadros).

### 2.2 Modo `tcn` · Señas dinámicas (beta) (`/clasificar_video`), 2026-10-31

Son clips de hasta 4 s grabados con el botón de la pantalla. Esta pantalla muestra la respuesta
tal cual, sin aplicar `es_seña` ni `UMBRAL_DINAMICO`; por eso «La app mostró» es la seña de cada
respuesta. Los marcadores dicen «en vivo» por error de rotulado, pero todas estas peticiones
llegaron a `/clasificar_video`.

| Caso | Clip | Seña | Confianza | es_seña | Motivo | Cuadros | Ratio mano | Movimiento | Total ms* | Decodif. | MediaPipe | Modelo | La app mostró |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Nombre | 1 | Nombre | 0,5007 | sí | — | 78 | 0,346 | 1,270 | 11588,2 | 1260,1 | 9099,5 | 239,9 | Nombre (empate con Yo 0,499) |
| | 2 | Yo | 0,9995 | sí | — | 72 | 0,444 | 1,112 | 5542,0 | 243,9 | 4544,1 | 31,4 | Yo |
| | 3 | Yo | 0,9835 | sí | — | 77 | 0,377 | 0,940 | 5167,2 | 167,6 | 3240,3 | 22,0 | Yo |
| | 4 | Nombre | 0,9996 | sí | — | 76 | 0,632 | 1,130 | 5710,3 | 209,3 | 4812,7 | 16,7 | Nombre |
| Presento | 1 | Z | 0,9996 | sí | — | 77 | 0,506 | 1,051 | 7933,1 | 626,9 | 6177,9 | 381,2 | Z |
| | 2 | Z | 0,9747 | sí | — | 78 | 0,744 | 0,990 | 7710,0 | 240,8 | 6609,0 | 30,8 | Z |
| | 3 | Presento | 0,9946 | sí | — | 76 | 0,803 | 1,154 | 7299,4 | 247,8 | 6214,1 | 16,1 | Presento |
| | 4 | Z | 0,9593 | sí | — | 77 | 0,584 | 1,119 | 5833,9 | 203,0 | 4767,1 | 23,7 | Z |
| | 5 | Z | 0,9399 | sí | — | 77 | 0,636 | 1,174 | 6565,5 | 198,5 | 5495,8 | 32,2 | Z |
| | 6 | Z | 0,5617 | sí | — | 77 | 0,532 | 1,368 | 5755,7 | 171,1 | 4828,8 | 24,9 | Z |
| | 7 | Presento | 0,9989 | sí | — | 75 | 0,787 | 1,344 | 8117,2 | 293,6 | 6698,8 | 30,2 | Presento |
| J | 1 | Z | 0,7122 | sí | — | 78 | 0,538 | 1,030 | 5488,3 | 181,9 | 4452,7 | 39,7 | Z |
| Mano quieta | 1 | ninguna | 0,9998 | no | modelo_sin_seña | 76 | 1,000 | 0,294 | 5890,3 | 215,3 | 4943,4 | 25,6 | ninguna |
| Cambio de letra | 1 | ninguna | 0,9999 | no | modelo_sin_seña | 78 | 0,821 | 0,808 | 5940,1 | 223,6 | 5123,3 | 11,4 | ninguna |
| | 2 | ninguna | 0,9948 | no | modelo_sin_seña | 78 | 0,910 | 0,807 | 6324,3 | 194,1 | 5562,9 | 19,1 | ninguna |
| Acomodarse en la silla | 1 | ninguna | 0,9430 | no | sin_mano | 79 | 0,000 | 1,661 | 13154,8 | 513,6 | 11712,7 | 42,1 | ninguna |
| Salir del cuadro | 1 | Mi | 0,9983 | no | sin_mano | 4 | 0,000 | — | 1385,1 | 125,1 | 185,2 | 5,5 | Mi |
| | 2 | Mi | 0,9983 | no | sin_mano | 4 | 0,000 | — | 1418,9 | 130,8 | 184,8 | 7,2 | Mi |

\* Incluye la subida del clip por Wi-Fi (ver la corrección de medición). «Decodif.» es base64
más la lectura de los cuadros del video.

Observaciones:

- **Acierto bajo con señas reales:** 2 de 4 en Nombre (las otras 2 dieron Yo), 2 de 7 en
  Presento (5 dieron Z) y 0 de 1 en J (dio Z). En Traducción en vivo, las mismas señas se
  reconocieron con 1 o 2 tramos (§2.1).
- **Z absorbe los errores:** 6 de las 8 respuestas incorrectas fueron Z, varias con confianza
  sobre 0,9. Z es una clase del modelo **dinámico**; el estático no la tiene (son 21 letras sin
  G, J, Ñ, S, X ni Z).
- **Una diferencia visible con Traducción en vivo** es que el clip no se recorta a la seña. La
  mano se ve en solo el 35 % al 80 % de los cuadros, porque el clip también trae el inicio y el
  final. Los tramos en vivo de las 3 señas traían mano en el 75 % al 100 % de los cuadros, y los clips de
  entrenamiento estaban recortados a la seña. La TCN remuestrea el clip entero a T = 60, así que
  la seña queda comprimida en una parte de la secuencia. Es una **hipótesis** que esta prueba no
  demuestra; tiene relación con la tarea 7 (recorte de tramos sin mano).
- **Los casos sin seña los rechazó el servidor** (`modelo_sin_seña` o `sin_mano`). Aun así, esta
  pantalla los muestra («ninguna», «Mi»), porque no filtra por `es_seña`.
- **En «Salir del cuadro» se procesaron solo 4 cuadros por clip.** No sé si el clip fue corto o
  si fue la lectura del webm.
- **MediaPipe:** de 3,2 a 11,7 s por clip de 72 a 79 cuadros. Excluyendo los clips de 4 cuadros,
  va de 42 a 148 ms por cuadro, con la creación del detector incluida.
