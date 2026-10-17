import { useEffect, useRef, type CSSProperties } from 'react';

/**
 * Fondo de la landing: red de partículas («constelación») que evoca la
 * conexión entre personas. Colores oficiales de SeñaPlay con opacidad baja
 * para no competir con textos ni botones. Excepción documentada a la regla
 * de tokens: son colores de marca fijos, iguales en ambos temas.
 *
 * - Canvas fijo detrás de todo (z-index negativo), sin eventos de puntero y
 *   oculto a lectores de pantalla.
 * - El mouse se lee desde window: las partículas cercanas se apartan un poco
 *   y se unen al cursor con líneas tenues.
 * - «Reducir movimiento»: se dibuja una sola constelación estática.
 * - requestAnimationFrame que se detiene con la pestaña oculta.
 */
const BRAND_RGB = ['211, 51, 255', '255, 188, 16', '143, 30, 174']; // #d333ff, #ffbc10, #8f1eae
const DOT_ALPHA = 0.35;
const LINE_ALPHA = 0.25;
const LINK_DISTANCE = 140;
const POINTER_RADIUS = 150;
const POINTER_FORCE = 0.6;
const AREA_PER_PARTICLE = 16000;

const canvasStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  width: '100%',
  height: '100%',
  zIndex: -1,
  pointerEvents: 'none',
  display: 'block',
};

type Particle = { x: number; y: number; vx: number; vy: number; baseVx: number; baseVy: number; radius: number; color: string };

function createParticle(width: number, height: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.12 + Math.random() * 0.22;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx,
    vy,
    baseVx: vx,
    baseVy: vy,
    radius: 1.2 + Math.random() * 1.6,
    color: BRAND_RGB[Math.floor(Math.random() * BRAND_RGB.length)],
  };
}

function particleCount(width: number, height: number) {
  const max = width < 640 ? 40 : 90;
  return Math.max(18, Math.min(max, Math.round((width * height) / AREA_PER_PARTICLE)));
}

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;

    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reduced = Boolean(motionQuery?.matches);
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;
    let lastTime = 0;

    const resize = () => {
      const previousWidth = width || window.innerWidth;
      const previousHeight = height || window.innerHeight;
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Se conservan las partículas (reescaladas) para que el cambio de
      // tamaño no «reinicie» el cielo; solo se agregan o quitan las que sobran.
      particles.forEach((particle) => {
        particle.x *= width / previousWidth;
        particle.y *= height / previousHeight;
      });
      const target = particleCount(width, height);
      if (particles.length > target) particles = particles.slice(0, target);
      while (particles.length < target) particles.push(createParticle(width, height));
      if (reduced) draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.hypot(dx, dy);
          if (distance < LINK_DISTANCE) {
            ctx.strokeStyle = `rgba(${a.color}, ${LINE_ALPHA * (1 - distance / LINK_DISTANCE)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        if (pointer) {
          const distance = Math.hypot(a.x - pointer.x, a.y - pointer.y);
          if (distance < POINTER_RADIUS) {
            ctx.strokeStyle = `rgba(${a.color}, ${LINE_ALPHA * (1 - distance / POINTER_RADIUS)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
        }
      }
      particles.forEach((particle) => {
        ctx.fillStyle = `rgba(${particle.color}, ${DOT_ALPHA})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const step = (delta: number) => {
      const margin = 20;
      particles.forEach((particle) => {
        if (pointer) {
          const dx = particle.x - pointer.x;
          const dy = particle.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 0 && distance < POINTER_RADIUS) {
            const push = (1 - distance / POINTER_RADIUS) * POINTER_FORCE * 0.1 * delta;
            particle.vx += (dx / distance) * push;
            particle.vy += (dy / distance) * push;
          }
        }
        // Vuelve con suavidad a su deriva original después del empujón.
        particle.vx += (particle.baseVx - particle.vx) * 0.03 * delta;
        particle.vy += (particle.baseVy - particle.vy) * 0.03 * delta;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        if (particle.x < -margin) particle.x = width + margin;
        else if (particle.x > width + margin) particle.x = -margin;
        if (particle.y < -margin) particle.y = height + margin;
        else if (particle.y > height + margin) particle.y = -margin;
      });
    };

    const loop = (time: number) => {
      // delta en «cuadros de 60 fps», acotado para que volver de otra pestaña no dé un salto.
      const delta = lastTime ? Math.min((time - lastTime) / 16.67, 3) : 1;
      lastTime = time;
      step(delta);
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
      if (!reduced && event.pointerType !== 'touch') pointer = { x: event.clientX, y: event.clientY };
    };
    const onPointerLeave = () => {
      pointer = null;
    };
    const onMotionChange = () => {
      reduced = Boolean(motionQuery?.matches);
      start();
    };
    let resizeFrame = 0;
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
