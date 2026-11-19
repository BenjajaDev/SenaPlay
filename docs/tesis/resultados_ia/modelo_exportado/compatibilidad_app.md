# Compatibilidad de la TCN exportada con la app

Revisado el 2026-11-19 contra `src/features/camera/presentation/signCamera.js` y
`ai_module/server.py` de `gestilingo-dev` (commit `9ddce9a`), con `MODELO_DINAMICO=exportado`
(TCN de 14 clases reentrenada con 562 videos). Prueba en proceso con `TestClient` y datos
sintéticos, sin videos de personas. Respuestas completas en `prueba_rutas_sinteticas.json`.

| Ruta que usa la app | Entrada que manda la app | Estado | Detalle |
|---|---|---|---|
| `POST /clasificar` | `{landmarks}`: 21 × 3 crudos de MediaPipe | Compatible | Responde `{seña, confianza}`; usa el modelo estático, que no cambia con el dinámico. |
| `POST /clasificar_frames` | `{frames, fps}`: cuadros JPEG en base64 del visor | Compatible | 30 cuadros sintéticos sin personas: 200, `es_seña` = false, `motivo` = `sin_mano`, `ratio_con_mano` = 0, con `alternativas`. Un tramo vacío responde 422. |
| `POST /clasificar_video` | `{video_base64, mime}` | No probada en esta revisión | Comparte `_respuesta_dinamica` con `/clasificar_frames`, así que devuelve los mismos campos. |
| `POST /clasificar_secuencia` (la app no la usa) | `{frames}`: vectores de 527 valores | Compatible | Una matriz (30, 527) responde 200; una forma inválida, 422. |

| Barrera de rechazo | Con la TCN exportada |
|---|---|
| `sin_mano` (fracción de cuadros con mano < 0,3) | Activa |
| `poco_movimiento` (desplazamiento de muñeca < 0,08) | Activa |
| `modelo_sin_seña` (clase `ninguna`) | Activa: el modelo tiene la clase `ninguna` |

Las 13 señas del modelo (sin contar `ninguna`) coinciden con la lista de
`src/features/camera/presentation/DynamicSignMonitorScreen.js`.

Conclusión: la TCN exportada se puede servir con `MODELO_DINAMICO=exportado` sin cambios en la
app. **No está desplegada**: producción sigue con la TCN legada (`MODELO_DINAMICO=tcn`, valor
por defecto). Antes de cambiarla falta probarla con cuadros reales del teléfono, como en
`docs/ai/integracion_verificacion.md` §2.
