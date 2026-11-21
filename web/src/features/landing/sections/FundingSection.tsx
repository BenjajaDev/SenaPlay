import type { LandingSections, Sponsor } from '@/data/types';
import { initialsOf } from '@/lib/site';
import { safeLinkHref } from '@/lib/social';

function SponsorMark({ sponsor }: Readonly<{ sponsor: Sponsor }>) {
  const href = sponsor.url ? safeLinkHref(sponsor.url) : null;
  const content = (
    <>
      {sponsor.image_url ? (
        <img className="sponsor__logo" src={sponsor.image_url} alt="" loading="lazy" />
      ) : (
        <span className="sponsor__logo sponsor__logo--initials" aria-hidden>
          {initialsOf(sponsor.name, 5)}
        </span>
      )}
      <span>{sponsor.name}</span>
    </>
  );
  return (
    <li>
      {href ? (
        <a className="sponsor" href={href} target="_blank" rel="noopener noreferrer" aria-label={`${sponsor.name} (se abre en otra pestaña)`}>
          {content}
        </a>
      ) : (
        <span className="sponsor">{content}</span>
      )}
    </li>
  );
}

/** «Financiamiento»: fuente de los fondos y logos de las instituciones (Secciones → Financiamiento). */
export function FundingSection({ config }: Readonly<{ config: LandingSections['funding'] }>) {
  const sponsors = config.sponsors.filter((sponsor) => sponsor.name.trim());
  return (
    <section id="financiamiento" className="section" aria-labelledby="financiamiento-title">
      <div className="section-inner">
        <h2 id="financiamiento-title" className="section-head__title" style={{ marginBottom: 'var(--space-6)' }}>
          {config.title}
        </h2>
        <div className="funding">
          <p className="funding__text">
            {config.lead ? <strong>{config.lead} </strong> : null}
            {config.text}
          </p>
          {sponsors.length ? (
            <ul className="sponsors" aria-label="Instituciones">
              {sponsors.map((sponsor, index) => (
                <SponsorMark key={`${sponsor.name}-${index}`} sponsor={sponsor} />
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
