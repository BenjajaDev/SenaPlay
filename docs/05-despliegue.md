# 5. Despliegue

## 5.1 Topología

```mermaid
flowchart TB
  subgraph Dispositivos["Dispositivos de usuarios"]
    AND["📱 Android<br/>APK/AAB (EAS Build)<br/>Hermes · expo-dev-client"]
    IOS["📱 iOS (opcional)"]
    BR["🖥️ Navegador<br/>landing + panel"]
  end

  subgraph CDN["Hosting estático + CDN"]
    WEBH["web/dist<br/>Vercel · Netlify · Cloudflare Pages"]
  end

  subgraph SUPA["Supabase (región sa-east-1 sugerida)"]
    GW["API Gateway<br/>(Kong)"]
    AUTHS["GoTrue<br/>Auth"]
    REST["PostgREST"]
    PG[("PostgreSQL 15+<br/>RLS · triggers · funciones")]
    STOR["Storage (S3)<br/>buckets media · avatars"]
    SCDN["CDN de Storage"]
  end

  subgraph IA["Servidor de IA"]
    API["FastAPI (uvicorn)<br/>ai_module/server.py"]
    MOD["Modelos<br/>MediaPipe · TCN"]
  end

  EAS["☁️ Expo EAS<br/>build + OTA (opcional)"]
  STORE["🛒 Google Play / App Store"]

  BR -- HTTPS --> WEBH
  BR -- "HTTPS (JWT)" --> GW
  AND -- "HTTPS (JWT)" --> GW
  IOS -- "HTTPS (JWT)" --> GW
  AND -- "HTTP(S) LAN o público" --> API
  GW --> AUTHS & REST & STOR
  REST --> PG
  AUTHS --> PG
  STOR --> SCDN
  AND & BR -. "videos / imágenes" .-> SCDN
  API --> MOD
  EAS --> STORE --> AND
```

## 5.2 Componentes y configuración

| Nodo | Artefacto | Configuración |
|---|---|---|
| App móvil | build de EAS (`pnpm build:preview` o producción) | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_AI_SERVER_URL` (en `eas.json` o secretos de EAS) |
| Portal web | `web/dist` (`pnpm --dir web build`) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ANDROID_URL`, `VITE_IOS_URL`. Es una SPA: todas las rutas deben reescribirse a `index.html`. |
| Supabase | SQL de `supabase/` | Ejecutar en orden: `catalog.sql`, `dictionary.sql`, `signs.sql` (solo la primera vez) → `migrations/*.sql` |
| Servidor IA | `ai_module/` | `uvicorn server:app --host 0.0.0.0 --port 8000`. En producción va detrás de HTTPS. |

## 5.3 Puesta en producción (checklist)

1. **Base de datos:** ejecutar las migraciones en orden y verificar localmente con `pnpm test:sql`.
2. **Primer administrador:** `update public.profiles set role = 'admin' where email = '…';` en el SQL Editor.
3. **Auth:** agregar `senaplay://auth/callback` y el dominio del portal a las URL de redirección permitidas.
4. **Portal:** desplegar `web/dist` con reescritura SPA. En Netlify: `/* /index.html 200`. En Vercel: `rewrites` a `/`.
5. **App:** `pnpm verify:bundle`, después `eas build --profile production`.
6. **IA:** publicar el servidor con HTTPS y actualizar `EXPO_PUBLIC_AI_SERVER_URL`.
7. **Configuración remota:** revisar `appVersion.minimum` antes de publicar una versión incompatible.

> ⚠️ Una vez que el contenido se edite desde el panel, **no vuelvas a ejecutar** `catalog.sql`, `dictionary.sql` ni `signs.sql`: truncan las tablas.

## 5.4 Identificadores de la app

| Identificador | Valor |
|---|---|
| Nombre visible | SeñaPlay |
| `slug` (Expo/EAS) | `senaplay` |
| `scheme` (deep links, retorno de OAuth) | `senaplay` → `senaplay://auth/callback` |
| Android `package` / iOS `bundleIdentifier` | `com.benjajadev.senaplay` |
| Prefijo de almacenamiento local | `senaplay.*` (migra `oratiolingo.*` al iniciar) |

**Pasos únicos tras el cambio de identificadores** (antes eran `oratioLingoRN`, `oratiolingo` y `com.benjajadev.oratiolingo`):

1. **EAS:** el `projectId` anterior estaba vinculado al slug viejo y se quitó de `app.json`. Ejecuta `npx eas-cli init`, que crea o vincula el proyecto `senaplay` y agrega el nuevo `projectId`. Luego haz `pnpm build:dev` (el paquete nuevo genera credenciales nuevas).
2. **Supabase → Authentication → URL Configuration:** agrega `senaplay://auth/callback` a las URL de redirección y quita la antigua cuando ya nadie use la versión vieja.
3. **Dispositivos de prueba:** desinstala la app anterior. Android la trata como otra aplicación porque el paquete es distinto.
4. **Proveedores OAuth** (Google, Facebook, X): si alguno tiene configurado el paquete de Android (por ejemplo, SHA-1 más `package`), actualízalo a `com.benjajadev.senaplay`.

## 5.5 Entornos

```mermaid
flowchart LR
  DEV["Desarrollo<br/>dev client + Expo<br/>IA en la LAN"] --> PRE["Preview<br/>APK interno<br/>proyecto Supabase de pruebas"] --> PROD["Producción<br/>tiendas + portal público<br/>Supabase prod"]
```

Cada entorno usa sus propias variables `EXPO_PUBLIC_*` y `VITE_*`. El código no cambia entre entornos.
