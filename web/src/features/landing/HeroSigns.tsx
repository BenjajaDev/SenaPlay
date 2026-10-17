import { useState } from 'react';
import type { SignSlide } from '@/data/types';
import { keyed } from '@/lib/listKeys';
import { useAutoAdvance, usePageVisible, usePrefersReducedMotion } from '@/lib/useCarousel';

/** Una tarjeta del hero: su propio carrusel de señas, que se pausa con el mouse encima. */
function SignDeck({ slides, position, intervalMs }: Readonly<{ slides: SignSlide[]; position: number; intervalMs: number }>) {
  const reduced = usePrefersReducedMotion();
  const visible = usePageVisible();
  const [hovered, setHovered] = useState(false);
  // Cada tarjeta parte desfasada un tercio del intervalo: cambian de a una, no las tres juntas.
  const [current] = useAutoAdvance(slides.length, intervalMs, {
    paused: reduced || !visible || hovered,
    firstDelayMs: intervalMs * (1 + position / 3),
  });
  const slide = slides[current];
  const items = keyed(slides, (item) => item.image_url);

  return (
    <figure className="sign-card" style={{ ['--i' as string]: position }} onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
      <div className="sign-card__viewport">
        {items.map(({ item, key }, index) => (
          <img
            key={key}
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
          {items.map(({ key }, index) => (
            <span key={key} data-active={index === current || undefined} />
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
export function HeroSigns({ decks, intervalSeconds }: Readonly<{ decks: SignSlide[][]; intervalSeconds: number }>) {
  return (
    <div className="hero__visual" aria-hidden>
      {keyed(decks, (deck) => deck.map((slide) => slide.image_url).join('|')).map(({ item: slides, key }, position) => (
        <SignDeck key={key} slides={slides} position={position} intervalMs={intervalSeconds * 1000} />
      ))}
    </div>
  );
}
