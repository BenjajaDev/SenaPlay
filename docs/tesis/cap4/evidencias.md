# Capítulo IV: evidencias, brechas e índice (Fase A)

Fecha de corte de esta recolección: **29-10-2026**. Todo lo que sigue sale de comandos ejecutados sobre la rama `claude/confident-cray-0c40tz` (base `main` @ `9029b07`), del tablero Jira G3ST y del historial de Git. Las salidas completas están en `datos/`.

Criterios acordados para la redacción:

- **Foco en la app móvil y la IA.** Del portal web solo entra lo esencial del panel de administración: contenido, configuración remota y mantenimiento, roles con RLS y errores frecuentes.
- **Diagramas según el modelo 4+1 de Kruchten (1995):** uno o dos diagramas por vista, no los 17 de `docs/`.

---

## 1. Verificación del software (sección 4.4.1)

| Suite | Comando | Resultado | Archivo |
|---|---|---|---|
| App móvil (Jest 29) | `pnpm test` | **112/112** pruebas, 13 suites | `datos/jest-app.txt` |
| Portal web (Vitest 5) | `cd web && pnpm test` | **42/42** pruebas, 5 archivos | `datos/vitest-web.txt` |
| Tipos del portal | `npx tsc -b` | sin errores | `datos/tsc-web.txt` |
| Build del portal | `pnpm build` | OK | `datos/build-web.txt` |
| Migraciones y RLS (PostgreSQL 16 local) | `pnpm test:sql` | 9 migraciones + segunda pasada idempotente, **19/19** verificaciones de rechazo «OK», 0 «FALLA», por roles user, editor, admin y anónimo | `datos/test-sql.txt` |
| Bundle Android con Hermes | `pnpm verify:bundle` | OK | `datos/verify-bundle.txt` |
| Diagramas | `node scripts/checkMermaid.cjs` | **17/17** válidos | `datos/mermaid.txt` |

Notas para el texto:

- El Cap. III (3.4.1) cita 95 y 10 pruebas. Hay que actualizarlo a 112 y 42.
- La primera corrida de Jest, hecha en paralelo con la instalación de dependencias, tuvo 4 fallos por tiempo de espera en 3 suites de humo. Las dos corridas siguientes salieron 112/112. Es un indicio de pruebas sensibles a la carga, no un fallo funcional; conviene mencionarlo como riesgo de mantenimiento.
- El portal debe instalarse con `pnpm install --ignore-workspace`, como advierte `docs/05-despliegue.md`. Sin esa opción, Vitest falla al resolver módulos.

## 2. Modelos de IA (secciones 4.3.3 y 4.4.2)

### 2.1 Modelo estático (Random Forest), medido hoy

Script: `scripts/eval_static.py`. Usa los mismos hiperparámetros y el mismo aumento de datos que `ai_module/model/train_static.py`.

- **Datos:** 1.053 muestras de landmarks de mano (21×3) y 21 clases (alfabeto sin G, J, Ñ, S, X, Z). Origen: Roboflow (906) y Kaggle (147).
- **Características:** 85 por muestra (63 coordenadas normalizadas, 15 ángulos de flexión y 7 distancias entre puntas).
- **Modelo:** Random Forest de 200 árboles, `min_samples_leaf=2`, con aumento ×8 (rotación 3D, ruido y espejo) aplicado solo al conjunto de entrenamiento.

| Protocolo | Modelo | Accuracy | Precisión macro | Recall macro | **F1 macro** | CV 5-fold |
|---|---|---|---|---|---|---|
| P1: split estratificado 80/20 (n_test = 211) | **Random Forest** | 0,929 | 0,932 | 0,924 | **0,923** | 0,935 ± 0,061 |
| P1 | SVM-RBF | 0,962 | 0,965 | 0,952 | 0,955 | 0,916 ± 0,098 |
| P2: personas no vistas, entrena con Roboflow y prueba con Kaggle (n = 147) | **Random Forest** | 0,728 | 0,706 | 0,690 | **0,659** | — |
| P2 | SVM-RBF | 0,619 | 0,576 | 0,586 | 0,548 | — |

- **Selección (Fase 5).** La SVM gana con partición aleatoria, pero el Random Forest gana por 11 puntos de F1 con personas no vistas, que es el criterio que fija el Cap. III. La evidencia **justifica empíricamente el Random Forest**.
- **Latencia de inferencia del Random Forest:** 0,37 ms por muestra en CPU, sin contar la red.
- **Confusiones más frecuentes en P2:** V→R (6), D→T (4), W→B (4), H→K, M→P, T→A y T→E. D y Q obtienen F1 = 0. Son pares de configuración manual parecida y alimentan la retroalimentación al usuario y el catálogo.
- **Figuras:** `figuras/ia/cm_static_rf_P1.png` y `figuras/ia/cm_static_rf_P2.png`. Reportes por clase en `datos/ia/`.
- **Cifra del README.** El README y el commit `6b45bc3` dicen "~84 % con personas no vistas". No se puede reproducir porque el dataset de Kaggle no trae identificador de persona. **Propuesta:** reportar el 72,8 % del protocolo P2, que es verificable, y no el 84 %.

### 2.2 Modelo dinámico (TCN)

- **Checkpoint** `ai_module/data/models/dinamico_tcn.pt`: 10 clases (G, J, Mi, Nombre, Presento, S, X, Yo, Z y «ninguna»), entrada de 527 valores por cuadro y ventana de **60 cuadros**. Tiene 288.234 parámetros y pesa 1,18 MB. La inferencia toma 2,6 ms por ventana en CPU, medida hoy sin contar Holistic ni la red.
- **Arquitectura** (`model/tcn.py`): 4 bloques residuales con canales (64, 64, 96, 96), kernel 3, dilataciones 1-2-4-8, *padding* simétrico no causal, dropout 0,4, *pooling* promedio global y cabeza densa 64→clases. El campo receptivo es de 61 cuadros y cubre la ventana completa de 60.
- **Entrenamiento** (`config/dataset_config.yaml`): batch 8, 80 épocas, learning rate 0,001, Adam con ReduceLROnPlateau, split 70/15/15 agrupado por señante, semilla 42 y 8 variaciones por muestra. Aumento de datos: rotación ±20°, escala 0,85–1,15, espejo con p = 0,3, ruido σ = 0,015 y *time-warp* 0,8–1,25. El checkpoint se guarda cuando mejora el F1 macro de validación.
- **Resultados disponibles, solo los documentados en Git** (commit `1b5b1d3`, 23-09): sobre un test de **30 muestras de una sola sesión y un solo señante**, accuracy de 70 % y F1 macro de 0,70→0,71 tras agregar *time-warp*. El README registra que la clase «ninguna» acierta 3 de 9 negativos de test. **No se pueden recalcular aquí**, porque los videos y los `.npy` están en `.gitignore` y no vienen en el repo.
- **Rechazo en dos barreras** (`server.py`): clase «ninguna» y desplazamiento mínimo de muñeca de 0,08 anchos de hombro. Umbrales en la app: 0,55 para la estática y 0,6 para la dinámica (`signCamera.js`).
- **Despliegue:** el servidor usa unos 540 MB de RAM con ambos modelos cargados (commit `fc11281`), más que los 512 MB del plan gratuito de Render. Eso justifica Hugging Face Spaces (2 vCPU y 16 GB).

## 3. Contenido real de la app (secciones 4.1.3 y 4.2.2)

- **Catálogo de niveles** (`levelsCatalog.js`): 12 niveles y 90 ejercicios. Cinco niveles de alfabeto (A-E, F-J, K-Ñ, O-S, T-Z), Números 0-9, Saludos básicos, Mi familia, Comida y bebida, Sentimientos, Acciones cotidianas y Lugares.
- **Tipos de ejercicio:** 9 tipos, con esta frecuencia: interpret-signs 23, word-meaning 23, multiple-choice 15, true-false 11, typing 6, matching 5, ordering 5, build-word 1, recognition 1.
- **Diccionario:** 47 entradas (A-M, N-Z, Números, Acciones). **Vocabulario léxico:** 7 señas del Diccionario Bilingüe LSCh-Español del MINEDUC.
- **No hay contenido del dominio sanitario** (síntomas, dolencias ni atención). OE1 depende de G3ST-21, que sigue en curso.

## 4. Jira G3ST al 29-10-2026

Datos completos en `datos/jira-g3st.tsv`. Son 86 elementos: 5 épicas, 19 historias, 7 tareas académicas y 55 subtareas.

| Estado | Historias |
|---|---|
| Listo | G3ST-6, 8, 10, 11, 12, 13, 18, 19, 20, 23, 24 |
| En curso | G3ST-7, 9, 15, 16, 17, 21 |
| Por hacer | G3ST-14, 22 |

**Inconsistencias entre Jira y el repositorio** (conviene corregir el tablero antes de citarlo):

| Clave | Jira dice | El repositorio muestra |
|---|---|---|
| G3ST-14 (TCN + LSTM) | Por hacer | El TCN está entrenado, integrado y desplegado desde el 20-09. La LSTM no existe. |
| G3ST-15 (FastAPI) / G3ST-60 | En curso | Hay 8 endpoints en producción en HF Spaces. |
| G3ST-16 (aumento de datos) | En curso | Implementado en `augmentation.py` y `train_static.py`. |
| G3ST-23 (usabilidad) | **Listo** | Sus 3 subtareas (G3ST-82 a 84) siguen **Por hacer**. ¿Se hizo la sesión? |
| G3ST-20 (deploy) | "Edge Functions o Render" | Se desplegó en Hugging Face Spaces por la RAM. Hay que registrar la decisión. |
| G3ST-1 (épica A) | "Expo SDK 54, React 19.1" | El proyecto usa Expo SDK 57 y React 19.2. |
| G3ST-18 | "capa de acceso en `backend/`" | No hay `backend/`: se usan repositorios por funcionalidad contra Supabase. |

## 5. Cronología de incrementos desde Git (sección 4.3.1)

Son 63 commits: 2 en abril, 2 en junio, 1 en julio, 1 en agosto, 42 en septiembre y 15 en octubre.

| Fecha | Commit | Incremento | Historia |
|---|---|---|---|
| 12-04 | e9e57b5 | Migración de Flutter a React Native | — |
| 14-04 | be868a8 | Tema claro y oscuro global | G3ST-11 |
| 03/06-06 | 9dff9c7, 276c8ba | Primeros prototipos de IA y migración de datos a Supabase | G3ST-12, 18 |
| 26-07 | 18507c1 | IA estática funcional | G3ST-13 |
| 26-08 | db7f4d7 | Práctica con cámara, deletreo y traducción | G3ST-19 |
| 20-09 | 6067e45, e7d9636, cc56f4c | Pipeline dinámico con TCN, overlay 2D de manos y Expo SDK 57 | G3ST-12, 14 |
| 23-09 | 42a1e4d, 1b5b1d3, 0415518 | TCN conectado a la app, *time-warp* y umbral de confianza | G3ST-14, 16, 19 |
| 24-09 | f333f04, 4d1b63a, 69aeb32, d4c07c9 | Refactor feature-first, patrones, sistema de diseño y sesión de nivel rediseñada | G3ST-8, 10 |
| 24-09 | e7cd1ef, b4c1da3, 19e95ea | Migraciones con roles y RLS, panel web y documentación | G3ST-18 |
| 25-09 | 6f2cf81, 0654031 | Ejercicios rotativos y registro de errores frecuentes | G3ST-8, 10 |
| 06-10 | c89238a | Modelos estático y dinámico en sincronía | G3ST-19 |
| 17-10 | fc11281, 30ef514 | Despliegue de la IA (HF Spaces) y del portal (Cloudflare Pages) | G3ST-20 |
| 17-10 | e2a21c2 y siguientes | Perfil, equipo y landing (fuera del foco del capítulo) | — |

## 6. Brechas entre el Cap. III y lo implementado

| # | Planificado en el Cap. III | Implementado | Propuesta |
|---|---|---|---|
| B1 | Comparar TCN contra una línea base LSTM con F1 macro (Fase 5) | Solo TCN; la LSTM se descartó por costo en CPU, sin medirla | **Decidir:** (a) implementar la LSTM en `train_model.py` y entrenar ambas con tus datos locales, o (b) declararlo como desviación justificada y trabajo futuro |
| B2 | 20 señas estáticas del catálogo sanitario A2 | 21 letras del alfabeto (datasets públicos) | Ajustar 3.1.7 y Tabla 5: el estático cubre deletreo, base de datos personales A2 |
| B3 | 40 señas dinámicas sanitarias, 25 señantes, 1.500 muestras | 9 señas + «ninguna», 1 señante, ~25 videos por seña | Declararlo como resultado parcial de OE3, dependiente de G3ST-17, 21 y 22 |
| B4 | K puntos de manos y pose, ventana de 30 | 527 valores (manos, pose superior y 116 puntos faciales) y ventana de 60 | Actualizar 3.1.6 y justificar los rasgos no manuales |
| B5 | Dataset dividido por participante 17/4/4 + LOSO | Split 70/15/15 agrupado por señante; con un solo señante no hay separación real | Declararlo como limitación |
| B6 | Catálogo y niveles del dominio sanitario | 12 niveles de vocabulario general; ninguno sanitario | OE1 pendiente: depende de la co-creación (G3ST-21) |
| B7 | Despliegue en Supabase Edge Functions o Render | Hugging Face Spaces + GitHub Actions; portal en Cloudflare Pages | Desviación justificada por la RAM (540 MB > 512 MB) |
| B8 | Contrato de API con un endpoint | 8 endpoints (`/`, `/señas`, `/seña/{id}`, `/clasificar`, `/clasificar_secuencia`, `/clasificar_video`, `/clasificar_frames`, `/comparar`) | Documentarlos en una tabla (SRS) |
| B9 | Usabilidad (SUS) y aprendizaje pre/post | Sin datos en el repo ni en Jira | Te pido los datos (sección 8) |
| B10 | Métricas del README (~84 % con personas no vistas) | Medición reproducible: 72,8 % | Usar 72,8 % |

## 7. Índice del Capítulo IV con figuras, tablas y código

Numeración continua desde la **Tabla 11** y la **Figura 5**.

| Sección | Contenido | Figuras | Tablas | Código |
|---|---|---|---|---|
| Intro | Cinco fases ligadas a los enfoques del Cap. III | — | T11 Fases ↔ enfoque ↔ épica | — |
| 4.1.1 RF | Requerimientos funcionales de la app y la IA; del panel, solo lo esencial | — | T12 RF | — |
| 4.1.2 RNF | Funcionamiento sin conexión, seguridad con RLS, accesibilidad WCAG AA, latencia | — | T13 RNF con criterio de verificación | — |
| 4.1.3 Catálogo | Catálogo actual y estado de la validación con la comunidad | — | T14 Catálogo por nivel | — |
| 4.1.4 Análisis ADDIE | Perfil del aprendiz y resultados de aprendizaje | — | T15 Resultados de aprendizaje | — |
| 4.2.1 Mockups | Figma frente a la implementación | F5 *(mockups; los aportas tú)* | — | — |
| 4.2.2 Diseño instruccional | Progresión comprensión → producción, vidas, estrellas, pistas | — | T16 Tipos de ejercicio | — |
| 4.2.3 Arquitectura 4+1 | Las cinco vistas | **F6 Escenarios** (casos de uso) · **F7 Lógica** (patrones) · **F8 Procesos** (secuencia de reconocimiento) · **F9 Desarrollo** (capas) · **F10 Física** (despliegue) | T17 Vistas 4+1 ↔ preocupación ↔ artefacto | — |
| 4.2.4 Patrones | Repository, Factory, Builder, State, Observer, Strategy, Facade, DI | **F11 Procesos:** máquina de estados de la sesión | — | C1 Repository con respaldo, C2 reductor de la máquina de estados, C3 EventBus |
| 4.2.5 Datos | ER y RLS (vista lógica) | **F12** ER | T18 Políticas RLS por rol | C4 Política RLS |
| 4.2.6 SRS | Interfaces y contrato de la API | — | T19 Endpoints | — |
| 4.2.7 Revisión | CI, SonarCloud, PR BenjajaDev/SenaPlay#1 a #4, protocolo G3ST-24 | — | — | — |
| 4.3.1 Incrementos | Cronología de la sección 5 | F13-F18 *capturas de la app (te las pido)* | T20 Incrementos | — |
| 4.3.2 Panel admin | Solo lo esencial | F19 Editor de nivel · F20 Configuración remota · F21 Resumen con errores frecuentes | — | — |
| 4.3.3 IA fases 1 a 3 | Pipeline, vector de 527, hiperparámetros | **F22** Pipeline de IA | T21 Vector de 527 · T22 Hiperparámetros RF/TCN | C5 Bloque TCN, C6 Características del estático |
| 4.3.4 Integración (fase 6) | Flujo estático + dinámico, rechazo y umbrales | (usa F8) | — | C7 Rechazo en `server.py` |
| 4.4.1 Pruebas | Resultados de la sección 1 | — | T23 Suites | — |
| 4.4.2 Modelos (fases 4 y 5) | Métricas de la sección 2 y selección | F23-F24 Matrices de confusión | T24 Estático P1/P2 RF vs SVM · T25 Dinámico | — |
| 4.4.3 Usabilidad | SUS, tareas y encuesta | — | T26 *(datos tuyos o `[PENDIENTE]`)* | — |
| 4.4.4 Aprendizaje | Pre/post | — | T27 *(ídem)* | — |
| 4.5 Despliegue | EAS, HF Spaces y CI | (usa F10) | T28 Entornos | — |
| 4.6 Resultados | OE1 a OE5 con su evidencia y estado | — | T29 OE ↔ evidencia ↔ estado | — |
| 4.7 Tareas | Planificado vs. ejecutado y brechas | — | T30 Planificado vs. ejecutado | — |

Diagramas listos en `figuras/diagramas/` (fuentes en `diagramas/`): escenarios, lógica-patrones, lógica-ER, procesos-reconocimiento, procesos-sesión, desarrollo-capas, física-despliegue y pipeline-ia. Capturas del panel listas en `figuras/capturas/`, generadas con el catálogo real de la app y datos de demostración marcados como tales en las cifras de errores y usuarios. Matrices de confusión listas en `figuras/ia/`.

## 8. Lo que falta y cómo lo incluimos

| Falta | Por qué no lo tengo | Cómo lo resolvemos |
|---|---|---|
| Capturas de la app móvil (F13-F18) | La app no se puede renderizar fuera del dispositivo: no tiene `react-native-web` y usa cámara y WebView | Tómalas en el teléfono: 1) ruta de niveles, 2) un ejercicio con feedback, 3) celebración con estrellas, 4) diccionario, 5) práctica con cámara mostrando overlay y banner de IA, 6) progreso y racha. Opcionales: deletreo, traducción en vivo y perfil |
| Mockups de Figma (F5) | El conector de Figma no conectó en esta sesión | Pásame el enlace o exporta 2 o 3 pantallas |
| Métricas reales del TCN (matriz, F1 por clase) | Los videos y landmarks no están en el repo | Corre `python scripts/train_model.py` y `python scripts/visualize_results.py` en tu equipo y pásame el log y el PNG |
| Línea base LSTM (B1) | Decisión tuya | (a) La implemento y tú la entrenas, o (b) la declaramos como desviación |
| Resultados SUS, tareas y pre/post | No están en el repo ni en Jira | Si ya hiciste la sesión (G3ST-23 = Listo), pásame las planillas. Si no, quedan `[PENDIENTE]` |
| Latencia de extremo a extremo en producción (G3ST-75) | La URL del Space no está en el repo | Pásame la URL o tus mediciones |
| Validación del catálogo A2 con la comunidad (OE1) | G3ST-21 sigue en curso | Se reporta como parcial con lo que salga de la sesión |
