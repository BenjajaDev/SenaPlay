import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Eye, LayoutDashboard, MapPin, Moon, Newspaper, Smartphone, Sun, Target, Users, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepositories } from '@/data/RepositoriesProvider';
import type { AboutContent, LandingSections, Publication, PublicationCategory, PublicStats, SectionItem, TeamMember } from '@/data/types';
import { brandIcon } from '@/lib/brand';
import { env } from '@/lib/env';
import { formatCount, formatEventDate, PUBLICATION_CATEGORIES, SITE_ICONS, STAT_ITEMS } from '@/lib/site';
import { useThemeMode } from '@/lib/useThemeMode';
import { Badge, Button, Card, Dialog, Skeleton, SkeletonRows } from '@/ui';

// value: undefined = cargando (skeleton), null = no disponible (guion).
function Metric({ value, label, icon: Icon }: { value: number | null | undefined; label: string; icon: LucideIcon }) {
  return (
    <div className="metric">
      <span className="metric__icon">
        <Icon size={20} aria-hidden />
      </span>
      <div className="metric__value">{value === undefined ? <Skeleton width={64} height={34} /> : formatCount(value)}</div>
      <div className="metric__label">{label}</div>
    </div>
  );
}

function ItemIcon({ item, size = 24, color }: { item: SectionItem; size?: number; color?: string }) {
  const Icon = SITE_ICONS[item.icon].icon;
  return <Icon size={size} color={color} aria-hidden />;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

function TeamCard({ member }: { member: TeamMember }) {
  return (
    <Card variant="raised" className="team-card">
      {member.photo_url ? (
        <img className="team-card__photo" src={member.photo_url} alt={`Foto de ${member.full_name}`} loading="lazy" />
      ) : (
        <span className="team-card__photo team-card__initials" aria-hidden>
          {initials(member.full_name)}
        </span>
      )}
      <div className="stack-sm" style={{ gap: 2 }}>
        <h3>{member.full_name}</h3>
        {member.role ? <p className="team-card__role">{member.role}</p> : null}
      </div>
      {member.bio ? <p className="text-secondary text-small">{member.bio}</p> : null}
    </Card>
  );
}

/** Sección «Nosotros»: textos y equipo editables desde el panel (Sitio web → Nosotros). */
function AboutSection({ about, team }: { about: AboutContent | undefined; team: TeamMember[] | undefined }) {
  return (
    <section id="nosotros" className="section section--tinted" aria-labelledby="nosotros-title">
      <div className="about">
        <div className="about__intro stack">
          <span className="badge">Nosotros</span>
          <h2 id="nosotros-title" className="section__title" style={{ textAlign: 'left', marginBottom: 0 }}>
            {about ? about.title : <Skeleton width={240} height={34} />}
          </h2>
          {about ? <p className="text-secondary about__text">{about.intro}</p> : <SkeletonRows rows={3} label="Cargando" />}
        </div>
        <div className="about__pillars">
          {[
            { icon: Target, title: 'Misión', text: about?.mission },
            { icon: Eye, title: 'Visión', text: about?.vision },
          ].map(({ icon: Icon, title, text }) => (
            <Card key={title} variant="raised" className="pillar">
              <span className="feature__icon">
                <Icon size={24} aria-hidden />
              </span>
              <h3>{title}</h3>
              {text === undefined ? <SkeletonRows rows={2} label="Cargando" /> : <p className="text-secondary">{text}</p>}
            </Card>
          ))}
        </div>
      </div>

      {team === undefined ? (
        <div className="team-grid" style={{ marginTop: 'var(--space-8)' }}>
          <Skeleton height={220} />
          <Skeleton height={220} />
          <Skeleton height={220} />
        </div>
      ) : team.length ? (
        <>
          <h3 className="about__team-title">El equipo</h3>
          <div className="team-grid stagger">
            {team.map((member) => (
              <TeamCard key={member.id} member={member} />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

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

/** Publicaciones del equipo (Sitio web → Publicaciones). Se oculta si no hay ninguna visible. */
function PublicationsSection({ config, items }: { config: LandingSections['publications']; items: Publication[] }) {
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

/** Landing pública: presenta SeñaPlay, métricas reales, publicaciones, el equipo y descargas. Textos editables desde el panel. */
export function LandingPage() {
  const { stats, site, publications } = useRepositories();
  const { mode, toggle } = useThemeMode();
  const [data, setData] = useState<PublicStats | null | undefined>(undefined);
  const [sections, setSections] = useState<LandingSections | undefined>(undefined);
  const [posts, setPosts] = useState<Publication[] | undefined>(undefined);
  const [about, setAbout] = useState<AboutContent | undefined>(undefined);
  const [team, setTeam] = useState<TeamMember[] | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    stats.publicStats().then((value) => mounted && setData(value));
    return () => {
      mounted = false;
    };
  }, [stats]);

  useEffect(() => {
    let mounted = true;
    site.getSections().then((value) => mounted && setSections(value));
    site.getAbout().then((value) => mounted && setAbout(value));
    site.listPublishedTeam().then((value) => mounted && setTeam(value));
    return () => {
      mounted = false;
    };
  }, [site]);

  useEffect(() => {
    let mounted = true;
    publications.listPublished().then((value) => mounted && setPosts(value));
    return () => {
      mounted = false;
    };
  }, [publications]);

  // Si las métricas fallan (null), cada cifra muestra un guion en vez de un skeleton eterno.
  const pick = (key: keyof PublicStats) => (data === undefined ? undefined : data === null ? null : data[key]);

  const hero = sections?.hero;
  const showPublications = Boolean(sections?.publications.visible && posts?.length);
  const navLinks = [
    { href: '#caracteristicas', label: 'Características', show: sections?.features.visible },
    { href: '#accesibilidad', label: 'Accesibilidad', show: sections?.accessibility.visible },
    { href: '#publicaciones', label: 'Publicaciones', show: showPublications },
    { href: '#nosotros', label: 'Nosotros', show: true },
    { href: '#descargar', label: 'Descargar', show: sections?.download.visible },
  ].filter((link) => link.show);

  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header className="landing-nav">
        <Link to="/" className="brand-link" aria-label="SeñaPlay, inicio">
          <img src={brandIcon(mode)} alt="" width={40} height={40} />
          <span>SeñaPlay</span>
        </Link>
        <nav aria-label="Principal" className="landing-nav__links">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="row" style={{ gap: 8 }}>
          <Button variant="ghost" icon={mode === 'dark' ? Sun : Moon} onClick={toggle} aria-label={mode === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'} />
          <Link to="/admin" className="btn btn--secondary btn--sm">
            <LayoutDashboard size={16} aria-hidden /> Panel
          </Link>
        </div>
      </header>

      <main id="contenido">
        <section className="hero" aria-busy={!hero || undefined}>
          <div className="hero__content stagger">
            {hero ? (
              <>
                {hero.badge ? (
                  <span className="badge" style={{ background: 'color-mix(in srgb, white 18%, transparent)', color: 'var(--color-on-header)' }}>
                    {hero.badge}
                  </span>
                ) : null}
                <h1>{hero.title}</h1>
                <p>{hero.text}</p>
                <div className="row">
                  <a className="btn btn--lg hero__cta" href={env.androidUrl || '#descargar'}>
                    <Smartphone size={20} aria-hidden /> {hero.primaryLabel}
                  </a>
                  {hero.secondaryLabel ? (
                    <a className="btn btn--lg btn--ghost hero__ghost" href={navLinks[0]?.href || '#nosotros'}>
                      {hero.secondaryLabel}
                    </a>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="stack hero__loading" role="status" aria-label="Cargando">
                <Skeleton width={180} height={24} />
                <Skeleton height={48} />
                <Skeleton width="80%" height={48} />
                <Skeleton width="90%" height={20} />
              </div>
            )}
          </div>
          <div className="hero__visual" aria-hidden>
            {['A', 'B', 'C'].map((letter, index) => (
              <figure key={letter} className="sign-card" style={{ ['--i' as string]: index }}>
                <img src={`/signs/${letter}.png`} alt="" loading="lazy" />
                <figcaption>{letter}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {sections?.metrics.visible !== false ? (
          <>
            <section className="metrics stagger" aria-label={sections?.metrics.title || 'SeñaPlay en números'}>
              {STAT_ITEMS.map((item) => (
                <Metric key={item.key} value={pick(item.key)} label={item.label} icon={item.icon} />
              ))}
            </section>
            {data === null ? (
              <p className="text-muted text-small" style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>
                Métricas no disponibles por ahora.
              </p>
            ) : null}
          </>
        ) : null}

        {sections?.features.visible ? (
          <section id="caracteristicas" className="section">
            <h2 className="section__title">{sections.features.title}</h2>
            <div className="features-grid stagger">
              {sections.features.items.map((item, index) => (
                <Card key={`${item.title}-${index}`} variant="raised" className="feature">
                  <span className="feature__icon">
                    <ItemIcon item={item} />
                  </span>
                  <h3>{item.title}</h3>
                  <p className="text-secondary">{item.text}</p>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {sections?.accessibility.visible ? (
          <section id="accesibilidad" className="section section--tinted">
            <h2 className="section__title">{sections.accessibility.title}</h2>
            <div className="grid-3">
              {sections.accessibility.items.map((item, index) => (
                <div key={`${item.title}-${index}`} className="a11y-item">
                  <ItemIcon item={item} size={28} color="var(--color-primary)" />
                  <h3>{item.title}</h3>
                  <p className="text-secondary">{item.text}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {sections && posts && showPublications ? <PublicationsSection config={sections.publications} items={posts} /> : null}

        <AboutSection about={about} team={team} />

        {sections?.download.visible ? (
          <section id="descargar" className="section">
            <Card variant="brand" className="download">
              <div className="stack-sm">
                <h2>{sections.download.title}</h2>
                <p style={{ opacity: 0.92 }}>{sections.download.text}</p>
              </div>
              <div className="row">
                {env.androidUrl ? (
                  <a className="btn btn--lg download__btn" href={env.androidUrl}>
                    <Smartphone size={20} aria-hidden /> Google Play
                  </a>
                ) : (
                  <span className="badge" style={{ background: 'color-mix(in srgb, white 20%, transparent)', color: 'var(--color-on-header)' }}>
                    Próximamente en tiendas
                  </span>
                )}
                {env.iosUrl ? (
                  <a className="btn btn--lg download__btn" href={env.iosUrl}>
                    <Smartphone size={20} aria-hidden /> App Store
                  </a>
                ) : null}
              </div>
            </Card>
          </section>
        ) : null}
      </main>

      <footer className="landing-footer">
        <div className="row" style={{ gap: 8 }}>
          <Users size={16} aria-hidden /> {sections?.footer.text ?? ''}
        </div>
        <span>© {new Date().getFullYear()} SeñaPlay</span>
      </footer>
    </>
  );
}
