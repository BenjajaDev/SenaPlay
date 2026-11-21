import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, MapPin, Newspaper } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LandingSections, Publication, PublicationCategory } from '@/data/types';
import { formatEventDate, PUBLICATION_CATEGORIES } from '@/lib/site';
import { Badge, Button, Card, Dialog } from '@/ui';

function PublicationMeta({ publication }: { publication: Publication }) {
  const date = formatEventDate(publication.event_date);
  if (!date && !publication.location) return null;
  return (
    <div className="publication__meta text-small text-secondary">
      {date ? (
        <span>
          <CalendarDays size={14} aria-hidden /> <time dateTime={publication.event_date || undefined}>{date}</time>
        </span>
      ) : null}
      {publication.location ? (
        <span>
          <MapPin size={14} aria-hidden /> {publication.location}
        </span>
      ) : null}
    </div>
  );
}

function PublicationCover({ publication, large = false }: { publication: Publication; large?: boolean }) {
  return (
    <div className={`publication__cover${large ? ' publication__cover--large' : ''}`}>
      {publication.cover_url ? (
        <img src={publication.cover_url} alt="" loading="lazy" />
      ) : (
        <Newspaper size={large ? 48 : 36} aria-hidden />
      )}
    </div>
  );
}

function PublicationCard({ publication, onOpen }: { publication: Publication; onOpen: () => void }) {
  const category = PUBLICATION_CATEGORIES[publication.category] || PUBLICATION_CATEGORIES.otro;
  return (
    <Card variant="raised" className="publication">
      <PublicationCover publication={publication} />
      <div className="publication__content">
        <Badge tone={category.tone}>{category.label}</Badge>
        <h3>{publication.title}</h3>
        <PublicationMeta publication={publication} />
        {publication.summary ? <p className="text-secondary publication__summary">{publication.summary}</p> : null}
        <Button variant="ghost" size="sm" className="publication__more" onClick={onOpen} aria-label={`Leer más sobre ${publication.title}`}>
          Leer más
        </Button>
      </div>
    </Card>
  );
}

/** «Avances»: publicaciones del equipo (Sitio web → Publicaciones). Se oculta si no hay ninguna visible. */
export function PublicationsSection({ config, items }: { config: LandingSections['publications']; items: Publication[] }) {
  const [filter, setFilter] = useState<PublicationCategory | 'all'>('all');
  const [open, setOpen] = useState<Publication | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  // Solo se ofrecen como filtro las categorías que tienen publicaciones.
  const categories = useMemo(() => [...new Set(items.map((item) => item.category))], [items]);
  const filtered = filter === 'all' ? items : items.filter((item) => item.category === filter);

  // Las flechas se desactivan en los extremos del carrusel.
  const updateEdges = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setEdges({ start: track.scrollLeft <= 4, end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    track.scrollLeft = 0;
    updateEdges();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateEdges);
    observer?.observe(track);
    return () => observer?.disconnect();
  }, [filter, updateEdges]);

  const scrollByPage = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    track.scrollBy?.({ left: direction * track.clientWidth * 0.9, behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <section id="publicaciones" className="section" aria-labelledby="publicaciones-title">
      <h2 id="publicaciones-title" className="section__title" style={{ marginBottom: 'var(--space-3)' }}>
        {config.title}
      </h2>
      {config.intro ? <p className="text-secondary section__intro">{config.intro}</p> : null}

      {categories.length > 1 ? (
        <div className="filter-chips" role="group" aria-label="Filtrar publicaciones por tipo">
          {(['all', ...categories] as const).map((key) => (
            <button key={key} type="button" className="filter-chip" aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {key === 'all' ? 'Todas' : PUBLICATION_CATEGORIES[key]?.plural || key}
            </button>
          ))}
        </div>
      ) : null}

      {/* Carrusel horizontal: se desliza con el dedo, la rueda/trackpad, las
          flechas o el teclado (el carril es enfocable). */}
      <div className="carousel">
        <Button
          variant="secondary"
          icon={ChevronLeft}
          className="carousel__nav carousel__nav--prev"
          aria-label="Publicaciones anteriores"
          aria-controls="publicaciones-carril"
          disabled={edges.start}
          onClick={() => scrollByPage(-1)}
        />
        <div
          id="publicaciones-carril"
          ref={trackRef}
          className="carousel__track"
          role="region"
          aria-label={`${config.title}: ${filtered.length} ${filtered.length === 1 ? 'publicación' : 'publicaciones'}. Desliza para ver más.`}
          tabIndex={0}
          onScroll={updateEdges}
        >
          {filtered.map((publication) => (
            <PublicationCard key={publication.id} publication={publication} onOpen={() => setOpen(publication)} />
          ))}
        </div>
        <Button
          variant="secondary"
          icon={ChevronRight}
          className="carousel__nav carousel__nav--next"
          aria-label="Publicaciones siguientes"
          aria-controls="publicaciones-carril"
          disabled={edges.end}
          onClick={() => scrollByPage(1)}
        />
      </div>

      <Dialog
        open={Boolean(open)}
        wide
        title={open?.title || ''}
        onClose={() => setOpen(null)}
        actions={
          <>
            {open?.link_url ? (
              <a className="btn btn--secondary" href={open.link_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={18} aria-hidden /> Ver enlace
              </a>
            ) : null}
            <Button onClick={() => setOpen(null)}>Cerrar</Button>
          </>
        }
      >
        {open ? (
          <div className="stack" style={{ marginBottom: 20 }}>
            <div className="row" style={{ gap: 8 }}>
              <Badge tone={(PUBLICATION_CATEGORIES[open.category] || PUBLICATION_CATEGORIES.otro).tone}>
                {(PUBLICATION_CATEGORIES[open.category] || PUBLICATION_CATEGORIES.otro).label}
              </Badge>
              <PublicationMeta publication={open} />
            </div>
            {open.cover_url ? <PublicationCover publication={open} large /> : null}
            {open.summary ? <p className="publication__lead">{open.summary}</p> : null}
            {open.body ? <p className="text-secondary publication__body">{open.body}</p> : null}
          </div>
        ) : null}
      </Dialog>
    </section>
  );
}
