# Replicar el despliegue en otro sitio

Guía corta para publicar un sitio con la misma arquitectura de Punto Neutro, con los pasos en el orden que funcionó y los errores que ya resolvimos.

```
Navegador ─► Cloudflare Pages ──┬─► sitio estático (React + Vite)
                                └─► /api/* ─► Function proxy ─► API en Render (Express + Prisma) ─► Supabase (PostgreSQL)
```

| Pieza | Servicio | Plan gratuito: lo que hay que saber |
|---|---|---|
| Sitio + proxy `/api` | Cloudflare Pages | Sin límites relevantes |
| API | Render | Se duerme tras ~15 min sin visitas; la primera respuesta tarda 30–60 s |
| Base de datos | Supabase | 500 MB; se pausa tras 7 días sin actividad |

**Orden obligatorio:** Supabase → Render → Cloudflare. Cada paso necesita datos del anterior.

---

## 0. Antes de empezar

- Cuentas en **GitHub**, **Supabase**, **Render** y **Cloudflare** (todas pueden entrar con GitHub).
- **Node 22.18 o superior** y **pnpm 10** en tu PC (`node -v` para revisar).
- El código preparado para esta arquitectura. Si el proyecto nuevo no viene de este repositorio, pásale a Claude Code el prompt de [`prompt-claude-code.md`](prompt-claude-code.md) antes de seguir.

Lo que el código debe tener (si copias este repo, ya está):

| Archivo | Para qué |
|---|---|
| `server/prisma.config.ts` | Migraciones por `DIRECT_URL` (o `DATABASE_URL` si no existe) |
| `server/src/lib/pgConfig.ts` | Verifica el SSL de Supabase con `DATABASE_SSL_CA` |
| Migración `enable_rls` + `server/tests/db.test.ts` | RLS en todas las tablas: la Data API de Supabase no ve nada |
| `render.yaml` | Blueprint de la API en Render |
| `web/functions/api/[[path]].ts` | Proxy de Pages hacia la API, con `X-Proxy-Secret` |
| `web/public/_headers` | Cabeceras de seguridad y caché del sitio |
| `web/.node-version` | Fija Node 22.22.0 para el build de Pages |

---

## 1. Supabase: la base de datos

1. **New project**.
   - **Region**: la más cercana a Render. Render en *Oregon* corresponde a **West US** en Supabase.
   - **Database password**: **solo letras y números**. Así no hay que codificar símbolos en las URLs. Guárdala.
2. Botón **Connect → Connection string**. Copia **dos** URLs:

   | Método | Variable | Forma |
   |---|---|---|
   | **Transaction pooler** | `DATABASE_URL` | `postgresql://postgres.<ref>:<clave>@aws-X-<region>.pooler.supabase.com:6543/postgres` |
   | **Session pooler** | `DIRECT_URL` | **La misma URL** con el puerto `5432` |

   > ⚠️ **Nunca uses la "Direct connection"** (`db.<ref>.supabase.co`): solo funciona por IPv6 y Render no tiene IPv6. En tu PC puede funcionar y engañarte.
   >
   > Revisa que cada URL tenga **un solo `@`**, el usuario **`postgres.<ref>`** (no solo `postgres`) y la clave **sin corchetes**.

3. **Project Settings → Database → SSL Configuration → Download certificate** (`prod-ca-2021.crt`). Guárdalo fuera del repositorio.

## 2. Tu PC: crear las tablas

1. `cp server/.env.example server/.env` y completa `DATABASE_URL` y `DIRECT_URL` con las URLs del paso 1.
2. Agrega el certificado en **una sola línea**. Este comando de PowerShell la deja en el portapapeles; después pégala en `server/.env`:

   ```powershell
   'DATABASE_SSL_CA="' + ((Get-Content -Raw "RUTA\prod-ca-2021.crt").Trim() -replace "`r?`n", '\n') + '"' | Set-Clipboard
   ```

   Debe quedar una línea de unos 1400 caracteres. Si mide ~100, pegaste un ejemplo y no el certificado.

3. Desde `server/`:

   ```bash
   pnpm install
   pnpm db:deploy     # crea las tablas en Supabase
   ```

   Debe decir *All migrations have been successfully applied* y mostrar el host `...pooler.supabase.com:5432`.

   > `TEST_DATABASE_URL` debe apuntar **siempre** a una base local. Los tests borran tablas.

4. Verifica y sube el código a la rama que vas a publicar (`main`):

   ```bash
   pnpm typecheck && pnpm test && pnpm build
   git push origin main
   ```

## 3. Render: la API

1. Genera el secreto compartido con Cloudflare y **guárdalo**:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" | Set-Clipboard
   ```

2. <https://dashboard.render.com> → **New → Blueprint**. Elige el repositorio y la rama `main`.
3. Completa las variables:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | Transaction pooler (puerto **6543**) |
   | `DIRECT_URL` | Session pooler (puerto **5432**) |
   | `DATABASE_SSL_CA` | Contenido del `.crt` **tal cual, en varias líneas** (ábrelo con el Bloc de notas), con `BEGIN` y `END` |
   | `PROXY_SECRET` | El del punto 1 |
   | `SEED_ADMIN_EMAIL` | Correo de la primera cuenta administradora |
   | `SEED_ADMIN_PASSWORD` | Mínimo 10 caracteres; no la del ejemplo |

   `JWT_SECRET`, `NODE_ENV`, `NODE_VERSION` y `TRUST_PROXY=2` ya vienen en `render.yaml`.

4. **Apply**. El build instala, compila, aplica las migraciones y carga el contenido inicial con la cuenta admin.
5. Verifica con la URL del servicio (`https://<servicio>.onrender.com`):

   | URL | Respuesta correcta |
   |---|---|
   | `/api/health` | `{"ok":true}` |
   | `/api/site` (o cualquier otra ruta de la API) | `{"error":"Acceso directo no permitido."}`: la API solo atiende al proxy |

   > Si cambias una variable en Render: **Save Changes → Manual Deploy → Deploy latest commit**. Un reintento de un deploy viejo puede usar los valores anteriores.

## 4. Cloudflare Pages: el sitio

1. <https://dash.cloudflare.com> → **Workers & Pages → Create → Pages → Connect to Git** → repositorio, rama `main`.
2. **Build**:

   | Campo | Valor |
   |---|---|
   | Framework preset | `None` |
   | Root directory | `web` |
   | Build command | `cd .. && npx pnpm@10.28.0 install --frozen-lockfile --filter web && cd web && npx pnpm@10.28.0 run build` |
   | Build output directory | `dist` |

3. **Settings → Variables and Secrets** (Production; también Preview si la usas):

   | Nombre | Tipo | Valor |
   |---|---|---|
   | `API_ORIGIN` | Text | `https://<servicio>.onrender.com`, **sin barra final** |
   | `PROXY_SECRET` | Secret | **El mismo** que en Render |
   | `SKIP_DEPENDENCY_INSTALL` | Text | `true` |
   | `NODE_VERSION` | Text | `22.22.0` |

4. **Deployments → Retry deployment** (las variables solo se aplican en un deploy nuevo).
5. Verifica en `https://<proyecto>.pages.dev`: la portada carga con contenido, `/api/health` responde `{"ok":true}` y `/admin` permite entrar con `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

## 5. Después de publicar

- **Panel → Mi cuenta**: cambia la contraseña inicial.
- **Supabase → Project Settings → Data API**: desactívala (la app no la usa; RLS ya la bloquea, esto es una segunda capa).
- **Supabase → Database → SSL Configuration**: activa *Enforce SSL*.
- **Supabase → Advisors → Security Advisor**: no debe aparecer *RLS disabled*. El aviso *RLS enabled, no policy* es lo esperado.
- **Dominio propio**: solo en Cloudflare Pages (**Custom domains**). La API no lo necesita.
- **Cambios de esquema**: `pnpm db:migrate` en local con Postgres local, y luego push. Render aplica la migración en el build. Cada tabla nueva lleva `ENABLE ROW LEVEL SECURITY` en su migración.

---

## Errores que ya nos pasaron

| Síntoma | Causa | Solución |
|---|---|---|
| `P1001: Can't reach database server at db.<ref>.supabase.co` (en Render) | URL de *Direct connection* (IPv6) | Usar el **pooler**: `aws-X-<region>.pooler.supabase.com` |
| `P1000: Authentication failed ... for 'postgres'` | Falta el ref en el usuario | Usuario **`postgres.<ref>`** |
| `P1000` con usuario correcto | Clave mal escrita, con corchetes, con un `@` de más (`...@db@aws...`) o con símbolos sin codificar | Un solo `@`; símbolos codificados (`@` → `%40`), o mejor una clave sin símbolos |
| `self-signed certificate in certificate chain` | `DATABASE_SSL_CA` falta o está incompleto | Pegar el `.crt` entero (en `.env`, en una línea con `\n`) |
| `db:deploy` se queda pegado | `DIRECT_URL` apunta al puerto `6543` | `DIRECT_URL` usa `5432` (Session pooler) |
| El build de Pages falla en un script `.ts` | Node menor a 22.18 | `NODE_VERSION=22.22.0` y `web/.node-version` |
| El sitio dice *No pudimos cargar esta sección* | Pages no llega a la API | `API_ORIGIN` sin barra final y `/api/health` respondiendo en Render |
| `/api/...` responde *Acceso directo no permitido* a través de Pages | `PROXY_SECRET` distinto en Render y Cloudflare | Copiar el mismo valor en ambos y volver a desplegar los dos |
| El login del panel vuelve siempre al formulario | La cookie es `Secure` | `NODE_ENV=production` en Render y sitio por **https** |
| Todos los envíos se bloquean por "demasiados intentos" | `TRUST_PROXY` mal | `TRUST_PROXY=2` en Render (Cloudflare + balanceador) |

## Resumen de variables

| Variable | `server/.env` (local) | Render | Cloudflare Pages |
|---|---|---|---|
| `DATABASE_URL` | Postgres local o pooler 6543 | Pooler **6543** | — |
| `DIRECT_URL` | Opcional (pooler 5432) | Pooler **5432** | — |
| `DATABASE_SSL_CA` | Una línea con `\n` | Varias líneas | — |
| `TEST_DATABASE_URL` | **Siempre local** | — | — |
| `JWT_SECRET` | Cualquiera en local | Generado por Render | — |
| `PROXY_SECRET` | Vacío | Secreto | **El mismo** (Secret) |
| `TRUST_PROXY` | `1` | `2` | — |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Ejemplo | Reales | — |
| `API_ORIGIN` | — | — | URL de Render, sin `/` final |
| `NODE_VERSION` | — | `22.22.0` | `22.22.0` |
| `SKIP_DEPENDENCY_INSTALL` | — | — | `true` |
