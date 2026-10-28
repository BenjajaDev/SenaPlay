# Prompt: redacción del Capítulo IV (Marco Operativo), trabajo de título SeñaPlay

> Pega todo lo que sigue en una sesión nueva de Claude Code sobre el repositorio `BenjajaDev/SenaPlay` y **adjunta el archivo `Trabajo_de_Titulo_BenjaminSoto_Avance2.docx`** (o su versión más reciente).

---

## Rol y objetivo

Actúa como Tech Lead del proyecto SeñaPlay y como coautor técnico del trabajo de título de Benjamín Soto. Tu tarea es **redactar el Capítulo IV: Marco Operativo** del documento adjunto, en un registro académico y con evidencia trazable a tres fuentes reales: el **código del repositorio**, el **tablero Jira G3ST** y el **historial de Git**. El capítulo debe describir lo que **ya se construyó y funciona**, siguiendo el esqueleto del capítulo (secciones 4.1 a 4.7) y cumpliendo lo que el Capítulo III prometió.

Trabaja **por fases y detente al final de cada una para pedir aprobación** (ver "Plan de trabajo").

## Insumos

1. **Documento adjunto (.docx).** Conviértelo con `pandoc ... -t markdown --extract-media=...` en tu scratchpad y lee **completos** los Capítulos I a III, porque el Capítulo IV debe ser coherente con ellos: objetivos OE1 a OE5 (1.4.2), alcances y limitaciones (1.5), enfoques metodológicos (3.1.1 a 3.1.4: Scrumban, ciclo incremental, CRISP-ML(Q) en 6 fases, ADDIE), arquitectura y patrones (3.1.5, Tabla 4), representación de entrada (3.1.6), dataset (3.1.7, Tabla 5), Jira (3.2 y 3.3, Tablas 6 y 7), pruebas (3.4, Tabla 8), documentación (3.5), cronograma (3.6) y recursos (3.7, Tabla 10). El esqueleto del Capítulo IV tiene marcadores `[Contenido por desarrollar…]` con pistas de lo que va en cada sección; respétalas.
2. **Repositorio** (léelo, no lo supongas):
   - `docs/01` a `docs/09`: arquitectura, patrones, modelo de dominio y ER, casos de uso, despliegue, trazabilidad, design system, configuración remota y guía de desarrollo. Contienen **17 diagramas Mermaid** reutilizables.
   - `src/` (app Expo/React Native, feature-first: `app/`, `core/`, `features/{auth,camera,dictionary,games,levels,profile,progress,remoteConfig,signs,videos}`, `shared/`).
   - `web/` (portal Vite + React + TS: landing y panel de administración, `web/src/data/repositories.ts`, `web/src/features/admin`).
   - `supabase/migrations/*.sql` (roles, gestor de contenido, config remota, medios, estadísticas, contenido del sitio, publicaciones, realtime y errores frecuentes, equipo) y `supabase/tests/10_rls_policies.sql`.
   - `ai_module/` (`README.md`, `scripts/holistic_pipeline.py`, `scripts/train_model.py`, `scripts/augmentation.py`, `scripts/generar_negativos.py`, `scripts/visualize_results.py`, `model/tcn.py`, `model/train_static.py`, `server.py`, `config/dataset_config.yaml`, `despliegue/huggingface/`).
   - `.github/workflows/desplegar-ia.yml`, `eas.json`, `app.json`, `package.json`, `web/package.json`, `ai_module/requirements*.txt`.
3. **Jira (MCP Atlassian Rovo)**: sitio `benjajadev.atlassian.net`, proyecto **G3ST**. Consulta con JQL `project = G3ST ORDER BY key ASC` (paginando) las 5 épicas, 19 historias, 7 tareas académicas y todas las subtareas, con `summary`, `status`, `issuetype`, `parent`, `duedate`, fechas de inicio, `description` y `comment`. Los estados **cambiaron desde la fecha de corte del Cap. III (25-09-2026)**: por ejemplo G3ST-8, G3ST-10, G3ST-13, G3ST-18, G3ST-19, G3ST-20 y G3ST-23 figuran hoy como "Listo". Usa el estado actual y registra la fecha de la consulta.
4. **Git**: `git log --format='%h %ad %s' --date=short --reverse` (62 commits, desde la migración desde Flutter en abril de 2026 hasta el despliegue en Cloudflare Pages y Hugging Face Spaces) y los PR fusionados `BenjajaDev/SenaPlay#1` a `#4`. Con ellos se reconstruyen los incrementos reales y sus fechas.

## Reglas de rigor (obligatorias)

- **Cero datos inventados.** Toda cifra (pruebas aprobadas, accuracy, F1, número de señas, muestras, participantes, puntaje SUS, latencias) debe salir de un comando que ejecutes, de un archivo del repo o de Jira. Si no existe, escribe un marcador visible `[PENDIENTE: qué falta y quién lo aporta]`, nunca un valor plausible.
- **Ejecuta, no cites de memoria**: `pnpm test` (Jest, app), `cd web && pnpm test && pnpm build` (Vitest y tsc), `pnpm test:sql` (migraciones y RLS, si el entorno lo permite), `pnpm verify:bundle` (bundle Hermes) y `node scripts/checkMermaid.cjs`. Si hay datos en `ai_module/data/`, ejecuta `python -I scripts/visualize_results.py` o la evaluación de `model/train_static.py` para obtener métricas y matrices de confusión reales. Reporta los comandos y sus salidas en el inventario de evidencias.
- **Detecta y declara las brechas entre lo planificado (Cap. III) y lo implementado.** No las ocultes ni reescribas el Cap. III por tu cuenta: preséntalas en una tabla "Planificado vs. ejecutado" y propón cómo tratarlas (ajuste del Cap. III, trabajo pendiente o limitación). Ya se detectaron estas, que debes verificar:
  1. **Línea base LSTM**: el Cap. III (Fase 5) compromete comparar TCN contra LSTM, pero `model/tcn.py` y `ai_module/README.md` documentan que se eligió TCN sin entrenar una LSTM.
  2. **Modelo estático**: el Cap. III habla de 20 señas estáticas del catálogo sanitario A2; el repo entrena **21 letras del alfabeto** (sin G, J, Ñ, S, X, Z) con Roboflow y Kaggle (README: ~94 % en test/CV y ~84 % con personas no vistas). Verifica esas cifras y su protocolo.
  3. **Representación de entrada**: el Cap. III define K puntos de manos y pose; `holistic_pipeline.py` usa **527 valores por frame** (2 manos de 63, 2 flags de presencia, pose superior de 51 y cara reducida de 116 puntos, 348 valores). Explica la decisión de incluir rasgos no manuales.
  4. **Despliegue**: Jira G3ST-20 dice "Supabase Edge Functions o Render"; el repo despliega la IA en **Hugging Face Spaces** (GitHub Actions) y el portal en **Cloudflare Pages**.
  5. **Endpoints reales** de `server.py`: `/`, `/señas`, `/seña/{id}`, `/clasificar`, `/clasificar_secuencia`, `/clasificar_video`, `/clasificar_frames`, `/comparar`. Contrástalos con el "contrato de API" del Cap. III.
  6. Ventana temporal (30 frames), división por participante, aumento de datos (incluye *time-warp*) y negativos (`generar_negativos.py`): confirma los valores en `config/dataset_config.yaml` y en los scripts.
- **Actividades con personas** (co-creación G3ST-21, grabación G3ST-17/22, usabilidad G3ST-23, evaluación del aprendizaje): describe el protocolo con lo que haya en Jira (descripciones, comentarios, adjuntos). Los resultados (SUS, tasas de éxito, pre/post) **pídeselos al usuario** en la Fase A; si no los entrega, deja la estructura de tablas lista con `[PENDIENTE]`.
- No incluyas secretos: nada de claves de Supabase, tokens de Hugging Face ni URLs con credenciales en extractos o capturas. Revisa cada captura antes de usarla.

## Estilo y formato (igual que los Capítulos I a III)

- Español formal, impersonal ("se implementó", "se verificó"), párrafos argumentados, sin viñetas sueltas como sustituto de prosa. Cada sección abre explicando el propósito y cierra conectando con la siguiente o con el objetivo específico (OE) que cumple.
- **Numeración continua**: el Cap. III termina en la **Tabla 10** y la **Figura 4**, así que el Cap. IV parte en la **Tabla 11** y la **Figura 5**. Introduce también **"Código N."** para los extractos (o el rótulo que use la plantilla).
- Rótulo arriba (`**Tabla 11.** Título`) y fuente abajo (`Fuente: Elaboración propia (2026), a partir de …`), como en el documento.
- Citas APA 7 **solo** de referencias que ya estén en la sección 10. Si una nueva es imprescindible, agrégala a la lista de referencias y avísalo.
- Referencia cruzada a secciones del Cap. III (por ejemplo, "según la Fase 2 de la sección 3.1.3") y a claves Jira (G3ST-xx) para que la trazabilidad sea explícita.
- **Extractos de código**: de 10 a 30 líneas, recortados con `// …`, con ruta y líneas de origen en la fuente (`Fuente: src/features/levels/domain/LevelSession.js, líneas 12-40`), y cada uno seguido de un párrafo que explique **qué decisión de diseño demuestra**, no qué hace línea por línea. Usa el código real, sin reescribirlo.

## Mapa de contenidos: qué evidencia alimenta cada sección

| Sección | Contenido esperado | Fuentes principales | Figuras, tablas y código sugeridos |
|---|---|---|---|
| Intro Cap. IV | Propósito y organización en 5 fases (requerimientos, diseño, implementación incremental, verificación, despliegue) alineadas con el ciclo incremental, CRISP-ML(Q) y ADDIE | Cap. III 3.1 | Tabla de correspondencia fase ↔ enfoque ↔ épica Jira |
| 4.1.1 RF | Requerimientos funcionales con ID (RF-01…), actor, prioridad, historia Jira y estado | `docs/04-casos-de-uso.md`, `docs/06-trazabilidad.md`, historias Jira | Tabla RF; diagrama de casos de uso (Mermaid de docs/04) |
| 4.1.2 RNF | Rendimiento (latencia de inferencia), seguridad (RLS, roles), disponibilidad sin conexión (respaldo en 3 niveles), accesibilidad (DUA, contraste, háptica, tamaño de letra), mantenibilidad, portabilidad | `docs/01`, `docs/07`, `src/core/a11y`, migraciones RLS | Tabla RNF con criterio de verificación medible |
| 4.1.3 Catálogo A2 | Catálogo y su estado de validación con la comunidad | `supabase/catalog.sql`, `signs.sql`, `dictionary.sql`, `dynamic_signs_capture.sql`, `ai_module/signs_reference.json`, G3ST-21/24, `docs/pages` (MINEDUC) | Tabla del catálogo por nivel y tipo (estática o dinámica) |
| 4.1.4 Análisis ADDIE | Perfil del aprendiz y resultados de aprendizaje por nivel | Cap. III 3.1.4, G3ST-76 a 78 | Tabla de resultados de aprendizaje |
| 4.2.1 Mockups | Prototipos y su evolución hasta la UI final | Figma (pedir enlace o exportaciones al usuario), `docs/07-design-system.md` | Capturas de mockup junto a la pantalla implementada |
| 4.2.2 Diseño instruccional | Niveles, tipos de ejercicio, progresión comprensión → producción, estrellas, vidas y rachas | `src/features/levels`, `games`, ExerciseFactory, registro de tipos | Mapa de niveles; tabla de tipos de ejercicio |
| 4.2.3 Arquitectura | Cliente + BaaS + servicio de inferencia desacoplado; Clean Architecture feature-first; regla de dependencias | `docs/01-arquitectura.md`, `src/app/AppRoot.js`, `src/core/di` | Diagrama de componentes y de despliegue; árbol de carpetas comentado |
| 4.2.4 Patrones | Repository (principal), Factory, Builder, State, Observer, Strategy, Facade y DI, con un extracto de código y un diagrama por patrón | `docs/02-patrones-de-diseno.md` y archivos que cita | Diagramas de clases y de estados; Código: repositorio con respaldo en 3 niveles, máquina de estados de la sesión de nivel, EventBus |
| 4.2.5 Modelo de datos | ER, tablas, roles (usuario, editor, admin, anónimo) y políticas RLS | `docs/03-modelo-de-dominio.md`, `supabase/migrations` | Diagrama ER; tabla de políticas RLS por rol; Código: una política RLS |
| 4.2.6 SRS | Síntesis IEEE 830/29148: propósito, alcance, interfaces (incluido el contrato de la API de inferencia), restricciones y trazabilidad | docs/04, docs/06, `server.py` | Tabla de endpoints (método, ruta, entrada, salida, uso desde la app) |
| 4.2.7 Revisión de diseño | Cómo se revisó: CI, checklist, revisiones de profesores, SonarCloud (commit 46ac1ca), retroalimentación de la comunidad (G3ST-24) | Git, PRs #1 a #4, Jira | Tabla de hallazgos y su resolución |
| 4.3.1 Incrementos app | Cronología real de incrementos (migración desde Flutter, tema, auth, cámara y deletreo, IA estática, TCN conectado, refactor feature-first, design system, sesión de nivel rediseñada, config remota, perfil, videos, ejercicios rotativos) vinculados a historias Jira | `git log`, Jira | Tabla de incrementos (fecha, commit, historia, entregable); capturas de cada pantalla clave |
| 4.3.2 Backend y portal | Migraciones, RPC, storage, realtime, panel admin (contenido, config remota y mantenimiento, estadísticas, errores frecuentes, publicaciones, equipo) y landing | `supabase/`, `web/src`, `docs/08` | Capturas del portal; Código: `web/src/data/repositories.ts`, validación de entorno en `web/src/lib/env.ts` |
| 4.3.3 Módulo IA (fases 1 a 3) | Captura, etiquetado, limpieza, extracción Holistic (527 features), normalización, división por señante, aumento de datos y negativos, entrenamiento RF y TCN con hiperparámetros y semillas reales | `ai_module/` completo | Diagrama del pipeline; tabla del vector de 527; tabla de hiperparámetros; Código: normalización y bloque residual de `tcn.py` |
| 4.3.4 Integración (fase 6) | Flujo cámara → landmarks/clip → API → predicción → retroalimentación; umbral de confianza (commit 0415518); modelos estático y dinámico en sincronía (c89238a) | `src/features/camera`, `server.py` | Diagrama de secuencia; capturas de la cámara con overlay; Código: cliente de la API en la app |
| 4.4.1 Pruebas software | Resultados reales por suite, más lo pendiente en dispositivo físico | Salidas de los comandos | Tabla por suite (casos, aprobados, %); captura de la salida de Jest y Vitest |
| 4.4.2 Modelos IA (fases 4 y 5) | Accuracy, precisión, recall y F1 macro, matriz de confusión, CV con personas no vistas; selección (y la brecha LSTM) | `visualize_results.py`, checkpoints | Matrices de confusión y curvas generadas; tabla de métricas |
| 4.4.3 Usabilidad | Protocolo accesible (LSCh en video, intérprete), SUS, tareas observadas y encuesta | G3ST-23, datos del usuario | Tablas de resultados o `[PENDIENTE]` |
| 4.4.4 Aprendizaje | Pre/post valorado por evaluador sordo | G3ST-82 a 84, datos del usuario | Tabla pre/post o `[PENDIENTE]` |
| 4.5 Despliegue | EAS (development y preview), Cloudflare Pages, Hugging Face Spaces con GitHub Actions, entornos, configuración remota y mantenimiento | `docs/05-despliegue.md`, `.github/workflows`, `eas.json` | Diagrama de despliegue; tabla de entornos |
| 4.6 Resultados | Síntesis por objetivo específico (OE1 a OE5): logrado, parcial o pendiente, con su evidencia | Todo lo anterior | Tabla OE ↔ evidencia ↔ estado |
| 4.7 Tareas cumplidas | Planificado (Tabla 7 del Cap. III) vs. ejecutado (Jira actual + Git): fechas reales, desvíos y causas, y brechas | Jira, Git | Tabla comparativa; Gantt actualizado (planificado vs. real) |

## Capturas y figuras: cómo generarlas

Guarda todo en `docs/tesis/cap4/figuras/` con nombres `fig-05-arquitectura.png`, `fig-06-…`, etc.

- **Diagramas Mermaid** de `docs/`: renderízalos a PNG con `@mermaid-js/mermaid-cli` usando el Chromium preinstalado (`PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium`, flags `--no-sandbox`). Si un diagrama nuevo es necesario (pipeline de IA, Gantt real o secuencia de inferencia), escríbelo en Mermaid y agrégalo también a `docs/` para que quede versionado.
- **Portal web**: levanta `cd web && pnpm dev` y captura con Playwright (`require('playwright')`, `chromium.launch()`) la landing, el login y cada sección del panel, en tema claro y oscuro, a 1440×900. Si el panel requiere sesión y no hay credenciales de prueba en variables de entorno, captura con los *fakes* de `web/src/test/fakes.ts` o pide al usuario las capturas.
- **App móvil**: intenta `pnpm web` (Expo web) para las pantallas sin dependencias nativas, a 390×844. La cámara, la vibración y el reconocimiento requieren dispositivo: entrega una **lista de capturas que el usuario debe tomar en el teléfono** (pantalla, estado, qué debe verse y nombre de archivo esperado).
- **Gráficos de IA**: los que generen `visualize_results.py` o `train_static.py`. Si no hay datos locales (están en `.gitignore`), pide al usuario los PNG o los logs de entrenamiento.
- **Salidas de terminal** (Jest, Vitest, build): guárdalas como texto y renderízalas como imagen de bloque monoespaciado o insértalas como tabla.
- **Jira**: tabla generada desde la consulta. Si quieres una captura del tablero, pídesela al usuario.

## Plan de trabajo (detente y pide aprobación al final de cada fase)

**Fase A: Evidencias y brechas.** Lee el .docx, el repo, Jira y Git; ejecuta las pruebas y los scripts de métricas. Entrega `docs/tesis/cap4/evidencias.md` con: (1) los comandos ejecutados y sus resultados; (2) el inventario de Jira actualizado; (3) la cronología de incrementos desde Git; (4) la tabla de brechas Planificado vs. ejecutado con tu recomendación para cada una; (5) la lista de datos y capturas que necesitas del usuario; (6) el índice detallado del Cap. IV con las figuras, tablas y extractos asignados a cada sección y su numeración. **Espera aprobación.**

**Fase B: Redacción.** Escribe `docs/tesis/cap4/capitulo-4.md` sección por sección según el índice aprobado, con figuras enlazadas, tablas y extractos. Si el capítulo es largo, entrega primero 4.1 y 4.2, luego 4.3 y finalmente 4.4 a 4.7. **Espera aprobación tras cada bloque.**

**Fase C: Integración en el .docx.** Usa la skill `docx` para insertar el capítulo en una **copia** del documento (`Trabajo_de_Titulo_BenjaminSoto_Avance3.docx`), reemplazando solo los marcadores del Cap. IV y preservando estilos, numeración de títulos, índice de tablas y figuras, encabezados y referencias. No toques los Capítulos I a III; las correcciones que propongas para ellos van en una lista aparte. Verifica el resultado convirtiéndolo a PDF y revisando visualmente las páginas del capítulo.

## Entregables

1. `docs/tesis/cap4/evidencias.md` (Fase A).
2. `docs/tesis/cap4/capitulo-4.md` y `docs/tesis/cap4/figuras/` (Fase B).
3. `Trabajo_de_Titulo_BenjaminSoto_Avance3.docx` con el Cap. IV integrado (Fase C).
4. `docs/tesis/cap4/ajustes-capitulo-3.md`: cambios sugeridos al Cap. III derivados de las brechas.
5. Commit y push a la rama de trabajo asignada (sin crear PR salvo que se pida). Los .docx y las capturas del dispositivo no se suben si contienen datos personales de participantes.

## Checklist final antes de entregar

- [ ] Cada cifra tiene fuente (comando, archivo o clave Jira) en `evidencias.md`.
- [ ] Todas las brechas del Cap. III están declaradas, sin ocultar ninguna.
- [ ] La numeración de tablas, figuras y código es continua desde Tabla 11 / Figura 5, y todas tienen fuente.
- [ ] Cada OE (1 a 5) aparece en 4.6 con su evidencia y estado.
- [ ] Ningún extracto ni captura expone secretos o datos personales.
- [ ] Los `[PENDIENTE]` están listados al final con su responsable.
- [ ] El estilo coincide con los Capítulos I a III (impersonal, APA 7, rótulos).
