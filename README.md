# SeñaPlay · OratioLingo

Plataforma para aprender **Lengua de Señas Chilena (LSCh)** jugando: niveles progresivos, diccionario, juegos, práctica con cámara e inteligencia artificial, y un portal web con landing y panel de administración.

| Pieza | Carpeta | Stack |
|---|---|---|
| App móvil | `src/`, `App.js` | Expo SDK 57 · React Native 0.86 · JavaScript |
| Portal web (landing + backoffice) | `web/` | Vite · React 19 · TypeScript |
| Backend | `supabase/` | Postgres · Auth · Storage · RLS |
| IA | `ai_module/` | Python · FastAPI · MediaPipe |

## Inicio rápido

```bash
pnpm install
pnpm start                 # app (requiere development build: pnpm build:dev)
pnpm test                  # tests de la app (Jest)
pnpm verify:bundle         # compila el bundle de Android con Hermes

cd web && pnpm install
pnpm dev                   # portal en http://localhost:5173
pnpm test && pnpm build
```

Base de datos: ejecuta `supabase/migrations/*.sql` en orden en el SQL Editor de Supabase y nombra al primer administrador (ver `docs/05-despliegue.md`).

## Documentación

Toda la documentación técnica, con diagramas de arquitectura, patrones, clases, casos de uso, despliegue y trazabilidad, está en **[`docs/`](docs/README.md)**.
