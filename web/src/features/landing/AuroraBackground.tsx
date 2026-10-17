import { useEffect, useRef, type CSSProperties } from 'react';

/**
 * Fondo de la landing: «aurora» de marca. Manchas grandes y difuminadas en
 * los colores oficiales de SeñaPlay que se desplazan y se mezclan muy lento
 * (ciclos de ~30 s), más una mancha suave que sigue al cursor con retraso.
 * Excepción documentada a la regla de tokens: son colores de marca fijos,
 * iguales en ambos temas, con opacidad baja para no afectar la legibilidad.
 *
 * - Canvas fijo detrás de todo (z-index negativo), sin eventos de puntero y
 *   oculto a lectores de pantalla.
 * - Se dibuja a un cuarto de resolución y el navegador lo escala: los
 *   degradados ya son difusos, así que no se nota y cuesta muy poco.
 * - «Reducir movimiento»: se dibuja una sola aurora estática.
 * - requestAnimationFrame que se detiene con la pestaña oculta.
 */
const SCALE = 0.25;
const CYCLE_MS = 30000;

type Blob = {
  rgb: string;
  alpha: number;
  /** Centro y amplitud del recorrido, en fracciones del ancho/alto. */
  cx: number;
  cy: number;
  ax: number;
  ay: number;
  /** Radio en fracción del lado mayor de la ventana. */
  radius: number;
  /** Velocidad relativa al ciclo y desfase, para que no se muevan al unísono. */
  speed: number;
  phase: number;
};

const BLOBS: Blob[] = [
  { rgb: '143, 30, 174', alpha: 0.35, cx: 0.2, cy: 0.25, ax: 0.18, ay: 0.12, radius: 0.55, speed: 1, phase: 0 }, // #8f1eae
  { rgb: '211, 51, 255', alpha: 0.3, cx: 0.78, cy: 0.3, ax: 0.15, ay: 0.18, radius: 0.5, speed: 0.8, phase: 2.1 }, // #d333ff
  { rgb: '255, 188, 16', alpha: 0.25, cx: 0.55, cy: 0.82, ax: 0.22, ay: 0.1, radius: 0.45, speed: 0.65, phase: 4.2 }, // #ffbc10
  { rgb: '211, 51, 255', alpha: 0.22, cx: 0.15, cy: 0.85, ax: 0.12, ay: 0.14, radius: 0.4, speed: 1.2, phase: 1.3 }, // #d333ff
];
const FOLLOWER = { rgb: '211, 51, 255', alpha: 0.18, radius: 0.22 };

const canvasStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  width: '100%',
  height: '100%',
  zIndex: -1,
  pointerEvents: 'none',
  display: 'block',
};

export function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;

    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reduced = Boolean(motionQuery?.matches);
    let width = 0;
    let height = 0;
    let frame = 0;
    let resizeFrame = 0;
    // Tiempo acumulado solo mientras se anima: al volver a la pestaña sigue donde quedó.
    let elapsed = 0;
    let lastTime = 0;
    let pointer: { x: number; y: number } | null = null;
    const follower = { x: 0.5, y: 0.4 };

    const spot = (x: number, y: number, radius: number, rgb: string, alpha: number) => {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(${rgb}, ${alpha})`);
      gradient.addColorStop(0.55, `rgba(${rgb}, ${alpha * 0.45})`);
      gradient.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    };

    const draw = () => {
      const side = Math.max(width, height);
      const angle = (elapsed / CYCLE_MS) * Math.PI * 2;
      ctx.clearRect(0, 0, width, height);
      BLOBS.forEach((blob) => {
        // Recorrido tipo Lissajous: suave, sin cambios bruscos, nunca se repite igual entre manchas.
        const x = (blob.cx + blob.ax * Math.sin(angle * blob.speed + blob.phase)) * width;
        const y = (blob.cy + blob.ay * Math.cos(angle * blob.speed * 0.8 + blob.phase)) * height;
        const breathe = 1 + 0.08 * Math.sin(angle * blob.speed * 1.3 + blob.phase);
        spot(x, y, blob.radius * side * breathe, blob.rgb, blob.alpha);
      });
      if (pointer) spot(follower.x * width, follower.y * height, FOLLOWER.radius * side, FOLLOWER.rgb, FOLLOWER.alpha);
    };

    const resize = () => {
      width = Math.max(1, Math.round(window.innerWidth * SCALE));
      height = Math.max(1, Math.round(window.innerHeight * SCALE));
      canvas.width = width;
      canvas.height = height;
      draw();
    };

    const loop = (time: number) => {
      // Acotado para que volver de otra pestaña no produzca un salto.
      elapsed += lastTime ? Math.min(time - lastTime, 50) : 0;
      lastTime = time;
      if (pointer) {
        // La mancha del cursor lo sigue con retraso: se siente viva, no pegada al mouse.
        follower.x += (pointer.x - follower.x) * 0.04;
        follower.y += (pointer.y - follower.y) * 0.04;
      }
      draw();
      frame = requestAnimationFrame(loop);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      lastTime = 0;
      if (reduced) {
        pointer = null;
        draw();
      } else if (document.visibilityState !== 'hidden') {
        frame = requestAnimationFrame(loop);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') cancelAnimationFrame(frame);
      else start();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (reduced || event.pointerType === 'touch') return;
      const next = { x: event.clientX / window.innerWidth, y: event.clientY / window.innerHeight };
      if (!pointer) Object.assign(follower, next);
      pointer = next;
    };
    const onPointerLeave = () => {
      pointer = null;
    };
    const onMotionChange = () => {
      reduced = Boolean(motionQuery?.matches);
      start();
    };
    const onResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    };

    resize();
    start();
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('blur', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    motionQuery?.addEventListener('change', onMotionChange);

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(resizeFrame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('blur', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery?.removeEventListener('change', onMotionChange);
    };
  }, []);

  return <canvas ref={canvasRef} style={canvasStyle} aria-hidden="true" />;
}
