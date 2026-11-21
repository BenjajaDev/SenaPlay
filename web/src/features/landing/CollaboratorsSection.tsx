import { HeartHandshake } from 'lucide-react';
import type { LandingSections } from '@/data/types';
import { CLUB_SORDOS_TALCA } from '@/lib/collaborators';
import { Card } from '@/ui';
import { ItemIcon, TagList } from './sections/SectionHead';

/**
 * Bloque «Colaboran con nosotros» dentro de Nosotros: quién es el Club de
 * Sordos de Talca y qué hace en el proyecto (Secciones → Club de Sordos).
 */
export function CollaboratorsSection({ config }: Readonly<{ config: LandingSections['club'] }>) {
  const paragraphs = config.paragraphs.filter((paragraph) => paragraph.trim());
  return (
    <div id="colaboradores" className="collaborators" aria-labelledby="colaboradores-title">
      <h3 id="colaboradores-title" className="about__team-title">
        Colaboran con nosotros
      </h3>
      <Card variant="raised" className="club">
        <div className="club__header">
          <img className="collaborator-card__logo" src={CLUB_SORDOS_TALCA.logo} alt={`Logo del ${config.name}`} width={96} height={96} loading="lazy" />
          <div className="stack-sm" style={{ gap: 4, minWidth: 0 }}>
            <h4 className="collaborator-card__name">{config.name}</h4>
            {config.motto ? <p className="collaborator-card__motto">{config.motto}</p> : null}
          </div>
        </div>
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="text-secondary club__text">
            {paragraph}
          </p>
        ))}
        {config.facts.length ? (
          <ul className="club__facts">
            {config.facts.map((fact, index) => (
              <li key={`${fact.title}-${index}`} className="club__fact">
                <span className="question-card__icon">
                  <ItemIcon item={fact} size={20} />
                </span>
                <div className="stack-sm" style={{ gap: 2, minWidth: 0 }}>
                  <strong>{fact.title}</strong>
                  {fact.text ? <span className="text-small text-secondary">{fact.text}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {config.roleTitle || config.roleText || config.roles.length ? (
          <div className="club__role">
            {config.roleTitle ? (
              <h5 className="club__role-title">
                <HeartHandshake size={18} aria-hidden /> {config.roleTitle}
              </h5>
            ) : null}
            {config.roleText ? <p className="text-secondary">{config.roleText}</p> : null}
            <TagList tags={config.roles} label={`Aportes del ${config.name}`} />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
