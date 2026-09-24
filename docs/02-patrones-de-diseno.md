# 2. Patrones de diseño

| Patrón | Dónde | Problema que resuelve |
|---|---|---|
| **Repository** | `features/*/data/*Repository.js`, `web/src/data/repositories.ts` | Aísla a la UI de Supabase y AsyncStorage. Unifica la estrategia remoto → caché → local y la traducción de errores. |
| **Factory** | `levels/domain/ExerciseFactory.js` | Crea ejercicios válidos, normalizados e inmutables desde tres orígenes (catálogo local, fila de BD y formulario del panel). |
| **Builder** | `levels/domain/LevelBuilder.js` | Arma niveles paso a paso con validación al final. Tiene modo estricto (panel) y tolerante (app). |
| **State Machine** | `levels/domain/sessionMachine.js`, `app/RootNavigator.js` | Define las reglas del juego (responder, feedback, completado, sin vidas) y el flujo de autenticación como transiciones explícitas y testeables. |
| **Observer** | `core/events/EventBus.js`, `SessionProvider`, `RemoteConfigProvider` | Desacopla módulos: la sesión de nivel emite `LEVEL_COMPLETED` y el progreso lo persiste sin que se conozcan. |
| **Strategy / Registry** | `levels/presentation/exercises/index.js` | Asocia cada tipo de ejercicio a su componente. Un tipo nuevo no toca la pantalla del nivel. |
| **Inyección de dependencias** | `core/di/ServicesProvider.js`, `web/src/data/RepositoriesProvider.tsx` | Tiene un único *composition root*. Los tests inyectan repositorios falsos. |
| **Facade** | `core/feedback/haptics.js`, `shared/ui/feedback/FeedbackProvider.js` | Ofrece un vocabulario de intención (`haptics.success()`, `confirm()`, `runBlocking()`) sobre APIs de bajo nivel. |

## 2.1 Diagrama de clases de los patrones

```mermaid
classDiagram
  direction LR

  class ServicesProvider {
    <<composition root>>
    +createServices(supabase, storage, events)
    +useServices() Services
  }

  class CatalogRepository {
    <<Repository>>
    +getLevels() LevelsResult
    +getLocalLevels() Level[]
  }
  class ProgressRepository {
    <<Repository>>
    +getLevelProgress(userId)
    +saveLevelProgress(userId, progress)
    +recordDailyActivity(userId, today)
    +getLivesState(userId)
  }
  class RemoteConfigRepository {
    <<Repository>>
    +getCached() Snapshot
    +fetch() Snapshot
  }
  class AuthRepository {
    <<Repository>>
    +signIn(email, password) Result
    +signUp(data) Result
    +verifyCode(email, code, purpose) Result
    +onSessionChange(cb) unsubscribe
  }

  class ExerciseFactory {
    <<Factory>>
    +create(raw) Exercise
    +fromRow(row) Exercise
    +toRow(exercise, position) Row
    +createMany(rawList) Result
    +validate(raw) Validation
  }
  class LevelBuilder {
    <<Builder>>
    +title(value) LevelBuilder
    +category(value) LevelBuilder
    +addExercise(raw) LevelBuilder
    +lenient() LevelBuilder
    +build() Level
    +fromObject(raw)$ LevelBuilder
  }

  class sessionMachine {
    <<State Machine>>
    +createInitialSession(total, maxLives) Session
    +sessionReducer(state, event) Session
    +canHandle(state, eventType) bool
  }
  class useLevelSession {
    <<adaptador React>>
    +state
    +actions: submit, continue, restart, showHint
  }

  class EventBus {
    <<Observer>>
    +on(type, listener) unsubscribe
    +once(type, listener)
    +emit(type, payload)
  }
  class useUserProgress {
    <<suscriptor>>
    +levelProgress
    +lives
  }

  class EXERCISE_COMPONENTS {
    <<Strategy registry>>
    matching → MatchingExercise
    multiple-choice → ChoiceExercise
    ordering → OrderingExercise
    …
  }

  ServicesProvider --> CatalogRepository
  ServicesProvider --> ProgressRepository
  ServicesProvider --> RemoteConfigRepository
  ServicesProvider --> AuthRepository
  ServicesProvider --> EventBus
  CatalogRepository ..> LevelBuilder : construye niveles
  LevelBuilder ..> ExerciseFactory : valida ejercicios
  useLevelSession --> sessionMachine : dispatch(evento)
  useLevelSession ..> EXERCISE_COMPONENTS : elige componente
  useUserProgress --> EventBus : on(LEVEL_COMPLETED)
  useUserProgress --> ProgressRepository : persiste
```

## 2.2 Máquina de estados de la sesión de nivel

```mermaid
stateDiagram-v2
  [*] --> answering
  answering --> answering: SUBMIT (incompleta) / aviso, sin perder vida
  answering --> answering: USE_HINT / +1 pista por ejercicio
  answering --> feedback: SUBMIT (correcta) / hits+1, vibración de éxito
  answering --> feedback: SUBMIT (incorrecta, quedan vidas) / vida−1
  answering --> gameOver: SUBMIT (incorrecta, sin vidas)
  feedback --> answering: CONTINUE tras error / reintenta el mismo ejercicio
  feedback --> answering: CONTINUE tras acierto / siguiente ejercicio
  feedback --> completed: CONTINUE tras acierto en el último
  completed --> answering: RESTART
  gameOver --> answering: RESTART
  completed --> [*]
```

Los eventos que no figuran en la tabla `TRANSITIONS` se ignoran, por ejemplo un doble toque en «Continuar» durante la animación. El reducer es una función pura con tests en `levels/domain/__tests__`.

## 2.3 Máquina de estados de la navegación raíz

```mermaid
stateDiagram-v2
  [*] --> loading
  loading --> login: sin sesión
  loading --> main: con sesión
  login --> register
  register --> login
  register --> verifySignup: registro OK
  verifySignup --> main: código válido
  login --> verifyRecovery: recuperar contraseña (se pausa la navegación)
  verifyRecovery --> resetPassword: código válido
  resetPassword --> login: contraseña actualizada
  main --> login: cerrar sesión (con confirmación)
  state gate <<choice>>
  loading --> gate
  gate --> AppGate: mantenimiento / versión mínima
```

## 2.4 Repository con respaldo en tres niveles

```mermaid
flowchart LR
  A["getLevels()"] --> B{"¿Supabase responde<br/>con datos válidos?"}
  B -- sí --> C["LevelBuilder.lenient()<br/>omite ejercicios inválidos"] --> D["guarda caché"] --> R1["source: remote"]
  B -- no --> E{"¿hay caché?"}
  E -- sí --> R2["source: cache"]
  E -- no --> R3["catálogo empaquetado<br/>source: local"]
```
