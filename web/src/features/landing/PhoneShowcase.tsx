import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { LandingSections } from '@/data/types';
import { keyed } from '@/lib/listKeys';
import { useAutoAdvance, usePageVisible, usePrefersReducedMotion } from '@/lib/useCarousel';
import { Button } from '@/ui';

/**
 * «Así se ve SeñaPlay»: teléfono con capturas de la app que avanzan solas
 * (editables en Secciones → La app). Carrusel accesible: botón de pausa,
 * puntos y pasos para elegir, se detiene con el mouse o el foco encima y no
 * avanza solo con «reducir movimiento».
 */
export function PhoneShowcase({ config }: Readonly<{ config: LandingSections['showcase'] }>) {
  const reduced = usePrefersReducedMotion();
  const visible = usePageVisible();
  const [stopped, setStopped] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const screens = config.screens;
  const autoplay = !reduced && !stopped;
  const [current, setCurrent] = useAutoAdvance(screens.length, config.interval * 1000, { paused: !autoplay || !visible || hovered || focused });
  const hasCaptions = screens.some((screen) => screen.caption.trim());
  const items = keyed(screens, (screen) => screen.image_url);
  const currentScreen = screens[current];
  const announcement = currentScreen ? [`Captura ${current + 1} de ${screens.length}`, currentScreen.caption.trim()].filter(Boolean).join(': ') : '';
  const deviceRef = useRef<HTMLDivElement>(null);

  // Pausa mientras el mouse o el foco están sobre el teléfono. Se escucha con
  // eventos nativos: el contenedor no es un control, solo agrupa al carrusel.
  useEffect(() => {
    const device = deviceRef.current;
    if (!device) return undefined;
    const onEnter = () => setHovered(true);
    const onLeave = () => setHovered(false);
    const onFocusIn = () => setFocused(true);
    const onFocusOut = (event: FocusEvent) => {
      if (!device.contains(event.relatedTarget as Node | null)) setFocused(false);
    };
    device.addEventListener('pointerenter', onEnter);
    device.addEventListener('pointerleave', onLeave);
    device.addEventListener('focusin', onFocusIn);
    device.addEventListener('focusout', onFocusOut);
    return () => {
      device.removeEventListener('pointerenter', onEnter);
      device.removeEventListener('pointerleave', onLeave);
      device.removeEventListener('focusin', onFocusIn);
      device.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return (
    <section id="app" className="section showcase" aria-labelledby="app-title">
      <div className="showcase__text stack">
        <span className="badge">La app</span>
        <h2 id="app-title" className="section__title" style={{ textAlign: 'left', marginBottom: 0 }}>
          {config.title}
        </h2>
        {config.text ? <p className="text-secondary showcase__lead">{config.text}</p> : null}
        {hasCaptions ? (
          <ol className="showcase__steps">
            {items.map(({ item: screen, key }, index) =>
              screen.caption.trim() ? (
                <li key={key}>
                  <button
                    type="button"
                    className="showcase__step"
                    aria-current={index === current || undefined}
                    aria-controls="app-carrusel"
                    onClick={() => setCurrent(index)}
                  >
                    <span className="showcase__step-number" aria-hidden>
                      {index + 1}
                    </span>
                    {screen.caption}
                  </button>
                </li>
              ) : null,
            )}
          </ol>
        ) : null}
      </div>

      <div ref={deviceRef} className="showcase__device">
        <section id="app-carrusel" className="phone" aria-roledescription="carrusel" aria-label={`Capturas de SeñaPlay: ${screens.length} imágenes`}>
          <span className="phone__island" aria-hidden />
          <div className="phone__screen">
            <div className="phone__track" style={{ transform: `translateX(-${current * 100}%)` }}>
              {items.map(({ item: screen, key }, index) => (
                <div key={key} className="phone__slide" aria-hidden={index !== current || undefined}>
                  <img src={screen.image_url} alt={screen.caption || `Captura ${index + 1} de la app SeñaPlay`} loading={index === 0 ? 'eager' : 'lazy'} />
                </div>
              ))}
            </div>
          </div>
          {/* Anuncia la captura actual solo cuando el carrusel está detenido, para no interrumpir al lector. */}
          <p className="visually-hidden" aria-live={autoplay ? 'off' : 'polite'}>
            {announcement}
          </p>
        </section>
        {screens.length > 1 ? (
          <div className="showcase__controls">
            {reduced ? null : (
              <Button
                variant="ghost"
                size="sm"
                icon={stopped ? Play : Pause}
                aria-label={stopped ? 'Reanudar el carrusel' : 'Pausar el carrusel'}
                onClick={() => setStopped((value) => !value)}
              />
            )}
            <div className="showcase__dots">
              {items.map(({ item: screen, key }, index) => (
                <button
                  key={key}
                  type="button"
                  className="showcase__dot"
                  aria-label={screen.caption ? `Ver captura ${index + 1}: ${screen.caption}` : `Ver captura ${index + 1}`}
                  aria-current={index === current || undefined}
                  aria-controls="app-carrusel"
                  onClick={() => setCurrent(index)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
