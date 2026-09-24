# 1. Arquitectura del sistema

## 1.1 Visión general

La plataforma sigue una arquitectura **cliente–BaaS**. La app móvil y el portal web se conectan directamente a Supabase, que concentra autenticación, base de datos, archivos y autorización. La autorización se resuelve con **Row Level Security (RLS)**, así que no hace falta un servidor de API propio para el CRUD. El reconocimiento de señas es el único servicio a medida: un servidor de IA en Python que usan solo las pantallas de cámara.

```mermaid
flowchart LR
  subgraph Clientes
    APP["📱 App móvil<br/>Expo · React Native"]
    WEB["🖥️ Portal web<br/>Vite · React · TS"]
  end

  subgraph Supabase["☁️ Supabase (BaaS)"]
    AUTH["Auth<br/>correo · OTP · OAuth"]
    DB[("Postgres<br/>+ RLS")]
    STO[["Storage<br/>media · avatars"]]
    RPC["Funciones SQL<br/>save_level · public_stats"]
  end

  AI["🧠 Servidor IA<br/>FastAPI · MediaPipe · TCN"]

  APP -- "JWT · REST (PostgREST)" --> DB
  APP -- "sesión" --> AUTH
  APP -- "avatars" --> STO
  APP -- "landmarks / clips" --> AI
  WEB -- "JWT staff · REST" --> DB
  WEB -- "sesión" --> AUTH
  WEB -- "subida de medios" --> STO
  WEB -- "rpc" --> RPC
  RPC --> DB
  DB -. "políticas RLS<br/>is_staff() / is_admin()" .- AUTH
```

**Decisiones clave**

| Decisión | Motivo |
|---|---|
| Supabase como backend (sin API propia) | El contenido es CRUD con reglas de autorización simples. RLS lo protege en la base de datos misma, así que es imposible saltarse la regla desde un cliente manipulado. |
| La app funciona sin conexión | Cada repositorio intenta primero el servidor, después la caché local y al final los datos empaquetados. La app nunca se queda sin niveles ni diccionario. |
| Configuración remota en tablas (`app_config`, `feature_flags`) | Permite ajustar la app sin publicar versiones y deja cada cambio auditado por trigger. |
| Dominio JS puro y compartido | El portal importa `src/features/*/domain` de la app, así web y móvil validan ejercicios con el mismo código. |

## 1.2 Capas de la app móvil (feature-first + Clean Architecture)

Cada módulo de negocio vive en `src/features/<módulo>/` y se divide en tres capas:

```mermaid
flowchart TB
  subgraph Presentación["Presentación (React / RN)"]
    SCR["Pantallas y hooks<br/>features/*/presentation"]
    UI["Design system<br/>shared/ui · shared/theme"]
  end
  subgraph Dominio["Dominio (JS puro, sin React)"]
    DOM["Entidades y reglas<br/>features/*/domain"]
  end
  subgraph Datos["Datos"]
    REPO["Repositorios<br/>features/*/data"]
    LOCAL["Respaldo local<br/>features/*/data/local"]
  end
  subgraph Core["Infraestructura transversal (core)"]
    DI["ServicesProvider (DI)"]
    EV["EventBus"]
    ST["jsonStorage"]
    SB["cliente Supabase"]
    FB["haptics · a11y"]
  end

  SCR --> UI
  SCR --> DOM
  SCR -->|"useServices()"| DI
  DI --> REPO
  REPO --> DOM
  REPO --> SB
  REPO --> ST
  REPO --> LOCAL
  SCR --> EV
  SCR --> FB
```

**Regla de dependencias.** Presentación depende de Dominio y de los contratos de Datos. Dominio no depende de nada: no importa React, React Native ni Supabase. Solo `core/di/ServicesProvider.js` conoce las implementaciones concretas.

### Módulos

| Módulo | Dominio | Datos | Presentación |
|---|---|---|---|
| `auth` | `validation.js` | `SupabaseAuthRepository` | Login, Registro, Verificación OTP, Nueva contraseña, `SessionProvider` |
| `levels` | `ExerciseFactory`, `LevelBuilder`, `evaluateAnswer`, `sessionMachine`, `scoring`, `levelProgress` | `CatalogRepository` (remoto → caché → local) | Ruta de niveles, sesión de nivel, ejercicios, pistas, celebración |
| `progress` | `streak`, `livesPolicy` | `ProgressRepository` (AsyncStorage) | Progreso, `useUserProgress` |
| `signs` | `signDescription` | `SignsRepository` | `SignImage` |
| `dictionary` | — | usa `signs` | Diccionario con búsqueda |
| `games` | — | — | Memoria, Quiz |
| `camera` | — | `practiceSigns` | Práctica, Deletreo, Traducción, Señas dinámicas |
| `profile` | — | `SupabaseProfileRepository` | Perfil, preferencias |
| `videos` | — | `MediaRepository` | Videos |
| `remoteConfig` | `remoteConfig.js` (merge, flags, gates) | `RemoteConfigRepository` | Provider, pantalla de bloqueo, avisos |

### Estructura de carpetas

```
App.js · index.js                 entrada de Expo → src/app/AppRoot
src/
  app/                            composición: AppRoot (providers), RootNavigator, MainAppScreen
  core/                           config/env · di · events · storage · supabase · feedback · a11y · result
  shared/
    theme/                        tokens (colores, degradés, escalas) · ThemeProvider · fuentes
    ui/                           átomos, moléculas, feedback (diálogos, toast, overlay), carga y movimiento
  features/<módulo>/{domain,data,presentation}
web/                              portal (landing + panel) · reutiliza @domain y @core
supabase/                         SQL base + migrations/ + tests/ (RLS)
ai_module/                        servidor de IA (Python)
docs/                             esta documentación
```

## 1.3 Flujo de datos

### Arranque de la app

```mermaid
sequenceDiagram
  autonumber
  participant U as Usuario
  participant R as AppRoot
  participant S as SessionProvider
  participant C as RemoteConfigProvider
  participant K as CatalogProvider
  participant SB as Supabase

  U->>R: abre la app
  R->>R: carga fuentes y preferencias (vibración)
  R->>S: getSession()
  S->>SB: auth.getSession
  SB-->>S: sesión + rol (profiles)
  S->>C: userId, isAdmin
  C->>C: config en caché (instantánea)
  C->>SB: app_config + feature_flags (en segundo plano)
  SB-->>C: filas → merge + evaluación de flags
  alt mantenimiento o versión mínima
    C-->>U: AppGateScreen (bloqueo)
  else operativa
    K->>K: catálogo local (instantáneo)
    K->>SB: levels + exercises
    SB-->>K: filas → LevelBuilder (valida) → caché
    K-->>U: MainAppScreen
  end
```

### Completar un nivel (Observer)

```mermaid
sequenceDiagram
  autonumber
  participant L as LevelSessionScreen
  participant M as sessionMachine
  participant H as useLevelSession
  participant E as EventBus
  participant P as useUserProgress
  participant ST as ProgressRepository

  L->>H: submit()
  H->>M: SUBMIT(evaluateAnswer)
  M-->>H: estado nuevo
  H->>H: efectos (háptica, anuncio, vida perdida)
  L->>H: continue()
  H->>M: CONTINUE → completed
  H->>L: onComplete(resultado)
  L->>E: emit(LEVEL_COMPLETED)
  E->>P: listener
  P->>P: completeLevel() (desbloqueo, mejor puntaje)
  P->>ST: saveLevelProgress()
```

## 1.4 Portal web

```mermaid
flowchart LR
  subgraph web["web/src"]
    R["App.tsx<br/>rutas + lazy"] --> L["features/landing"]
    R --> A["features/admin/*"]
    A --> UIW["ui/* (espejo del DS)"]
    A --> RP["data/repositories.ts"]
    RP --> D["lib/domain.ts"]
    D -. alias @domain / @core .-> SH["../src/features/*/domain<br/>../src/core/result.js"]
    TK["scripts/syncTokens.mjs"] -. genera .-> CSS["styles/tokens.generated.css"]
    TK -. lee .-> TOK["../src/shared/theme/tokens"]
  end
```

Las rutas del panel son `/admin` (resumen), `/admin/levels`, `/admin/levels/:id`, `/admin/dictionary`, `/admin/vocabulary` y `/admin/media`. Las rutas `/admin/config`, `/admin/flags`, `/admin/audit` y `/admin/users` son solo para administradores. El panel se carga bajo demanda: la landing no descarga ese código.
