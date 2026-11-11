# Prompt para Claude Code

Úsalo en el repositorio del sitio **nuevo**, antes de seguir el [README](README.md). Claude revisa el proyecto y lo deja listo para Cloudflare Pages + Render + Supabase.

Antes de pegarlo:

- Cambia `[NOMBRE]` por el nombre del sitio (se usa en los servicios, ej. `mi-sitio-api`).
- Si el proyecto nuevo es una copia de Punto Neutro, casi todo ya existe y Claude solo debería renombrar y verificar.

---

```text
Quiero publicar este proyecto con esta arquitectura:

  Navegador → Cloudflare Pages (sitio estático + Pages Function que reenvía /api/*)
            → API Node en Render → PostgreSQL en Supabase

Nombre del sitio: [NOMBRE]. Los servicios se llamarán [NOMBRE]-api (Render) y [NOMBRE] (Pages).

Primero revisa el repositorio y dime en pocas líneas qué stack tiene (frontend, backend, ORM,
gestor de paquetes, versión de Node) y qué falta de la lista de abajo. Si el stack es distinto
(otro ORM, sin backend, Next.js, etc.), propón la adaptación equivalente antes de cambiar nada.
Como referencia de una implementación que ya funciona, sirve el repositorio
BenjajaDev/PUNTO-NEUTRO (pnpm + React/Vite en web/, Express 5 + Prisma 7 con @prisma/adapter-pg
en server/).

Lo que tiene que quedar:

1. Base de datos (Supabase)
   - Dos URLs: DATABASE_URL para la API (Transaction pooler, puerto 6543) y DIRECT_URL para las
     migraciones (Session pooler, puerto 5432), porque las migraciones usan advisory locks que
     el modo transacción no conserva. Con Prisma 7: en prisma.config.ts,
     datasource.url = process.env.DIRECT_URL || env('DATABASE_URL').
   - SSL verificado: variable opcional DATABASE_SSL_CA (PEM; aceptar también "\n" literales).
     Si existe, quitar sslmode/sslrootcert/sslcert/sslkey/uselibpqcompat de la URL (pg les da
     prioridad sobre la opción ssl) y pasar ssl: { ca, rejectUnauthorized: true } al pool.
     Si no existe, usar la URL tal cual (Postgres local).
   - En la API, nada que dependa de la sesión de Postgres (SET de sesión, sentencias
     preparadas con nombre): el pooler en modo transacción no lo conserva.
   - Una migración que active ROW LEVEL SECURITY en todas las tablas de public (incluida
     _prisma_migrations) y que, solo si existen los roles anon/authenticated, les haga REVOKE de
     tablas y secuencias y de los default privileges. Así la Data API de Supabase no ve nada y
     la migración no falla en Postgres local.
   - Un test que falle si alguna tabla de public no tiene RLS.
   - Los tests usan TEST_DATABASE_URL (base local separada). Al correrlos, sobrescribir
     DATABASE_URL y DIRECT_URL con ella, borrar DATABASE_SSL_CA y abortar si TEST_DATABASE_URL
     coincide con DATABASE_URL o DIRECT_URL.

2. API (Render)
   - render.yaml con un servicio web Node, sin base de datos de Render:
     buildCommand: instalar con lockfile congelado e incluir devDependencies (--prod=false),
     compilar, aplicar migraciones (migrate deploy) y correr un seed idempotente que solo
     cargue contenido si la base está vacía. healthCheckPath: /api/health.
     Variables: NODE_VERSION, NODE_ENV=production, JWT_SECRET (generateValue), TRUST_PROXY=2,
     y con sync: false: DATABASE_URL, DIRECT_URL, DATABASE_SSL_CA, PROXY_SECRET y las
     credenciales de la primera cuenta admin.
   - Middleware: si PROXY_SECRET está definido, toda /api excepto /api/health exige la
     cabecera X-Proxy-Secret con ese valor (403 "Acceso directo no permitido." si no).
   - app.set('trust proxy', TRUST_PROXY) para leer la IP real detrás de Cloudflare + Render.
   - Cookies de sesión httpOnly, sameSite lax y secure en producción.
   - Variables de entorno validadas al arrancar, con mensajes claros si falta alguna.

3. Sitio (Cloudflare Pages, root directory = carpeta del frontend)
   - functions/api/[[path]].ts: reenvía la petición a API_ORIGIN conservando ruta y query;
     agrega X-Forwarded-For (desde CF-Connecting-IP), X-Forwarded-Proto=https,
     X-Forwarded-Host y X-Proxy-Secret; usa redirect: 'manual'; responde 500 si falta
     API_ORIGIN y 502 si la API no responde.
   - public/_headers con cabeceras de seguridad (CSP acorde a lo que el sitio realmente carga,
     X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) y caché inmutable en
     /assets/*.
   - .node-version con 22.22.0 en la raíz y en la carpeta del frontend.
   - El cliente llama siempre a rutas relativas /api/... (mismo dominio, sin CORS).
   - Rutas del SPA que funcionen al recargar (no incluir un 404.html).

4. Documentación y ejemplos
   - .env.example con todas las variables, comentadas, sin valores reales.
   - Un DESPLIEGUE.md breve: orden Supabase → Render → Cloudflare, qué variable va en cada
     servicio y cómo verificar (/api/health = {"ok":true}; cualquier otra ruta directa a Render
     = 403).

Reglas:
- No abras ni muestres server/.env ni ningún .env real; si necesitas saber si una variable
  existe, imprime solo sí/no.
- Nunca ejecutes migrate reset, db push --force-reset ni borres datos de una base que no sea
  la local de pruebas.
- No hagas commit ni push sin preguntarme.
- Al terminar, ejecuta typecheck, tests y build (con Postgres local en Docker si hace falta) y
  muéstrame el resultado real. Luego dame una tabla con las variables que debo configurar en
  Render y en Cloudflare Pages.
```
