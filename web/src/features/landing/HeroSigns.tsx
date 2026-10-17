import { useState } from 'react';
import type { SignSlide } from '@/data/types';
import { useAutoAdvance, usePageVisible, usePrefersReducedMotion } from '@/lib/useCarousel';

/** Una tarjeta del hero: su propio carrusel de señas, que se pausa con el mouse encima. */
function SignDeck({ slides, index: position, intervalMs }: { slides: SignSlide[]; index: number; intervalMs: number }) {
  const reduced = usePrefersReducedMotion();
  const visible = usePageVisible();
  const [hovered, setHovered] = useState(false);
  // Cada tarjeta parte desfasada un tercio del intervalo: cambian de a una, no las tres juntas.
  const [current] = useAutoAdvance(slides.length, intervalMs, {
    paused: reduced || !visible || hovered,
    firstDelayMs: intervalMs * (1 + position / 3),
  });
  const slide = slides[current];

  return (
    <figure className="sign-card" style={{ ['--i' as string]: position }} onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
      <div className="sign-card__viewport">
        {slides.map((item, index) => (
          <img
            key={`${item.image_url}-${index}`}
            src={item.image_url}
            alt=""
            loading={index === 0 ? 'eager' : 'lazy'}
            className="sign-card__slide"
            data-active={index === current || undefined}
          />
        ))}
      </div>
      <figcaption key={slide?.label} className="sign-card__label">
        {slide?.label}
      </figcaption>
      {slides.length > 1 ? (
        <span className="sign-card__dots">
          {slides.map((item, index) => (
            <span key={`${item.image_url}-${index}`} data-active={index === current || undefined} />
          ))}
        </span>
      ) : null}
    </figure>
  );
}

/**
 * Tarjetas de señas del hero (editables en Secciones → Portada). Son
 * decorativas: el contenido lo dan el título y el texto, por eso van ocultas
 * al lector de pantalla. Con «reducir movimiento» no avanzan solas.
 */
export function HeroSigns({ decks, intervalSeconds }: { decks: SignSlide[][]; intervalSeconds: number }) {
  return (
    <div className="hero__visual" aria-hidden>
      {decks.map((slides, index) => (
        <SignDeck key={index} slides={slides} index={index} intervalMs={intervalSeconds * 1000} />
      ))}
    </div>
  );
}
