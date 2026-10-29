@@INTRO
El presente capítulo documenta la ejecución del proyecto, es decir, cómo se materializaron los enfoques metodológicos del Capítulo III en un sistema funcional. Su organización sigue cinco fases que recorren el ciclo de vida del producto: definición de requerimientos, diseño, implementación por incrementos, verificación y evaluación, y despliegue. Cada fase se vincula con los planos de trabajo definidos en la sección 3.1.1 y con las épicas del tablero Jira, tal como resume la Tabla 12, de modo que cada resultado pueda trazarse hasta la tarea que lo originó y el objetivo específico que atiende.

Conviene precisar el alcance y la fuente de lo que aquí se informa. El capítulo describe el estado del sistema al 29 de octubre de 2026, verificado sobre la rama de desarrollo del repositorio mediante la ejecución de las pruebas automatizadas, la evaluación reproducible de los modelos y la consulta del tablero Jira en esa misma fecha. El foco está puesto en la aplicación móvil y en el módulo de inteligencia artificial, que constituyen el núcleo de la propuesta; del portal web se describen solo las funciones del panel de administración que sostienen la operación de la aplicación. Cuando un resultado comprometido en el Capítulo III aún no está disponible, se declara explícitamente como pendiente y se registra en la sección 4.7 junto con su causa.

[[TABLA|Correspondencia entre las fases del marco operativo, los enfoques metodológicos y las épicas de Jira|Fuente: Elaboración propia (2026), a partir de las secciones 3.1.1 a 3.1.4 y del tablero Jira del proyecto G3ST.|1500,2300,2200,1704]]
| Fase | Enfoque que la guía | Producto principal | Épicas Jira |
| I. Definición de requerimientos | ADDIE (análisis) y ciclo incremental (análisis) | Requerimientos funcionales y no funcionales, catálogo y resultados de aprendizaje | A, D |
| II. Diseño | ADDIE (diseño) y Clean Architecture | Arquitectura según el modelo de vistas 4+1, patrones, modelo de datos y especificación de la API | A, B, C |
| III. Implementación por incrementos | Ciclo incremental y CRISP-ML(Q), fases 1 a 3 y 6 | Incrementos de la aplicación, panel de administración y modelos integrados | A, B, C |
| IV. Verificación y evaluación | Pirámide de pruebas, CRISP-ML(Q) fases 4 y 5, Kirkpatrick | Resultados de pruebas, métricas de los modelos y evaluación con usuarios | B, D |
| V. Despliegue y mantenimiento | Ciclo incremental (integración continua) | Servicios publicados y configuración remota operativa | C |
[[/TABLA]]

@@4.1
La primera fase establece qué debe hacer el sistema y bajo qué condiciones. Sus insumos fueron las historias de usuario del tablero Jira, el protocolo de retroalimentación con la comunidad sorda (G3ST-24) y la etapa de análisis del modelo ADDIE descrita en la sección 3.1.4. Sus productos se organizan en cuatro apartados: los requerimientos funcionales, los no funcionales, el catálogo de señas y los resultados de aprendizaje que orientan el diseño pedagógico.

@@4.1.1
Los requerimientos funcionales se derivaron de las historias de usuario de las Épicas A, B y C y se refinaron a medida que avanzaban los incrementos. La Tabla 13 los presenta con su identificador, el módulo que los implementa, la historia de Jira de origen y su estado al cierre de este capítulo. Se distinguen dos actores principales: el estudiante, que usa la aplicación móvil, y el equipo de contenido (roles editor y administrador), que opera el panel web. La Figura 5 representa los casos de uso del estudiante, que constituyen la vista de escenarios del modelo 4+1 y articulan las demás vistas de arquitectura descritas en la sección 4.2.3.

[[TABLA|Requerimientos funcionales del sistema|Fuente: Elaboración propia (2026), a partir del tablero Jira del proyecto G3ST y del repositorio.|700,3050,1250,1050,1654]]
| ID | Requerimiento | Módulo | Historia | Estado |
| RF-01 | Registrar cuenta, verificar el correo con un código de un solo uso, iniciar sesión (correo o proveedores externos) y recuperar la contraseña | auth | G3ST-6 | Implementado |
| RF-02 | Recorrer una ruta de niveles con desbloqueo progresivo | levels | G3ST-8 | Implementado |
| RF-03 | Resolver ejercicios de nueve tipos con vidas, pistas y retroalimentación visual, háptica y por lector de pantalla | levels | G3ST-8 | Implementado |
| RF-04 | Obtener puntaje y estrellas al completar un nivel, con celebración | levels | G3ST-8 | Implementado |
| RF-05 | Consultar el progreso: niveles completados, racha diaria y errores frecuentes | progress | G3ST-10 | Implementado |
| RF-06 | Consultar el diccionario con búsqueda y detalle de cada seña | dictionary, signs | G3ST-7 | Parcial (falta el filtro por categoría de salud) |
| RF-07 | Jugar los minijuegos de memoria y quiz rápido | games | G3ST-9 | Parcial (falta el juego de cultura sorda) |
| RF-08 | Practicar una seña frente a la cámara y compararla con una referencia | camera | G3ST-19 | Implementado |
| RF-09 | Deletrear y traducir en vivo con reconocimiento de señas estáticas y dinámicas | camera | G3ST-13, 14, 19 | Implementado |
| RF-10 | Gestionar el perfil: foto, contraseña, tema, tamaño de letra y vibración | profile | G3ST-6, 11 | Implementado |
| RF-11 | Reproducir videos de señas con subtítulos | videos | G3ST-18 | Implementado |
| RF-12 | Gestionar niveles, ejercicios, diccionario, vocabulario y medios desde el panel | panel web | G3ST-18 | Implementado |
| RF-13 | Ajustar la aplicación sin publicar versiones: mantenimiento, avisos, vidas, puntaje, dificultad, versión mínima y módulos activos | panel web, remoteConfig | G3ST-18 | Implementado |
| RF-14 | Asignar roles y auditar los cambios de configuración | panel web | G3ST-18 | Implementado |
| RF-15 | Consultar los ejercicios con más errores de los estudiantes | panel web | G3ST-10 | Implementado |
[[/TABLA]]

[[FIGURA|Vista de escenarios: casos de uso del estudiante en la aplicación móvil|Fuente: Elaboración propia (2026), a partir de docs/04-casos-de-uso.md.|figuras/diagramas/escenarios-estudiante.png|5.35]]

El caso de uso central es *Jugar un nivel*, cuyo flujo principal consiste en elegir un nivel desbloqueado, responder cada ejercicio, recibir la retroalimentación y continuar hasta completarlo. Sus flujos alternativos muestran decisiones de diseño orientadas al aprendizaje: una respuesta incompleta genera un aviso sin costo de vida, una respuesta incorrecta resta una vida y obliga a reintentar el mismo ejercicio, y la ausencia de vidas presenta un mensaje no punitivo con la opción de reintentar. El caso *Practicar señas con cámara* es el único que involucra al servidor de inteligencia artificial como actor secundario, lo que refleja el desacoplamiento del módulo de reconocimiento definido en la sección 3.1.5.

@@4.1.2
Los requerimientos no funcionales fijan las cualidades que el sistema debe exhibir más allá de su comportamiento. Se formularon con un criterio de verificación explícito para que su cumplimiento pudiera comprobarse con evidencia y no por declaración, según resume la Tabla 14.

[[TABLA|Requerimientos no funcionales y su criterio de verificación|Fuente: Elaboración propia (2026), a partir de docs/01-arquitectura.md, docs/07-design-system.md y de las pruebas del repositorio.|900,1400,2900,2504]]
| ID | Atributo | Requerimiento | Verificación |
| RNF-01 | Disponibilidad | La aplicación debe mostrar niveles y diccionario aun sin conexión | Repositorios con respaldo en tres niveles (servidor, caché y datos empaquetados); pruebas de dominio con repositorios falsos |
| RNF-02 | Seguridad | Ningún cliente puede modificar contenido ni configuración sin el rol correspondiente | Políticas RLS en la base de datos; 19 verificaciones de rechazo por rol en la prueba de migraciones |
| RNF-03 | Accesibilidad | Contraste mínimo de 4,5:1 (WCAG 2.1 AA) en ambos temas, retroalimentación que no dependa del color ni del audio, y soporte de lector de pantalla y de reducción de movimiento | Prueba automatizada de contraste sobre más de 40 pares de colores; roles y etiquetas verificados en las pruebas de pantalla |
| RNF-04 | Rendimiento | La clasificación debe responder dentro del tiempo de interacción | Límite de espera de 2,5 s en clasificación estática y de 10 s en dinámica; inferencia medida de 0,37 ms (Random Forest) y 2,6 ms (TCN) en CPU |
| RNF-05 | Mantenibilidad | El dominio no debe depender de React, React Native ni Supabase | Regla de dependencias de Clean Architecture; 112 pruebas unitarias y de componentes |
| RNF-06 | Configurabilidad | El comportamiento de la aplicación debe ajustarse sin publicar una versión nueva | Configuración remota con valores por defecto, caché local y propagación en tiempo real |
| RNF-07 | Portabilidad | La aplicación debe compilar para Android con el motor Hermes | Verificación del paquete de producción (*verify:bundle*) |
[[/TABLA]]

Dos de estos requerimientos responden directamente a los principios del Diseño Universal para el Aprendizaje. La retroalimentación multimodal (RNF-03) ofrece múltiples formas de representación del resultado, combinando color, icono, texto, vibración y anuncio por lector de pantalla, sin depender del audio, lo que es coherente con una aplicación dirigida a la comunidad sorda y a sus interlocutores oyentes (World Wide Web Consortium, 2018). La disponibilidad sin conexión (RNF-01), por su parte, reduce una barrera de acceso para usuarios con conectividad limitada.

@@4.1.3
El catálogo de señas es el insumo que conecta el diseño pedagógico con el módulo de inteligencia artificial. A la fecha, el contenido cargado en la aplicación proviene de dos fuentes documentales: el Diccionario Bilingüe Lengua de Señas Chilena-Español del Ministerio de Educación (Adamo Quintela et al., 2013), del que se extrajeron las señas léxicas con su descripción y forma de ejecución, y los conjuntos públicos de imágenes del alfabeto dactilológico usados para el modelo estático. La Tabla 15 resume el catálogo efectivamente disponible en la aplicación.

[[TABLA|Catálogo de contenido disponible en la aplicación|Fuente: Elaboración propia (2026), a partir de src/features/levels/data/local/levelsCatalog.js, src/features/signs/data/local y ai_module/config/dataset_config.yaml.|2300,1200,4204]]
| Componente | Cantidad | Detalle |
| Niveles | 12 | Alfabeto (cinco niveles: A-E, F-J, K-Ñ, O-S y T-Z), Números 0-9, Saludos básicos, Mi familia, Comida y bebida, Sentimientos, Acciones cotidianas y Lugares |
| Ejercicios | 90 | Nueve tipos, detallados en la Tabla 17 |
| Entradas de diccionario | 47 | Alfabeto, números y acciones, con imagen y descripción |
| Señas léxicas (MINEDUC) | 7 | Con tipo gramatical, significado, forma de ejecución y página de origen |
| Señas estáticas reconocibles | 21 | Letras del alfabeto sin movimiento (se excluyen G, J, Ñ, S, X y Z) |
| Señas dinámicas reconocibles | 9 | G, J, S, X, Z, Yo, Mi, Nombre y Presento, más la clase de rechazo «ninguna» |
[[/TABLA]]

Este catálogo no corresponde todavía al catálogo A2 del dominio sanitario comprometido en el objetivo específico 1. La sesión de co-creación con la comunidad sorda de Talca (G3ST-21), que debe aportar las variantes regionales y validar las señas de saludos, datos personales, síntomas y solicitudes de atención, se encuentra en curso al cierre de este capítulo. Para no bloquear el desarrollo, se construyó primero la infraestructura que recibirá ese contenido: el gestor de niveles del panel, la tabla de señas léxicas y la tabla de capturas para el conjunto de datos dinámico con registro de consentimiento (*dynamic_sign_captures*). De este modo, la incorporación del catálogo validado no requiere modificar el código, sino cargar contenido. Las señas dinámicas entrenadas (Yo, Mi, Nombre y Presento) cubren ya la frase de presentación personal, que forma parte de los datos personales del nivel A2.

[[PENDIENTE|PENDIENTE: completar con la lista de señas validadas en la sesión de co-creación (G3ST-21), indicando por cada una si es estática o dinámica, su variante regional y el nivel asignado. Responsable: autor, con el registro de la sesión.]]

@@4.1.4
La etapa de análisis del modelo ADDIE definió el perfil del aprendiz y lo que este debe lograr. Siguiendo la sección 3.1.4, los aprendices objetivo son personas oyentes sin conocimientos previos de LSCh, en particular familiares de personas sordas y funcionarios de atención de público y de salud. Sobre la secuencia de niveles implementada se formularon resultados de aprendizaje progresivos, que la Tabla 16 presenta en su versión provisional, sujeta a la validación con la comunidad.

[[TABLA|Resultados de aprendizaje por grupo de niveles (versión provisional)|Fuente: Elaboración propia (2026), a partir de Council of Europe (2020), Fundación Sordos Chilenos (s. f.) y del catálogo de niveles.|2000,3600,2104]]
| Grupo de niveles | Resultado de aprendizaje esperado | Evidencia en la aplicación |
| Alfabeto (niveles 1 a 5) | Reconoce y produce las configuraciones manuales del alfabeto dactilológico y deletrea su nombre | Ejercicios de emparejamiento, orden y escritura; deletreo con cámara |
| Números (nivel 6) | Reconoce y produce los números del 0 al 9 para expresar edad, horarios y cantidades | Ejercicios de significado e interpretación |
| Saludos y familia (niveles 7 y 8) | Saluda, se presenta y nombra a los miembros de su familia en una interacción breve | Ejercicios de significado; señas dinámicas Yo, Mi, Nombre y Presento |
| Vida cotidiana (niveles 9 a 12) | Comprende y produce señas frecuentes de alimentos, emociones, acciones y lugares | Ejercicios de significado, interpretación y selección múltiple |
| Dominio sanitario | Comunica una dolencia y solicita atención en un escenario controlado | Pendiente del catálogo validado (G3ST-21) |
[[/TABLA]]

Las subtareas de análisis vinculadas a la comunidad (G3ST-76 a G3ST-78) permanecen pendientes, por lo que estos resultados se consideran una hipótesis de diseño que la sesión de co-creación debe confirmar o ajustar, en coherencia con la evaluación formativa que el modelo ADDIE prescribe al cierre de cada etapa.

@@4.2
La fase de diseño traduce los requerimientos en decisiones de interfaz, de estructura pedagógica y de arquitectura. Para documentar la arquitectura se adoptó el modelo de vistas 4+1 (Kruchten, 1995), que describe un sistema desde cinco perspectivas complementarias, cada una dirigida a una preocupación distinta: la vista lógica (qué abstracciones componen el sistema), la de procesos (cómo interactúan en tiempo de ejecución), la de desarrollo (cómo se organiza el código), la física (dónde se despliega) y la de escenarios, que valida las cuatro anteriores con casos de uso concretos. Esta elección permite presentar un conjunto acotado de diagramas, cada uno con un propósito definido, en lugar de un inventario exhaustivo.

@@4.2.1
El diseño de la interfaz partió de prototipos elaborados en Figma, que definieron la navegación inferior por pestañas (Niveles, Diccionario, Videos, Juegos y Progreso), la ruta de niveles y la pantalla de sesión. Durante la implementación, esos prototipos se consolidaron en un sistema de diseño con una fuente única de verdad: los tokens de color, degradados, espaciado, radios, tipografía y movimiento residen en el directorio de temas de la aplicación y se exportan automáticamente como variables CSS al portal web, de modo que ambas interfaces comparten la misma identidad visual.

El sistema define un tema claro de tonos violeta y magenta y un tema oscuro de tonos dorados, con la tipografía Poppins en diez estilos jerárquicos. Durante su construcción se corrigieron los colores de la paleta original que no alcanzaban el contraste mínimo: por ejemplo, el rojo de error pasó de una razón de 4,09:1 a 5,63:1 y el verde usado como texto de acierto, de 1,99:1 a 4,94:1. Una prueba automatizada verifica que ambos temas definan exactamente los mismos tokens y que los pares de texto cumplan la razón de 4,5:1.

[[FIGURA_PENDIENTE|Comparación entre el prototipo en Figma y la pantalla implementada|PENDIENTE: insertar dos o tres pantallas exportadas desde Figma junto a su captura en la aplicación. Responsable: autor.]]

@@4.2.2
La etapa de diseño del modelo ADDIE secuenció el contenido en una ruta lineal de niveles que avanza desde el alfabeto hacia el vocabulario temático. Dentro de cada nivel, los ejercicios siguen la progresión de la comprensión a la producción establecida en la sección 3.1.4: primero el aprendiz reconoce una seña y la asocia a su significado; después la compone, la ordena o la escribe; y finalmente la ejecuta frente a la cámara en los modos de práctica y deletreo. La Tabla 17 presenta los nueve tipos de ejercicio implementados y su frecuencia en el catálogo.

[[TABLA|Tipos de ejercicio implementados y su función en la progresión|Fuente: Elaboración propia (2026), a partir de src/features/levels/domain/exerciseTypes.js y del catálogo de niveles.|2000,1000,1600,3104]]
| Tipo | Ejercicios | Etapa | Habilidad que ejercita |
| Interpretar señas (*interpret-signs*) | 23 | Comprensión | Leer una secuencia de señas y escribir la palabra |
| Significado de la palabra (*word-meaning*) | 23 | Comprensión | Asociar una seña léxica con su significado |
| Selección múltiple | 15 | Comprensión | Identificar la letra o palabra que representa una seña |
| Verdadero o falso | 11 | Comprensión | Validar una afirmación sobre una seña |
| Escritura (*typing*) | 6 | Producción guiada | Escribir la letra correspondiente a una seña |
| Emparejamiento (*matching*) | 5 | Comprensión | Relacionar señas con letras |
| Ordenamiento | 5 | Producción guiada | Ordenar señas en secuencia |
| Construir palabra | 1 | Producción guiada | Componer una palabra a partir de señas |
| Reconocimiento | 1 | Comprensión | Reconocer varias señas en un conjunto |
[[/TABLA]]

Los mecanismos de juego operacionalizan los principios de la sección 2.2.7. Las vidas, tres por nivel por defecto, introducen una consecuencia leve al error sin bloquear el avance, y un error obliga a reintentar el mismo ejercicio, lo que favorece la práctica deliberada. Las pistas restan una penalización menor que se cobra una sola vez por ejercicio. El puntaje se calcula con 100 puntos por acierto, 30 de penalización por error, 20 de bonificación por vida restante y 5 de penalización por pista, y otorga una, dos o tres estrellas al superar el 40, 70 y 90 por ciento del puntaje máximo. Todos estos valores son ajustables desde el panel sin publicar una nueva versión, lo que permite calibrar la dificultad a partir de la evidencia de uso. Para evitar que el aprendiz memorice posiciones, los ejercicios de cada nivel rotan entre variantes del mismo tema en cada intento.

@@4.2.3
SeñaPlay adopta la arquitectura cliente con backend como servicio y servicio de inferencia desacoplado definida en la sección 3.1.5. Esta sección la documenta mediante las vistas del modelo 4+1, cuya correspondencia con los diagramas del capítulo resume la Tabla 18. La vista de escenarios ya se presentó en la Figura 5.

[[TABLA|Vistas del modelo 4+1 aplicadas a SeñaPlay|Fuente: Elaboración propia (2026), a partir de Kruchten (1995).|1500,2600,1700,1904]]
| Vista | Preocupación que responde | Diagrama | Figura |
| Escenarios (+1) | Qué hace el usuario con el sistema | Casos de uso del estudiante | Figura 5 |
| Lógica | Qué abstracciones y responsabilidades componen el sistema | Clases de los patrones y modelo entidad-relación | Figuras 7 y 12 |
| Procesos | Cómo colaboran los componentes en tiempo de ejecución | Secuencia de reconocimiento y máquina de estados de la sesión | Figuras 8 y 11 |
| Desarrollo | Cómo se organiza el código en módulos y capas | Capas de Clean Architecture por funcionalidades | Figura 9 |
| Física | Dónde se ejecuta cada componente | Despliegue en dispositivo y servicios en la nube | Figura 10 |
[[/TABLA]]

**Vista lógica.** La Figura 7 muestra las abstracciones principales de la aplicación móvil y los patrones que las relacionan. La raíz de composición (ServicesProvider) crea los repositorios y el bus de eventos; el repositorio del catálogo construye los niveles mediante el constructor de niveles, que a su vez valida cada ejercicio con la fábrica de ejercicios; la sesión de nivel se gobierna con una máquina de estados y selecciona el componente de cada ejercicio mediante un registro de estrategias; y el progreso se actualiza como suscriptor de los eventos de dominio. El detalle de cada patrón se presenta en la sección 4.2.4.

[[FIGURA|Vista lógica: clases y patrones de la aplicación móvil|Fuente: Elaboración propia (2026), a partir de docs/02-patrones-de-diseno.md.|figuras/diagramas/vista-logica-patrones.png|5.35]]

**Vista de procesos.** La interacción más exigente en tiempo de ejecución es el reconocimiento de señas, representado en la Figura 8. El componente de cámara ejecuta MediaPipe Hands dentro de una vista web y opera en dos modos simultáneos: con la mano quieta, envía cada 500 ms los 21 *landmarks* de la mano al endpoint de clasificación estática; cuando detecta un tramo con movimiento, envía los cuadros de un búfer circular (15 cuadros por segundo, 480 píxeles de ancho) al endpoint dinámico, que reproduce en el servidor el mismo pipeline holístico del entrenamiento. La respuesta se filtra por un umbral de confianza antes de mostrarse, para que el usuario no reciba predicciones al azar.

[[FIGURA|Vista de procesos: secuencia de reconocimiento de señas estáticas y dinámicas|Fuente: Elaboración propia (2026), a partir de src/features/camera y ai_module/server.py.|figuras/diagramas/vista-procesos-reconocimiento.png|5.35]]

**Vista de desarrollo.** El código de la aplicación se organiza por funcionalidades, cada una dividida en las capas de dominio, datos y presentación, sobre un núcleo transversal de infraestructura (Figura 9). La regla de dependencias establece que el dominio, escrito en JavaScript puro, no importa React, React Native ni Supabase, y que solo la raíz de composición conoce las implementaciones concretas. Una consecuencia práctica de esta regla es que el portal web reutiliza directamente la capa de dominio de la aplicación, de modo que ambos clientes validan los ejercicios con exactamente el mismo código.

[[FIGURA|Vista de desarrollo: capas de la aplicación móvil por funcionalidades|Fuente: Elaboración propia (2026), a partir de Martin (2017) y docs/01-arquitectura.md.|figuras/diagramas/vista-desarrollo-capas.png|5.35]]

**Vista física.** La Figura 10 muestra los nodos de ejecución. La aplicación se instala en el dispositivo Android mediante un paquete generado con Expo EAS y mantiene en el almacenamiento local la caché de contenido y el progreso. Supabase provee autenticación, base de datos con políticas RLS, almacenamiento de archivos y notificaciones en tiempo real. El servicio de inferencia se ejecuta en un contenedor Docker en Hugging Face Spaces y se publica automáticamente desde GitHub Actions, mientras que el panel de administración se sirve como sitio estático en Cloudflare Pages.

[[FIGURA|Vista física: despliegue de los componentes del sistema|Fuente: Elaboración propia (2026), a partir de docs/05-despliegue.md.|figuras/diagramas/vista-fisica-despliegue.png|5.35]]

@@4.2.4
Los patrones anunciados en la Tabla 4 se implementaron como piezas pequeñas y comprobables. Esta sección presenta los tres que sostienen la arquitectura con un extracto del código real; los restantes se describen brevemente al final.

**Repository.** Cada fuente de datos se accede a través de un repositorio que oculta a la interfaz los detalles de Supabase y del almacenamiento local. El Código 1 muestra el repositorio del catálogo de niveles, que implementa la estrategia de respaldo en tres niveles comprometida en la sección 3.1.5.

[[CODIGO|Repositorio del catálogo con respaldo en tres niveles|Fuente: src/features/levels/data/CatalogRepository.js, líneas 56-78.]]
  return {
    async getLevels() {
      try {
        const remote = await fetchRemote();
        if (remote) {
          const built = buildLevels(remote);
          if (built.levels.length) {
            await storage.set(CACHE_KEY, remote);
            return { ...built, source: 'remote' };
          }
        }
      } catch {
        /* sin red: se intenta la caché */
      }

      const cached = await storage.get(CACHE_KEY, null);
      if (Array.isArray(cached) && cached.length) {
        const built = buildLevels(cached);
        if (built.levels.length) return { ...built, source: 'cache' };
      }

      return { ...buildLevels(localLevels), source: 'local' };
    },
[[/CODIGO]]

La decisión de diseño que demuestra este extracto es que la aplicación nunca queda sin contenido: si el servidor no responde, usa el último catálogo válido guardado y, en una instalación nueva sin red, el catálogo empaquetado. Además, cada nivel remoto pasa por el constructor en modo tolerante, de manera que un ejercicio mal cargado desde el panel se omite y se informa como advertencia en lugar de romper la pantalla. Como el repositorio recibe el cliente y el almacenamiento por parámetro, las pruebas lo sustituyen por dobles en memoria.

**State.** Las reglas de una sesión de nivel se modelaron como una máquina de estados explícita, representada en la Figura 11 y codificada como una función pura (Código 2).

[[FIGURA|Vista de procesos: máquina de estados de la sesión de nivel|Fuente: Elaboración propia (2026), a partir de docs/02-patrones-de-diseno.md.|figuras/diagramas/vista-procesos-sesion-nivel.png|5.35]]

[[CODIGO|Tabla de transiciones y reductor de la sesión de nivel|Fuente: src/features/levels/domain/sessionMachine.js, líneas 36-41, 64-69 y 89-100.]]
export const TRANSITIONS = Object.freeze({
  [SESSION_STATUS.ANSWERING]: [SESSION_EVENTS.SUBMIT, SESSION_EVENTS.USE_HINT, SESSION_EVENTS.DISMISS_NOTICE, SESSION_EVENTS.RESTART],
  [SESSION_STATUS.FEEDBACK]: [SESSION_EVENTS.CONTINUE, SESSION_EVENTS.USE_HINT, SESSION_EVENTS.RESTART],
  [SESSION_STATUS.COMPLETED]: [SESSION_EVENTS.RESTART],
  [SESSION_STATUS.GAME_OVER]: [SESSION_EVENTS.RESTART],
});
// …
export function canHandle(state, eventType) {
  return (TRANSITIONS[state.status] || []).includes(eventType);
}

export function sessionReducer(state, event) {
  if (!event || !canHandle(state, event.type)) return state;
// …
      const lives = Math.max(0, state.lives - 1);
      return {
        ...state,
        status: lives === 0 ? SESSION_STATUS.GAME_OVER : SESSION_STATUS.FEEDBACK,
        lives,
        fails: state.fails + 1,
        notice: null,
        lostLifeIndex: lives,
        mistakeTick: state.mistakeTick + 1,
        feedback: { kind: 'incorrect', message: result.message || 'Respuesta incorrecta.' },
      };
[[/CODIGO]]

Al declarar las transiciones permitidas en una tabla, cualquier evento fuera de ella se ignora; por ejemplo, un doble toque en «Continuar» durante una animación no adelanta dos ejercicios. Al ser una función pura, las reglas del juego se prueban sin renderizar la interfaz, y los efectos visibles (vibrar, animar el corazón perdido o guardar el progreso) se derivan de las transiciones en la capa de presentación. Esta separación permitió dividir la pantalla original del nivel, de más de 1.300 líneas, en componentes acotados.

**Observer.** El progreso del estudiante no se guarda desde la pantalla del nivel, sino como reacción a un evento de dominio emitido por ella. El Código 3 muestra el bus de eventos que hace posible ese desacoplamiento.

[[CODIGO|Bus de eventos de dominio|Fuente: src/core/events/EventBus.js, líneas 11-37.]]
export function createEventBus() {
  const listeners = new Map();

  return {
    on(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
      return () => listeners.get(type)?.delete(listener);
    },
// …
    emit(type, payload) {
      const current = listeners.get(type);
      if (!current) return;
      [...current].forEach((listener) => {
        try {
          listener(payload);
        } catch (error) {
          if (__DEV__) console.warn(`[EventBus] listener de "${type}" falló:`, error);
        }
      });
    },
[[/CODIGO]]

Cuando una sesión termina, la aplicación emite el evento de nivel completado y el módulo de progreso, suscrito a él, actualiza el desbloqueo, el mejor puntaje y la racha. Ninguno de los dos módulos importa al otro, y un suscriptor que falla no impide que los demás se ejecuten. El mismo mecanismo propaga la actualización de la configuración remota a los servicios de vibración y de pistas.

Los patrones complementarios cumplen funciones acotadas. La fábrica de ejercicios crea objetos válidos e inmutables desde tres orígenes (catálogo local, fila de la base de datos y formulario del panel), y el constructor de niveles los ensambla con un modo estricto para el panel y uno tolerante para la aplicación. El registro de estrategias asocia cada tipo de ejercicio con su componente, por lo que agregar un tipo nuevo no modifica la pantalla del nivel. La fachada de retroalimentación ofrece un vocabulario de intención (confirmar, bloquear durante una operación, notificar y vibrar) sobre las interfaces de bajo nivel, y la inyección de dependencias concentra la creación de servicios en un único punto que las pruebas reemplazan por dobles.

@@4.2.5
El modelo de datos persistente, que forma parte de la vista lógica, se implementó en PostgreSQL mediante nueve migraciones versionadas. La Figura 12 presenta sus entidades principales con sus atributos clave, agrupadas en tres dominios. El primero reúne a los usuarios y su aprendizaje: perfiles con rol, niveles con sus ejercicios (cuyo contenido específico de cada tipo se almacena en un campo JSON validado por la fábrica de ejercicios) y el registro de errores por ejercicio que alimenta las métricas del panel. El segundo agrupa la configuración remota con su historial de auditoría, y el tercero, el contenido de consulta (diccionario, señas léxicas y medios) junto con la tabla de capturas para el conjunto de datos dinámico.

[[FIGURA|Vista lógica: modelo entidad-relación en Supabase|Fuente: Elaboración propia (2026), a partir de supabase/migrations y docs/03-modelo-de-dominio.md.|figuras/diagramas/vista-logica-er.png|4.8]]

Dado que la aplicación y el portal se comunican directamente con la base de datos, la seguridad se impone en ella misma mediante políticas de seguridad a nivel de fila. La Tabla 19 resume el acceso por tabla y el Código 4 muestra cómo se definen las funciones de rol que esas políticas utilizan.

[[TABLA|Políticas de acceso por tabla y rol|Fuente: Elaboración propia (2026), a partir de supabase/migrations y docs/03-modelo-de-dominio.md.|2800,2300,2604]]
| Tabla o bucket | Lectura | Escritura |
| levels, exercises, dictionary, signs | Pública | Equipo (editor o administrador) |
| media | Publicados: pública; borradores: equipo | Equipo |
| app_config, feature_flags | Pública | Administrador |
| config_audit | Administrador | Solo el disparador de auditoría |
| profiles | El propio usuario y el equipo | El propio usuario, sin cambiar su rol, y el administrador |
| Storage avatars | Pública | Cada usuario, solo en su carpeta |
| dynamic_sign_captures | Rol de servicio | Rol de servicio |
[[/TABLA]]

[[CODIGO|Función de rol y políticas de escritura para el equipo de contenido|Fuente: supabase/migrations/20260924000100_profiles_roles.sql, líneas 70-78, y 20260924000200_content_admin.sql, líneas 57-65.]]
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role_name() in ('editor', 'admin');
$$;
-- …
  foreach t in array array['levels', 'exercises', 'dictionary', 'signs'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "%s_staff_insert" on public.%I', t, t);
      execute format('create policy "%s_staff_insert" on public.%I for insert with check (public.is_staff())', t, t);
-- …
      execute format('create policy "%s_staff_delete" on public.%I for delete using (public.is_staff())', t, t);
[[/CODIGO]]

El rol se lee desde la tabla de perfiles y no desde los metadatos del usuario, que el propio usuario podría editar; además, un disparador impide que un usuario cambie su propio rol. Ocultar opciones en la interfaz es solo una comodidad: la protección efectiva reside en la base de datos, por lo que un cliente manipulado tampoco puede saltarse las reglas. Los datos de entrenamiento con consentimiento quedan restringidos al rol de servicio, separados del contenido público, en coherencia con la sección 3.5.3.

@@4.2.6
La especificación de requerimientos de software se consolidó en la documentación del repositorio siguiendo la estructura de la norma ISO/IEC/IEEE 29148 (International Organization for Standardization, 2018): propósito y alcance (sección 1.5), requerimientos funcionales y no funcionales (Tablas 13 y 14), casos de uso con su especificación detallada, matriz de trazabilidad entre requerimientos, módulos, recursos y pruebas, e interfaces externas. Entre estas últimas, la interfaz crítica es el contrato de la API de inferencia, que la Tabla 20 detalla.

[[TABLA|Contrato de la API del servicio de inferencia|Fuente: Elaboración propia (2026), a partir de ai_module/server.py.|1100,1800,2700,2104]]
| Método | Ruta | Entrada y salida | Uso en la aplicación |
| GET | / | Estado del servicio y disponibilidad de cada modelo | Verificación de despliegue |
| GET | /señas, /seña/{id} | Listado y detalle de señas de referencia | Modo práctica |
| POST | /clasificar | 21 *landmarks* de una mano → seña y confianza | Práctica, deletreo y traducción (estático) |
| POST | /clasificar_frames | Cuadros JPEG de un tramo con movimiento → seña, confianza, alternativas, indicador es_seña y motivo de rechazo | Traducción en vivo y deletreo (dinámico) |
| POST | /clasificar_video | Clip grabado → mismo resultado dinámico | Pantalla de señas dinámicas |
| POST | /clasificar_secuencia | Matriz de 527 valores por cuadro ya extraída → seña y confianza | Pruebas de integración |
| POST | /comparar | *Landmarks* del usuario y de la referencia → similitud por dedo | Práctica con mano de referencia |
[[/TABLA]]

El contrato evolucionó respecto de lo planteado en la sección 3.1.3, que suponía un único punto de entrada para la secuencia de *landmarks*. Se optó por que el servidor reciba cuadros de imagen en el caso dinámico y ejecute él mismo MediaPipe Holistic, en lugar de reimplementar la extracción holística en el teléfono, para garantizar que la entrada en producción sea idéntica a la de entrenamiento. El contrato permanece estable frente a cambios del modelo, lo que preserva la propiedad buscada en la sección 3.1.6: reemplazar la TCN por otra arquitectura no altera la aplicación.

@@4.2.7
La revisión del diseño se apoyó en tres mecanismos. El primero es técnico: la rama principal está protegida y los cambios ingresan mediante solicitudes de integración desde la rama de desarrollo, después de pasar las pruebas de la aplicación y del portal, la comprobación de tipos, la prueba de migraciones y permisos y la compilación del paquete de producción. Sobre el código nuevo se aplicó además un análisis estático con SonarCloud, cuyos hallazgos de confiabilidad se corrigieron antes de integrar. El segundo mecanismo es académico: los profesores guía revisaron el avance en cada entrega del calendario de la Épica E. El tercero corresponde al protocolo de retroalimentación estructurada con la comunidad sorda (G3ST-24), que establece que cada observación de una sesión se traduzca en una tarea etiquetada en las Épicas A o B. Este protocolo está definido, pero su aplicación efectiva depende de las sesiones con la comunidad, aún pendientes.

@@4.3
La implementación siguió el ciclo incremental de la sección 3.1.2: cada historia de usuario se analizó, diseñó, implementó y probó antes de integrarse. En paralelo, el módulo de inteligencia artificial avanzó según las fases 1 a 3 y 6 del proceso adaptado de CRISP-ML(Q). Esta sección reconstruye ese recorrido a partir del historial de Git, que registra 63 cambios integrados entre abril y octubre de 2026, concentrados en septiembre (42) y octubre (15).

@@4.3.1
La Tabla 21 presenta los incrementos de la aplicación en orden cronológico, con el cambio que los registra y la historia de Jira que atienden. Su secuencia confirma el criterio de reducción de riesgo de la sección 3.1.2: el reconocimiento con cámara estuvo disponible tempranamente, mientras que la consolidación de la arquitectura y del sistema de diseño se realizó una vez validado el flujo crítico.

[[TABLA|Incrementos de la aplicación móvil y del módulo de IA|Fuente: Elaboración propia (2026), a partir del historial de Git y del tablero Jira del proyecto G3ST.|1000,1500,3700,1504]]
| Fecha | Cambio | Incremento | Historia |
| 12-04 | e9e57b5 | Migración de la aplicación desde Flutter a React Native | — |
| 14-04 | be868a8 | Tema claro y oscuro global | G3ST-11 |
| 06-06 | 276c8ba | Migración de datos a Supabase y primer prototipo de IA | G3ST-12, 18 |
| 26-07 | 18507c1 | Reconocimiento estático funcional | G3ST-13 |
| 26-08 | db7f4d7 | Práctica con cámara, deletreo y traducción | G3ST-19 |
| 20-09 | 6067e45 | Pipeline dinámico con TCN y extracción holística | G3ST-12, 14 |
| 20-09 | e7d9636 | Superposición 2D de manos sobre la cámara | G3ST-19 |
| 23-09 | 42a1e4d | Modelo dinámico conectado a la aplicación | G3ST-19 |
| 23-09 | 0415518 | Umbral de confianza en el banner de IA | G3ST-19 |
| 24-09 | f333f04, 4d1b63a | Estructura por funcionalidades y patrones de diseño | G3ST-8, 10 |
| 24-09 | 69aeb32, d4c07c9 | Sistema de diseño y sesión de nivel rediseñada | G3ST-8 |
| 25-09 | 6f2cf81 | Ejercicios rotativos y registro de errores frecuentes | G3ST-8, 10 |
| 06-10 | c89238a | Modelos estático y dinámico en sincronía | G3ST-19 |
| 17-10 | fc11281 | Despliegue del servicio de IA | G3ST-20 |
[[/TABLA]]

Dos incrementos merecen destacarse por su efecto en la calidad del sistema. La reorganización por funcionalidades del 24 de septiembre reemplazó una estructura por tipo de archivo por los módulos y capas descritos en la sección 4.2.3, y dividió las pantallas más extensas en componentes acotados; desde ese punto, cada incremento posterior agregó pruebas junto con el código. El incremento del 6 de octubre, por su parte, integró ambos modelos en una misma experiencia: la aplicación clasifica con el modelo estático mientras la mano está quieta y recurre al dinámico solo cuando detecta movimiento, lo que permite deletrear y traducir sin que el usuario elija el modo.

[[FIGURA_PENDIENTE|Pantallas principales de la aplicación móvil: ruta de niveles, ejercicio con retroalimentación, celebración y progreso|PENDIENTE: insertar cuatro capturas tomadas en el dispositivo (ruta de niveles, un ejercicio con su retroalimentación, la celebración con estrellas y la pantalla de progreso). Responsable: autor.]]

[[FIGURA_PENDIENTE|Práctica de señas con cámara: superposición de la mano y banner de reconocimiento|PENDIENTE: insertar una captura de la práctica o la traducción en vivo con la superposición de puntos de la mano y el banner de IA visible. Responsable: autor.]]

@@4.3.2
El backend no incluye una API propia: la aplicación y el portal consumen Supabase directamente, y la lógica que requiere atomicidad o privilegios se implementó como funciones de la base de datos. Por ejemplo, guardar un nivel con sus ejercicios se resuelve en una sola transacción, y las métricas de errores frecuentes se calculan en el servidor solo para el equipo. Las nueve migraciones son idempotentes, es decir, pueden aplicarse dos veces sin error, propiedad que se comprueba en la prueba de migraciones.

Del portal web, construido con Vite, React y TypeScript, interesa para este trabajo el panel de administración, que permite al equipo de contenido operar la aplicación sin modificar su código. Sus funciones esenciales son tres. La primera es la gestión de contenido: niveles, ejercicios, diccionario, vocabulario y medios, con validación de cada ejercicio mediante el mismo dominio de la aplicación (Figura 15). La segunda es la configuración remota: modo de mantenimiento, avisos con fechas de vigencia, vidas, puntaje, dificultad, versión mínima y activación de módulos, con historial de cambios (Figura 16). Los cambios llegan a las aplicaciones abiertas en segundos mediante notificaciones en tiempo real y, si estas fallan, mediante una consulta periódica. La tercera es el seguimiento del aprendizaje: el resumen muestra los ejercicios con más errores, cuántas personas fallaron, cuántas veces dejaron a alguien sin vidas y la respuesta incorrecta más común (Figura 17), información que permite detectar señas confusas y ajustar el contenido.

[[FIGURA|Panel de administración: editor de niveles y ejercicios|Fuente: Elaboración propia (2026). Captura del portal con el catálogo de niveles de la aplicación.|figuras/capturas/admin-editor-nivel.png|5.35]]

[[FIGURA|Panel de administración: configuración remota de la aplicación|Fuente: Elaboración propia (2026). Captura del portal con los valores por defecto de la configuración.|figuras/capturas/admin-config-remota.png|5.35]]

[[FIGURA|Panel de administración: resumen con los ejercicios con más errores|Fuente: Elaboración propia (2026). Las cifras de errores y usuarios son datos de demostración.|figuras/capturas/admin-resumen.png|5.35]]

@@4.3.3
El módulo de inteligencia artificial contiene dos pipelines independientes, uno por tipo de seña, cuya construcción siguió las fases 1 a 3 de la sección 3.1.3. La Figura 18 resume el pipeline del modelo dinámico, que es el más elaborado.

[[FIGURA|Pipeline de construcción del modelo de señas dinámicas|Fuente: Elaboración propia (2026), a partir de ai_module/scripts y ai_module/config/dataset_config.yaml.|figuras/diagramas/pipeline-ia.png|4.8]]

**Fase 1: preparación de datos.** Para el modelo estático se usaron dos conjuntos públicos del alfabeto de la LSCh, uno de Roboflow (906 muestras) y otro de Kaggle con fotografías de varias personas (147 muestras), de los cuales se extrajeron los 21 *landmarks* de la mano con MediaPipe. Cada muestra se normaliza centrándola en la muñeca y escalándola por la distancia entre la muñeca y la base del dedo medio, y se complementa con 15 ángulos de flexión de las falanges y 7 distancias entre puntas de dedos, hasta formar 85 características. Las letras con movimiento se excluyeron, porque una imagen fija solo captura su forma de mano, que en varios casos coincide con otra letra estática. Para el modelo dinámico se grabaron videos por seña con la convención de nombre seña-señante-número, de los que MediaPipe Holistic extrae, cuadro a cuadro, un vector de 527 valores cuya composición detalla la Tabla 22.

[[TABLA|Composición del vector de entrada por cuadro del modelo dinámico|Fuente: Elaboración propia (2026), a partir de ai_module/scripts/holistic_pipeline.py.|1400,4400,1904]]
| Posiciones | Contenido | Valores |
| 0 a 62 | Mano izquierda: 21 puntos normalizados respecto de la muñeca | 63 |
| 63 a 125 | Mano derecha: 21 puntos normalizados | 63 |
| 126 y 127 | Presencia de cada mano (0 o 1) | 2 |
| 128 a 178 | Pose superior: 17 puntos (cabeza, hombros, codos y muñecas), centrados y escalados por los hombros | 51 |
| 179 a 526 | Rostro reducido: 116 puntos de labios, ojos, cejas y nariz | 348 |
[[/TABLA]]

Esta representación amplía la planteada en la sección 3.1.6, que consideraba solo manos y pose. Se incorporó un subconjunto del rostro porque los marcadores no manuales, como el movimiento de cejas o labios, cumplen funciones gramaticales en la lengua de señas (Stokoe, 2005), y se limitó a 116 puntos para no encarecer el vector con el contorno facial, que no aporta información lingüística. Los indicadores de presencia permiten al modelo distinguir una mano ausente de una mano en el origen de coordenadas.

**Fase 2: división del conjunto de datos.** En el modelo dinámico, cada secuencia se remuestrea a una ventana fija de 60 cuadros, lo que otorga invarianza a la velocidad de ejecución, y el conjunto se divide en 70, 15 y 15 por ciento, estratificado por clase y agrupado por señante a partir del nombre de archivo. El aumento de datos se aplica solo al entrenamiento: rotación, escalado, espejado (que intercambia las manos), ruido gaussiano y deformación temporal (*time-warp*), que simula ejecuciones más rápidas o más lentas. Se agregó además una clase de rechazo, «ninguna», con negativos sintéticos de mano quieta y deletreo estático, porque sin ella el modelo asignaba cualquier movimiento a alguna seña con alta confianza. En el modelo estático, la división es estratificada en 80 y 20 por ciento, con el aumento aplicado después de separar los conjuntos para evitar que variantes de una misma muestra queden a ambos lados.

**Fase 3: entrenamiento.** La Tabla 23 resume la configuración de ambos modelos. El dinámico es una red convolucional temporal de cuatro bloques residuales con dilataciones 1, 2, 4 y 8, cuyo bloque básico muestra el Código 5.

[[TABLA|Configuración de entrenamiento de los modelos|Fuente: Elaboración propia (2026), a partir de ai_module/model/train_static.py, ai_module/model/tcn.py y ai_module/config/dataset_config.yaml.|2300,2500,2904]]
| Parámetro | Random Forest (estático) | TCN (dinámico) |
| Entrada | 85 características por muestra | 60 cuadros × 527 valores |
| Arquitectura | 200 árboles, profundidad libre, mínimo 2 muestras por hoja, con escalado estándar | 4 bloques residuales (64, 64, 96 y 96 canales), kernel 3, dilataciones 1-2-4-8, *pooling* promedio y capa densa de 64 |
| Regularización | Aumento ×8 (rotación 3D de ±15°, ruido de 1 % y espejo) | Dropout 0,4, aumento ×8 (rotación ±20°, escala 0,85-1,15, espejo con p = 0,3, ruido σ = 0,015, *time-warp* 0,8-1,25) |
| Optimización | — | Adam, tasa 0,001, lote 8, 80 épocas, reducción de la tasa ante estancamiento |
| Selección del punto de control | — | Mejor F1 macro en validación |
| Semilla | 42 | 42 |
| Tamaño del modelo | 35,1 MB | 1,18 MB (288.234 parámetros) |
[[/TABLA]]

[[CODIGO|Bloque residual de la red convolucional temporal|Fuente: ai_module/model/tcn.py, líneas 32-58.]]
class BloqueTCN(nn.Module):
    """Dos convoluciones 1D dilatadas + BatchNorm + atajo residual (estilo ResNet)."""

    def __init__(self, canales_in: int, canales_out: int, kernel_size: int = 3,
                 dilation: int = 1, dropout: float = 0.3):
        super().__init__()
        padding = dilation * (kernel_size - 1) // 2  # padding "same" (kernel impar)

        self.conv1 = nn.Conv1d(canales_in, canales_out, kernel_size,
                                padding=padding, dilation=dilation)
        self.bn1 = nn.BatchNorm1d(canales_out)
        self.conv2 = nn.Conv1d(canales_out, canales_out, kernel_size,
                                padding=padding, dilation=dilation)
        self.bn2 = nn.BatchNorm1d(canales_out)
        self.relu = nn.ReLU()
        self.drop = nn.Dropout(dropout)

        # Proyección 1×1 en el atajo cuando cambia el nº de canales entre bloques
        self.atajo = (nn.Conv1d(canales_in, canales_out, 1)
                      if canales_in != canales_out else nn.Identity())

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = self.atajo(x)
        h = self.relu(self.bn1(self.conv1(x)))
        h = self.drop(h)
        h = self.bn2(self.conv2(h))
        return self.relu(h + residual)
[[/CODIGO]]

Tres decisiones se reflejan en este bloque. La convolución unidimensional se desplaza solo sobre el eje temporal y trata las 527 características como canales, tal como establece la sección 3.1.6, de modo que cada filtro combina todas las características de varios cuadros consecutivos. El relleno es simétrico y no causal, porque la clasificación se realiza sobre un tramo ya capturado y no en flujo continuo, lo que permite usar contexto anterior y posterior. Con cuatro bloques de dos convoluciones de kernel 3, el campo receptivo alcanza 61 cuadros y cubre la ventana completa de 60. La elección de la TCN frente a una red recurrente respondió a una restricción práctica: el entrenamiento se realiza en CPU, donde la convolución se paraleliza sobre el eje temporal y la recurrencia no (Bai et al., 2018).

@@4.3.4
La integración corresponde a la fase 6 de la sección 3.1.3 y conecta la aplicación con el servicio de inferencia según la secuencia de la Figura 8. Su principal desafío fue evitar falsos positivos: el modelo dinámico siempre devuelve alguna clase, incluso cuando el usuario solo cambia de una letra estática a otra. Para resolverlo, el servidor aplica tres barreras de rechazo antes de aceptar una seña dinámica, como muestra el Código 6.

[[CODIGO|Barreras de rechazo de la respuesta dinámica|Fuente: ai_module/server.py, líneas 358-386.]]
def _respuesta_dinamica(modelo, matriz: np.ndarray, stats: dict) -> dict:
    ranking = modelo.probabilidades(matriz)
    seña, confianza = ranking[0]
    movimiento = _movimiento_muñecas(matriz)

    motivo = None
    if stats["ratio_con_mano"] < RATIO_MIN_CON_MANO:
        motivo = "sin_mano"
    elif movimiento is not None and movimiento < MOVIMIENTO_MIN_MUÑECA:
        motivo = "poco_movimiento"
    elif seña == CLASE_SIN_SEÑA:
        motivo = "modelo_sin_seña"

    return {
        "seña": seña,
        "confianza": round(float(confianza), 4),
        "es_seña": motivo is None,
        "motivo": motivo,
        "alternativas": [
            {"seña": s, "confianza": round(float(p), 4)} for s, p in ranking[1:3]
        ],
# …
    }
[[/CODIGO]]

Un tramo se descarta si menos del 30 % de sus cuadros contiene una mano, si la muñeca más activa se desplaza menos de 0,08 anchos de hombro, o si el propio modelo responde la clase «ninguna». La segunda barrera es determinista y se calibró con el conjunto real, donde el desplazamiento mínimo de una seña dinámica fue cercano a 0,09 y el de los negativos, a 0,05; existe porque la clase de rechazo aún generaliza poco con un conjunto de datos tan pequeño. Cuando el tramo se descarta, la aplicación continúa con el modelo estático. En el cliente, además, solo se muestran predicciones con confianza igual o superior a 0,55 en el caso estático y a 0,6 en el dinámico; por debajo, el banner indica «No estoy seguro» en lugar de un resultado al azar. Si el servidor no tiene el modelo dinámico o no responde, la aplicación recurre a la lectura de trayectoria de las letras J y Z que realiza el propio visor.

[[PENDIENTE|PENDIENTE: medir y reportar la latencia de extremo a extremo (desde la captura hasta la visualización del resultado) en un dispositivo de gama media contra el servicio desplegado (G3ST-75). Responsable: autor.]]

@@4.4
La fase de verificación y evaluación distingue los cuatro objetos definidos en la Tabla 8: el software se verifica con pruebas automatizadas, los modelos se evalúan estadísticamente, la experiencia de uso se valora con usuarios y el aprendizaje se contrasta antes y después del uso guiado.

@@4.4.1
Las pruebas se ejecutaron el 29 de octubre de 2026 sobre la rama de desarrollo. La Tabla 24 presenta sus resultados por suite.

[[TABLA|Resultados de la verificación del software|Fuente: Elaboración propia (2026), a partir de la ejecución de las pruebas del repositorio.|2700,2500,2504]]
| Suite | Alcance | Resultado |
| Aplicación móvil (Jest) | Dominio, repositorios, sistema de diseño, contraste y pantallas | 112 de 112 pruebas aprobadas (13 suites) |
| Portal web (Vitest) | Dominio compartido, repositorios, formularios y componentes | 42 de 42 pruebas aprobadas (5 archivos) |
| Tipos del portal (TypeScript) | Comprobación estricta de tipos | Sin errores |
| Migraciones y permisos (PostgreSQL 16) | 9 migraciones, segunda aplicación idempotente y políticas por rol | 19 de 19 verificaciones de rechazo aprobadas |
| Paquete de producción Android (Hermes) | Compilación completa de la aplicación | Exitosa |
| Diagramas de la documentación | 17 diagramas en formato textual | 17 de 17 válidos |
[[/TABLA]]

El indicador global es la proporción de casos aprobados, que alcanza el 100 % en todas las suites; respecto de la fecha de corte del Capítulo III, la aplicación pasó de 95 a 112 pruebas y el portal, de 10 a 42. Se registró, no obstante, una observación: en una primera ejecución realizada en paralelo con la instalación de dependencias, cuatro pruebas de pantalla excedieron su tiempo de espera, y en las dos ejecuciones siguientes se aprobaron todas. El hecho se interpreta como sensibilidad de esas pruebas a la carga del equipo y se registra como riesgo de mantenimiento. Las verificaciones de vibración, cámara y animaciones en un dispositivo físico, así como las pruebas de extremo a extremo de los flujos críticos, se realizan de forma manual y no cuentan aún con un registro automatizado.

@@4.4.2
La evaluación del modelo estático se reprodujo con los mismos hiperparámetros del entrenamiento bajo dos protocolos. El primero, que replica el del repositorio, usa una división estratificada aleatoria. El segundo mide la generalización a personas no vistas: entrena solo con el conjunto de Roboflow y prueba con las fotografías de Kaggle, tomadas por otras personas. Como criterio de selección se compararon el Random Forest y una máquina de vectores de soporte con núcleo radial, ambos ya implementados en el script de entrenamiento. La Tabla 25 presenta los resultados.

[[TABLA|Métricas del modelo estático sobre la partición de prueba|Fuente: Elaboración propia (2026), a partir de la evaluación reproducible del repositorio (docs/tesis/cap4/scripts/eval_static.py).|2600,1100,1000,1000,1000,1004]]
| Protocolo | Modelo | Accuracy | Precisión macro | Recall macro | F1 macro |
| División aleatoria 80/20 (211 muestras) | Random Forest | 0,929 | 0,932 | 0,924 | 0,923 |
| División aleatoria 80/20 (211 muestras) | SVM-RBF | 0,962 | 0,965 | 0,952 | 0,955 |
| Personas no vistas (147 muestras) | Random Forest | 0,728 | 0,706 | 0,690 | 0,659 |
| Personas no vistas (147 muestras) | SVM-RBF | 0,619 | 0,576 | 0,586 | 0,548 |
[[/TABLA]]

Los resultados respaldan la selección del Random Forest según el criterio de la fase 5. Con división aleatoria, la máquina de vectores de soporte obtiene un F1 macro levemente superior, pero esa ventaja se invierte con personas no vistas, donde el Random Forest la supera por 11 puntos. Dado que la aplicación se usará con personas que no participaron del entrenamiento, el segundo protocolo es el pertinente. La validación cruzada en cinco particiones confirma la estabilidad del modelo elegido, con una accuracy de 0,935 ± 0,061. La caída de 0,923 a 0,659 en F1 macro entre ambos protocolos cuantifica, además, la limitación declarada en la sección 1.5.2: el desempeño depende de que los usuarios se parezcan a la población de entrenamiento. Cabe precisar que el repositorio registraba una accuracy cercana al 84 % con personas no vistas, pero esa cifra no pudo reproducirse con un protocolo verificable, por lo que se reporta el 72,8 % obtenido.

[[FIGURA|Matriz de confusión del Random Forest con división aleatoria|Fuente: Elaboración propia (2026), a partir de la evaluación reproducible del repositorio.|figuras/ia/cm_static_rf_P1.png|4.3]]

[[FIGURA|Matriz de confusión del Random Forest con personas no vistas|Fuente: Elaboración propia (2026), a partir de la evaluación reproducible del repositorio.|figuras/ia/cm_static_rf_P2.png|4.3]]

La matriz de confusión con personas no vistas (Figura 20) cumple la función diagnóstica prevista en la fase 4. Los errores se concentran en pares de configuración manual semejante: V se confunde con R en seis de siete casos, D con T, W con B y M con P, mientras que D y Q no se reconocen en ninguna muestra. Esta información orienta dos acciones: ampliar las muestras de esas letras con personas distintas y, en el diseño pedagógico, reforzar la retroalimentación sobre los rasgos que distinguen cada par.

Para el modelo dinámico, los resultados disponibles son los registrados durante su entrenamiento, que la Tabla 26 resume. No fue posible recalcularlos para este capítulo, porque los videos y secuencias de entrenamiento se mantienen fuera del repositorio por tratarse de grabaciones de personas.

[[TABLA|Resultados registrados del modelo dinámico|Fuente: Elaboración propia (2026), a partir del historial de Git (cambio 1b5b1d3), de ai_module/README.md y de la medición del modelo publicado.|3400,2000,2304]]
| Indicador | Valor | Observación |
| Accuracy en prueba | 0,70 | 30 muestras de una sola sesión y un solo señante |
| F1 macro en prueba | 0,71 | Subió de 0,70 al agregar la deformación temporal |
| Rechazo de negativos (clase «ninguna») | 3 de 9 | Motivó la barrera determinista de movimiento |
| Clases | 10 | 9 señas y la clase de rechazo |
| Latencia de inferencia del modelo | 2,6 ms por ventana | CPU, sin incluir la extracción holística ni la red |
[[/TABLA]]

Estos resultados deben leerse con cautela. La partición de prueba es pequeña y proviene del mismo señante y de la misma sesión de grabación que el entrenamiento, por lo que no mide la generalización a otras personas, que es precisamente lo que exige la sección 3.1.7. Además, la comparación con una línea base LSTM prevista en la fase 5 no se realizó: la TCN se eligió por su menor costo de entrenamiento en CPU, sin contrastarla empíricamente. Ambas brechas dependen de ampliar el conjunto de datos con más señantes (G3ST-17 y G3ST-22) y se registran en la sección 4.7.

[[PENDIENTE|PENDIENTE: reemplazar la Tabla 26 por las métricas por clase, la matriz de confusión y las curvas de entrenamiento del modelo dinámico (scripts/train_model.py y scripts/visualize_results.py) y, si se entrena, la comparación con la línea base LSTM. Responsable: autor, con el conjunto de datos local.]]

@@4.4.3
La evaluación de usabilidad se diseñó según la sección 3.4.3, con tres instrumentos: la System Usability Scale (Brooke, 1996), la observación estructurada de tareas y una encuesta breve de experiencia, aplicados con los resguardos de accesibilidad comprometidos (enunciados en LSCh, facilitador de la comunidad y consentimiento en formato accesible). Las tareas observadas incluyen el escenario controlado de comunicación de una dolencia a personal sanitario.

[[TABLA|Resultados de la evaluación de usabilidad|Fuente: Elaboración propia (2026), a partir de la sesión de validación con usuarios (G3ST-23).|3200,2000,2504]]
| Indicador | Resultado | Referencia |
| Puntaje SUS promedio (desviación estándar) | [PENDIENTE] | 68 puntos como promedio de referencia (Bangor et al., 2008) |
| Tasa de éxito en las tareas observadas | [PENDIENTE] | — |
| Tiempo medio por tarea | [PENDIENTE] | — |
| Errores por tarea | [PENDIENTE] | — |
| Hallazgos principales de la encuesta | [PENDIENTE] | — |
[[/TABLA]]

[[PENDIENTE|PENDIENTE: completar con los resultados de la sesión G3ST-23. En Jira la historia figura como lista, pero sus subtareas de diseño del protocolo, ejecución y sistematización (G3ST-82 a G3ST-84) siguen por hacer; debe aclararse si la sesión se realizó. Responsable: autor.]]

@@4.4.4
La evaluación del aprendizaje, correspondiente al nivel 2 de Kirkpatrick y Kirkpatrick (2006), compara la proporción de señas del escenario sanitario ejecutadas correctamente antes y después del uso guiado, según la valoración de un evaluador de la comunidad sorda con una pauta común. Como se advirtió en la sección 3.4.4, el criterio de referencia es la valoración humana y no la predicción del modelo.

[[TABLA|Resultados de la evaluación del aprendizaje|Fuente: Elaboración propia (2026), a partir de la tarea de producción aplicada antes y después del uso guiado.|3200,1500,1500,1504]]
| Indicador | Antes | Después | Variación |
| Proporción de señas ejecutadas correctamente | [PENDIENTE] | [PENDIENTE] | [PENDIENTE] |
| Participantes evaluados | [PENDIENTE] | — | — |
[[/TABLA]]

[[PENDIENTE|PENDIENTE: esta evaluación requiere el catálogo sanitario validado (G3ST-21) y la sesión con participantes. Si no alcanza a realizarse dentro del plazo, se declarará como limitación y trabajo futuro. Responsable: autor.]]

@@4.5
El despliegue se organiza en tres entornos que comparten el mismo código y difieren solo en sus variables de configuración, como resume la Tabla 29. La aplicación lee la URL de Supabase, su clave pública y la dirección del servicio de inferencia desde variables por perfil de compilación, de modo que ningún secreto queda en el código.

[[TABLA|Entornos de ejecución del sistema|Fuente: Elaboración propia (2026), a partir de docs/05-despliegue.md, eas.json y .github/workflows/desplegar-ia.yml.|1500,3100,3104]]
| Entorno | Aplicación móvil | Servicios |
| Desarrollo | Cliente de desarrollo de Expo en el dispositivo | Servicio de IA en la red local y proyecto Supabase de desarrollo |
| Vista previa | Paquete APK interno generado con Expo EAS | Proyecto Supabase de pruebas |
| Producción | Paquete generado con EAS para distribución | Supabase de producción, servicio de IA en Hugging Face Spaces y panel en Cloudflare Pages |
[[/TABLA]]

La decisión de desplegar el servicio de inferencia en Hugging Face Spaces, y no en Supabase Edge Functions ni en el plan gratuito de Render como consideraba la historia G3ST-20, se tomó por un requisito de memoria: con ambos modelos cargados, el servidor ocupa alrededor de 540 MB, por sobre los 512 MB que ofrece ese plan, mientras que el entorno elegido provee dos procesadores virtuales y 16 GB. El servicio se empaqueta en una imagen Docker con dependencias fijadas a las versiones del entrenamiento, ya que el modelo estático se serializa con scikit-learn y debe cargarse con la misma versión, y se publica automáticamente desde GitHub Actions cada vez que cambia el módulo en la rama principal. Su principal limitación operativa es que el servicio entra en reposo tras 48 horas sin uso y la primera petición posterior tarda entre uno y tres minutos.

El mantenimiento se apoya en la configuración remota descrita en la sección 4.3.2. Un administrador puede activar el modo de mantenimiento, publicar avisos, exigir una versión mínima o desactivar un módulo defectuoso sin publicar una nueva versión, y cada cambio queda registrado con su valor anterior, lo que permite revertirlo. Si Supabase no responde, la aplicación usa la última configuración guardada o, en su defecto, valores por defecto que reproducen su comportamiento original.

@@4.6
La Tabla 30 contrasta cada objetivo específico con la evidencia obtenida y su estado al 29 de octubre de 2026.

[[TABLA|Estado de cumplimiento de los objetivos específicos|Fuente: Elaboración propia (2026).|1700,3700,1000,1304]]
| Objetivo | Evidencia | Estado | Sección |
| OE1. Catálogo A2 sanitario validado | Infraestructura de catálogo, gestor de contenido y tabla de capturas con consentimiento; diccionario de 47 entradas y señas léxicas del MINEDUC. La validación con la comunidad y el contenido sanitario siguen en curso (G3ST-21) | Parcial | 4.1.3 |
| OE2. Arquitectura de aplicación lúdica | Arquitectura documentada con el modelo 4+1; 12 niveles, 90 ejercicios de 9 tipos, vidas, estrellas, racha, memoria, quiz y seguimiento de progreso. Falta el juego de cultura sorda (G3ST-43) | Logrado | 4.2 y 4.3.1 |
| OE3. Módulo de IA sobre el catálogo A2 | Random Forest para 21 letras (F1 macro de 0,923 y de 0,659 con personas no vistas) y TCN para 9 señas con un señante. Falta entrenar sobre el catálogo sanitario y contrastar con la LSTM | Parcial | 4.3.3 y 4.4.2 |
| OE4. Integración con retroalimentación en tiempo real | Servicio desplegado con 8 endpoints, reconocimiento estático y dinámico simultáneo, barreras de rechazo y umbrales de confianza. Falta medir la latencia de extremo a extremo | Logrado | 4.3.4 |
| OE5. Evaluación del sistema | Pruebas de software con 100 % de aprobación y métricas reproducibles del modelo estático. Faltan la evaluación de usabilidad, la del aprendizaje y la generalización del modelo dinámico | Parcial | 4.4 |
[[/TABLA]]

En síntesis, el sistema se encuentra funcional en sus componentes técnicos: la aplicación ofrece la experiencia educativa completa, el reconocimiento opera en el dispositivo contra un servicio desplegado y la operación se gestiona sin publicar versiones. Las brechas restantes comparten una causa común, que es la dependencia de las actividades con la comunidad sorda (Épica D): el catálogo sanitario validado, las grabaciones con más señantes y las sesiones con usuarios condicionan, a su vez, el entrenamiento sobre ese catálogo y la evaluación con personas.

@@4.7
La Tabla 31 contrasta las historias de usuario planificadas en la Tabla 7 con su estado en Jira al 29 de octubre de 2026 y con la evidencia del repositorio.

[[TABLA|Historias de usuario planificadas y ejecutadas|Fuente: Elaboración propia (2026), a partir del tablero Jira del proyecto G3ST y del repositorio.|900,2300,1200,1100,2204]]
| Clave | Historia | Término planificado | Estado en Jira | Evidencia en el repositorio |
| G3ST-11 | Tema claro y oscuro | 15-09 | Listo | Implementado |
| G3ST-6 | Autenticación y perfil | 19-09 | Listo | Implementado |
| G3ST-7 | Diccionario de señas | 05-10 | En curso | Implementado sin el filtro de salud |
| G3ST-8 | Niveles progresivos | 17-10 | Listo | Implementado |
| G3ST-10 | Seguimiento de progreso | 19-10 | Listo | Implementado |
| G3ST-9 | Minijuegos | 31-10 | En curso | Memoria y quiz; falta cultura sorda |
| G3ST-12 | Extracción de landmarks | 18-09 | Listo | Implementado |
| G3ST-13 | Random Forest | 29-09 | Listo | Implementado y evaluado |
| G3ST-16 | Aumento de datos | 30-09 | En curso | Implementado en ambos modelos |
| G3ST-15 | Servicio FastAPI | 09-10 | En curso | 8 endpoints desplegados |
| G3ST-14 | TCN y línea base LSTM | 03-11 | Por hacer | TCN integrada; LSTM no realizada |
| G3ST-18 | Conexión con Supabase | 05-10 | Listo | Implementado |
| G3ST-19 | Conexión con FastAPI | 14-10 | Listo | Implementado |
| G3ST-20 | Despliegue del servicio de IA | 27-10 | Listo | Desplegado en Hugging Face Spaces |
| G3ST-24 | Protocolo de retroalimentación | 14-09 | Listo | Definido |
| G3ST-17 | Reclutamiento de señantes | 16-10 | En curso | Sin grabaciones nuevas |
| G3ST-21 | Co-creación del catálogo A2 | 29-10 | En curso | Pendiente |
| G3ST-22 | Grabación con señantes | 07-11 | Por hacer | Pendiente |
| G3ST-23 | Validación con usuarios | 15-10 | Listo | Sin registro de resultados |
[[/TABLA]]

El contraste revela dos tipos de desviación. Por una parte, el tablero subestima el avance técnico: la TCN (G3ST-14), el servicio de inferencia (G3ST-15) y el aumento de datos (G3ST-16) figuran como pendientes o en curso, aunque están implementados e integrados; la causa es que el desarrollo avanzó más rápido que la actualización del tablero. Por otra, las actividades con la comunidad se retrasaron respecto de la planificación inicial y de la reprogramación informada en la sección 3.6, lo que desplazó el entrenamiento sobre el catálogo sanitario. Las diferencias de fondo entre lo planificado en el Capítulo III y lo ejecutado se resumen en la Tabla 32, junto con su tratamiento.

[[TABLA|Diferencias entre lo planificado y lo ejecutado|Fuente: Elaboración propia (2026).|2200,2600,2904]]
| Planificado (Capítulo III) | Ejecutado | Tratamiento |
| Comparar la TCN con una línea base LSTM (fase 5) | Solo se entrenó la TCN, elegida por su costo en CPU | Desviación declarada; la comparación queda como trabajo futuro, sin cambios en la aplicación gracias al contrato estable de la API |
| 20 señas estáticas del catálogo sanitario | 21 letras del alfabeto con conjuntos públicos | El modelo estático cubre el deletreo, base para expresar nombres y datos personales |
| 40 señas dinámicas, 25 señantes y 1.500 muestras | 9 señas y un señante | Resultado parcial del OE3, dependiente de G3ST-17, 21 y 22 |
| Manos y pose con ventana de 30 cuadros | 527 valores con rostro reducido y ventana de 60 cuadros | Ampliación justificada por los marcadores no manuales y la duración real de las señas |
| División por participante 17/4/4 con validación dejando uno fuera | División agrupada por señante, sin efecto real con un solo señante | Limitación declarada; se aplicará al ampliar el conjunto de datos |
| Despliegue en Edge Functions o Render | Hugging Face Spaces con despliegue automático | Desviación justificada por memoria (540 MB frente a 512 MB) |
| Un endpoint para la secuencia de landmarks | 8 endpoints, con extracción holística en el servidor | Mejora: entrada idéntica entre entrenamiento y producción |
| Evaluación de usabilidad y del aprendizaje | Sin resultados registrados | Pendiente (secciones 4.4.3 y 4.4.4) |
[[/TABLA]]
