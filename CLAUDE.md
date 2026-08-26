# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio (Expo / React Native).

## Skills de frontend — usar siempre

Este proyecto tiene skills de diseño y animación instaladas en `.claude/skills/`
(symlinks a `.agents/skills/`). **Cualquier tarea que toque UI, estilos, layout,
componentes visuales, interacción o animación debe empezar invocando la(s)
skill(s) relevante(s) antes de escribir código**, no solo cuando el usuario las
menciona explícitamente.

Flujo recomendado para trabajo de frontend:

1. **Dirección visual / decisiones de diseño nuevas** → `frontend-design` y
   `ui-ux-pro-max` (paletas, tipografía, sistemas de diseño, accesibilidad,
   patrones de UX específicos del stack).
2. **Elegir una librería de UI** (toasts, modales, listas virtualizadas,
   gestos, etc.) → `pick-ui-library` antes de instalar una dependencia nueva.
3. **Animaciones e interacción**:
   - React Native / Expo → `animate-expo`
   - Web/general → `animate`
   - Vocabulario y criterios de animación → `animation-vocabulary`
   - Detectar dónde falta o sobra animación → `find-animation-opportunities`
   - Mejorar animaciones existentes → `improve-animations`
   - Revisar animaciones ya implementadas contra estándares → `review-animations`
4. **Estética general / filosofía de diseño de producto** → `emil-design-eng`
   y `apple-design` (especialmente relevante en iOS/RN).
5. **Prototipos rápidos de pantallas** → `prototype`.
6. **Toasts/notificaciones** (si se usa Sonner o equivalente) → `ask-sonner`.
7. **Código nativo Swift** (si se toca código nativo iOS) → `write-swift`.

No se debe omitir este paso por considerarlo "obvio" o porque el cambio
parezca pequeño: incluso un ajuste de estilo o una micro-interacción debe
pasar primero por la skill correspondiente para mantener consistencia con
las decisiones de diseño ya tomadas en el proyecto.

## Stack

- Expo (`~54`) + React Native (`0.81`) + React 19
- Navegación: `@react-navigation/native` + `native-stack`
- Backend: Supabase (`@supabase/supabase-js`)
- Almacenamiento local: `@react-native-async-storage/async-storage`
