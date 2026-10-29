# Ajustes sugeridos al Capítulo III

El Capítulo IV declara las diferencias entre lo planificado y lo ejecutado (Tabla 32). Estos son los cambios que conviene aplicar al Capítulo III para que ambos capítulos sean coherentes. No se aplicaron al documento: quedan a criterio del autor.

| Sección | Texto actual | Ajuste sugerido |
|---|---|---|
| 3.1.3, Fase 5 | Compara la TCN con una línea base LSTM | Mantenerlo como protocolo previsto y agregar que la comparación queda sujeta a la ampliación del conjunto de datos, o reformularla como trabajo futuro |
| 3.1.6 | K puntos de manos y pose superior; ventana de 30 cuadros | 527 valores por cuadro (manos, indicadores de presencia, pose superior y 116 puntos del rostro); ventana de 60 cuadros |
| 3.1.7, Tabla 5 | 60 señas (20 estáticas y 40 dinámicas), 25 participantes, 1.500 muestras | Mantenerla como meta y agregar el estado actual: 21 letras estáticas con conjuntos públicos (1.053 muestras) y 9 señas dinámicas con un señante |
| 3.4.1 | 95 pruebas en la app y 10 en el portal | 112 y 42 al 29-10-2026 |
| 3.7, Tabla 10 | Versiones de MediaPipe 0.10.9, scikit-learn 1.4.0, PyTorch 2.1.0, FastAPI 0.109.0 y Python 3.11 | Versiones fijadas en `ai_module/requirements-server.txt`: MediaPipe 1.0.1, scikit-learn 1.9.1, PyTorch 2.14.0 y FastAPI 0.141.1 (el contenedor usa Python 3.11) |
| 3.6 | Reprogramación de G3ST-17, 21 y 22 para la primera quincena de octubre | Actualizar con las fechas vigentes en Jira: G3ST-21 al 29-10 y G3ST-22 al 07-11 |
| 3.2, Tabla 6 | Épica C, "Integración y backend", con estado no declarado | La Épica C figura como "Listo" en Jira |

Además conviene actualizar el tablero Jira antes de la entrega final: G3ST-14, 15 y 16 tienen trabajo implementado que el tablero no refleja, y G3ST-23 figura como "Listo" con sus subtareas pendientes.
