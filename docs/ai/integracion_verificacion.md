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
| Candidato | `feat/integracion-pipeline@43cf91e`, árbol limpio |
| Script | `ai_module/scripts/verificar_equivalencia.py` (commit `de54114`) |
| Entorno | el mismo `ai_module/.venv` para los dos árboles: Python 3.11.15, `requirements-server.txt`. Detalle en `entorno_equivalencia.json` |
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

**Diferencias de confianza.** El máximo es 1e-4 y se da solo en 2 casos de E (`/clasificar`).
No las produce la integración: el Random Forest del estático predice con `n_jobs=-1` y suma
las probabilidades de los árboles en paralelo, en un orden que cambia entre corridas. En esos
casos la probabilidad cae justo en el borde del redondeo a 4 decimales; en E_102, por
ejemplo, es exactamente 0,42525. Según el orden de la suma queda en 0,42524999… o en
0,4252500…01. Prueba local: con `n_jobs=-1` salen 3 valores distintos en 200 repeticiones, y con
`n_jobs=1`, uno solo. Pasa igual en producción y lo confirma que, en la corrida de prueba
anterior (commit `de54114`), los casos afectados fueron otros (E_102 y E_146). En las rutas
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

Pendiente.
