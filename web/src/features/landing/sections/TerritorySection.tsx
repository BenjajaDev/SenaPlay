import { ArrowRight, MapPin } from 'lucide-react';
import type { AudienceCard, LandingSections } from '@/data/types';
import { SectionHead, TagList } from './SectionHead';

function Audience({ card }: Readonly<{ card: AudienceCard }>) {
  return (
    <article className="card card--raised audience">
      {card.label ? <span className="eyebrow">{card.label}</span> : null}
      <h3>{card.title}</h3>
      {card.text ? <p className="text-secondary">{card.text}</p> : null}
      <TagList tags={card.tags} label={card.label || card.title} />
    </article>
  );
}

/** «Territorio y comunidad»: dónde se sitúa el piloto y a quién beneficia (Secciones → Territorio). */
export function TerritorySection({ config }: Readonly<{ config: LandingSections['territory'] }>) {
  const { place } = config;
  return (
    <section id="territorio" className="section section--tinted" aria-labelledby="territorio-title">
      <div className="section-inner">
        <SectionHead id="territorio-title" icon={MapPin} badge={config.badge} title={config.title} />
        <article className="card card--raised place">
          <span className="place__pin">
            <MapPin size={26} aria-hidden />
          </span>
          <div className="stack-sm" style={{ gap: 4, minWidth: 0 }}>
            {place.label ? <span className="eyebrow">{place.label}</span> : null}
            <h3>{place.title}</h3>
            {place.text ? <p className="text-secondary">{place.text}</p> : null}
          </div>
          <TagList tags={place.tags} label={place.label || place.title} />
        </article>
        <div className="audience-flow">
          <Audience card={config.direct} />
          <div className="audience-flow__bridge">
            <ArrowRight size={28} aria-hidden />
            {config.bridge ? <span>{config.bridge}</span> : null}
          </div>
          <Audience card={config.indirect} />
        </div>
      </div>
    </section>
  );
}
