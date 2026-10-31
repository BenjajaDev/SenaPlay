# Compatibilidad del servidor de `feat/ia-comparacion-temporal` con la app

Revisado el 2026-10-31 contra `src/features/camera/presentation/signCamera.js` y
`ai_module/server.py` de `gestilingo-dev`, y probado con uvicorn y datos sintéticos (sin videos
de personas) usando el modelo exportado (LSTM, 9 clases). Detalle de las respuestas en
`prueba_rutas_sinteticas.json`.

| Ruta que usa la app | Entrada que manda la app | Estado | Por qué |
|---|---|---|---|
| `POST /clasificar` | `{landmarks}`: 21 × 3 crudos de MediaPipe | Formato compatible, modelo distinto | Responde `{seña, confianza}` igual que producción, pero con el `estatico.pkl` antiguo de 26 letras; producción usa el de 21 (sin G, J, Ñ, S, X ni Z). |
| `POST /clasificar_frames` | `{frames, fps}`: cuadros JPEG en base64 del visor | **Incompatible** | La ruta no existe (404). La app cae a la heurística de trayectoria (solo J y Z). |
| `POST /clasificar_video` | `{video_base64, mime}` | Compatible a medias | Misma entrada. La respuesta trae `seña`, `confianza`, `frames_procesados` y `ratio_con_mano`, pero no `es_seña`, `motivo` ni `alternativas`. Con un clip sintético sin manos (`ratio_con_mano` = 0) respondió «Nombre» con confianza 0,87. |
| `POST /clasificar_secuencia` (la app no la usa) | `{frames}`: vectores de 527 valores | Compatible | La LSTM usa `marco_manos: local`, así que acepta el formato 1.0; una forma inválida responde 422. |

| Barrera de rechazo de producción | En esta rama |
|---|---|
| `sin_mano` (fracción de cuadros con mano < 0,3) | No existe |
| `poco_movimiento` (desplazamiento de muñeca < 0,08) | No existe |
| `modelo_sin_seña` (clase `ninguna`) | No existe; el modelo exportado tampoco tiene esa clase |

Conclusión: la rama no se une con `gestilingo-dev` ni se despliega hasta cerrar las tareas de
`docs/ai/pendientes_integracion.md` (en `feat/ia-comparacion-temporal`).
