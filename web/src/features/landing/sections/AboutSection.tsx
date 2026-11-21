import { Eye, Target } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AboutContent, LandingSections, TeamMember } from '@/data/types';
import { keyed } from '@/lib/listKeys';
import { SOCIAL_NETWORKS, SocialIcon, socialHref } from '@/lib/social';
import { Card, Skeleton, SkeletonRows } from '@/ui';
import { CollaboratorsSection } from '../CollaboratorsSection';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

// Ancho mínimo de una tarjeta para decidir cuántas caben por fila.
const TEAM_CARD_MIN = 260;
const TEAM_ROW_GAP = 24;
const TEAM_MAX_PER_ROW = 4;

/** Redes de un integrante; cada ícono se anima a su manera (elegida en el panel). */
function TeamSocials({ member }: { member: TeamMember }) {
  const links = (member.socials || []).map((link) => ({ ...link, href: socialHref(link) })).filter((link) => link.href);
  if (!links.length) return null;
  return (
    <ul className="team-card__socials" aria-label={`Redes de ${member.full_name}`}>
      {keyed(links, (link) => `${link.network}:${link.href}`).map(({ item: link, key }) => {
        const network = SOCIAL_NETWORKS[link.network];
        const external = link.network !== 'email';
        return (
          <li key={key}>
            <a
              className={`social-link social-link--${link.animation}`}
              href={link.href as string}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              aria-label={`${network.label} de ${member.full_name}${external ? ' (se abre en otra pestaña)' : ''}`}
              title={network.label}
            >
              <SocialIcon network={link.network} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Tarjeta de integrante. Al pasar el mouse o enfocarla (teclado o toque)
 * crece dentro de su fila y revela descripción y redes; las demás tarjetas
 * de la fila se angostan y se desplazan para hacerle espacio, sin taparse.
 * En pantallas táctiles o angostas los detalles se muestran siempre debajo
 * (ver pages.css).
 */
function TeamCard({ member }: { member: TeamMember }) {
  const hasDetails = Boolean(member.bio || member.socials?.length);
  return (
    <article
      className="card card--raised team-card"
      data-expandable={hasDetails || undefined}
      tabIndex={hasDetails ? 0 : undefined}
      aria-labelledby={member.id ? `team-${member.id}` : undefined}
    >
      <div className="team-card__face">
        {member.photo_url ? (
          <img className="team-card__photo" src={member.photo_url} alt={`Foto de ${member.full_name}`} loading="lazy" />
        ) : (
          <span className="team-card__photo team-card__initials" aria-hidden>
            {initials(member.full_name)}
          </span>
        )}
        <div className="stack-sm" style={{ gap: 2 }}>
          <h3 id={member.id ? `team-${member.id}` : undefined}>{member.full_name}</h3>
          {member.role ? <p className="team-card__role">{member.role}</p> : null}
        </div>
        {hasDetails ? (
          <span className="team-card__hint text-small" aria-hidden>
            Conóceme
          </span>
        ) : null}
      </div>
      {hasDetails ? (
        <div className="team-card__details">
          <div className="team-card__details-inner">
            <span className="team-card__details-title">Sobre {member.full_name.split(/\s+/)[0]}</span>
            {member.bio ? <p className="text-secondary team-card__bio">{member.bio}</p> : null}
            <TeamSocials member={member} />
          </div>
        </div>
      ) : null}
    </article>
  );
}

/**
 * Reparte al equipo en filas según el ancho disponible. Cada fila es un flex
 * sin salto de línea: así, al expandirse una tarjeta, solo cambia el reparto
 * del espacio dentro de su fila y ninguna tarjeta se va a otra línea.
 */
function TeamRows({ team }: Readonly<{ team: TeamMember[] }>) {
  const ref = useRef<HTMLDivElement>(null);
  const [perRow, setPerRow] = useState(3);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const fit = Math.floor((entry.contentRect.width + TEAM_ROW_GAP) / (TEAM_CARD_MIN + TEAM_ROW_GAP));
      setPerRow(Math.max(1, Math.min(TEAM_MAX_PER_ROW, fit)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const rows: TeamMember[][] = [];
  for (let index = 0; index < team.length; index += perRow) rows.push(team.slice(index, index + perRow));

  return (
    <div ref={ref} className="team-rows">
      {rows.map((row) => (
        <div key={row[0].id ?? row[0].full_name} className="team-row">
          {row.map((member) => (
            <TeamCard key={member.id} member={member} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Sección «Nosotros»: textos y equipo editables desde el panel (Sitio web → Nosotros). */
export function AboutSection({
  about,
  team,
  club,
}: Readonly<{ about: AboutContent | undefined; team: TeamMember[] | undefined; club: LandingSections['club'] | undefined }>) {
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
        <div className="team-row team-row--loading" style={{ marginTop: 'var(--space-8)' }}>
          <Skeleton height={300} />
          <Skeleton height={300} />
          <Skeleton height={300} />
        </div>
      ) : team.length ? (
        <>
          <h3 className="about__team-title">Nuestro equipo</h3>
          <TeamRows team={team} />
        </>
      ) : null}

      {club?.visible ? <CollaboratorsSection config={club} /> : null}
    </section>
  );
}
