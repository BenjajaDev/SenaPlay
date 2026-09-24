# Documentación técnica — SeñaPlay

SeñaPlay es una plataforma para aprender **Lengua de Señas Chilena (LSCh)**, compuesta por tres piezas:

| Pieza | Tecnología | Carpeta |
|---|---|---|
| App móvil | Expo SDK 57 · React Native 0.86 · JavaScript | `src/`, `App.js` |
| Portal web: landing y panel de administración | Vite 8 · React 19 · TypeScript | `web/` |
| Backend (BaaS) | Supabase: Postgres + Auth + Storage + RLS | `supabase/` |
| Servicio de IA | Python · FastAPI · MediaPipe · TCN | `ai_module/` |

## Índice

1. [Arquitectura del sistema](01-arquitectura.md): capas, módulos y flujo de datos.
2. [Patrones de diseño](02-patrones-de-diseno.md): Repository, Factory, Builder, State Machine, Observer, Strategy y DI.
3. [Modelo de dominio y datos](03-modelo-de-dominio.md): diagrama de clases y modelo entidad-relación.
4. [Casos de uso](04-casos-de-uso.md): estudiantes (móvil) y administradores (web).
5. [Despliegue](05-despliegue.md): topología, entornos y puesta en producción.
6. [Trazabilidad](06-trazabilidad.md): matriz de requerimientos, módulos y endpoints.
7. [Sistema de diseño](07-design-system.md): tokens, degradés, componentes, accesibilidad y movimiento.
8. [Configuración remota](08-configuracion-remota.md): claves, flags y guía operativa.
9. [Guía de desarrollo](09-guia-desarrollo.md): instalación, scripts, pruebas y convenciones.

Los diagramas usan sintaxis **Mermaid**; GitHub y la mayoría de los editores los muestran directamente. Además, `scripts/checkMermaid.cjs` valida que todos compilen.

> Material de referencia lingüística: `Diccionario_LSCh_A-H.pdf` y `pages/` (MINEDUC).
