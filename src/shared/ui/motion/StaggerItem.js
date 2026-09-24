import { useAppTheme } from '../../theme/ThemeProvider';
import FadeInView from './FadeInView';

// Solo los primeros elementos se escalonan: en listas largas, esperar a que
// aparezca el ítem 30 se siente lento. Los demás entran junto al último.
const MAX_STAGGERED = 8;

/**
 * Entrada escalonada para contenido dinámico (tarjetas de niveles, juegos,
 * resultados). Envuelve cada ítem y pásale su `index`:
 *
 *   {items.map((item, index) => (
 *     <StaggerItem key={item.id} index={index}>…</StaggerItem>
 *   ))}
 */
export default function StaggerItem({ index = 0, children, style }) {
  const theme = useAppTheme();
  const step = Math.min(index, MAX_STAGGERED);
  return (
    <FadeInView style={style} delay={step * theme.motion.stagger} distance={12}>
      {children}
    </FadeInView>
  );
}
