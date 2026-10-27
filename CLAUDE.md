# SeñaPlay: guía para Claude

App móvil para aprender Lengua de Señas Chilena (LSCh) con IA, más su portal web y Supabase.

- Antes de tocar código lee la skill `senaplay-frontend`; para cualquier cambio visual, de UX o de movimiento, `senaplay-ui`. Ellas definen la arquitectura, los tokens y la verificación obligatoria.
- La documentación completa está en `docs/` (arquitectura, design system, config remota y guía de desarrollo).

## Skills externas

Además de las propias, `.claude/skills/` tiene copias de skills públicas de diseño y animación, instaladas con [claude-skills](https://github.com/BenjajaDev/claude-skills) (perfiles `diseno,movimiento,react-native,movimiento-web,web-movil`). El origen y el commit de cada una están en [`.claude/skills/README.md`](.claude/skills/README.md).

**No las edites.** Para actualizarlas, cambia el commit en el catálogo y vuelve a ejecutar:

```bash
~/claude-skills/instalar-skills.sh -d . -p diseno,movimiento,react-native,movimiento-web,web-movil
```

### Precedencia

Cuando una skill externa choque con `senaplay-frontend`, `senaplay-ui` o este archivo, **gana el proyecto**, en este orden:

1. Accesibilidad y feedback multimodal: la interfaz es visual primero; nada se comunica solo con color o solo con audio; `useReducedMotion()` en toda animación.
2. Los tokens de `src/shared/theme/tokens/` (paleta en ambos temas, degradés y `theme.motion`) y la tipografía Poppins.
3. Los componentes de `src/shared/ui` y `web/src/ui`.
4. Recién después, el criterio de la skill externa.

Casos concretos:

- `animate-expo` y `apple-design` asumen **Reanimated**, Gesture Handler y Expo Router. SeñaPlay usa `Animated` con el driver nativo y navegación por estado. Toma de ellas el criterio (si conviene animar, en qué hilo corre, interrupción, retroalimentación al presionar) y aplícalo con `shared/ui/motion/animations.js` y `theme.motion`. Instalar Reanimated o Gesture Handler, o migrar a Expo Router, es una decisión grande: proponla antes.
- `frontend-design` pide elegir tipografías y paletas «distintivas», y `ui-ux-pro-max` sugiere paletas por industria. Aquí sirven para la composición, la jerarquía y el ritmo, **no para cambiar colores ni fuentes**. Un color nuevo va en los dos temas de `tokens/colors.js` y debe pasar `contrast.test.js`.
- `pick-ui-library`: consúltala antes de proponer cualquier librería, pero instálala solo con aprobación. Ya existen `Dialog`, `MessageDialog`, `BottomSheet`, toasts (`useFeedback().notify`) y skeletons propios.
- `prototype` y `break-ui` generan pantallas de demostración: déjalas fuera de `src/` y `web/src/` (por ejemplo, en `docs/prototipos/`).
- `animate`, `animation-performance` y `mobile-native` aplican al portal `web/`, no a la app React Native.
- En la pantalla de una seña nada se mueve solo: descarta las propuestas de `find-animation-opportunities` que muevan contenido sin que la persona lo pida.
- `review-animations` es obligatoria antes de commitear un cambio de movimiento.
- `ui-ux-pro-max` se ejecuta desde la raíz con `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<consulta>" --domain <dominio>`. Su `SKILL.md` asume la ruta de plugin (`${CLAUDE_PLUGIN_ROOT}`), que aquí no aplica.
