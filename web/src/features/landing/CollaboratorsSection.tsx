import { Card } from '@/ui';
import { COLLABORATORS } from '@/lib/collaborators';

/** Bloque «Colaboran con nosotros» dentro de Nosotros: organizaciones aliadas y su aporte. */
export function CollaboratorsSection() {
  return (
    <div id="colaboradores" className="collaborators" aria-labelledby="colaboradores-title">
      <h3 id="colaboradores-title" className="about__team-title">
        Colaboran con nosotros
      </h3>
      <ul className="collaborators__list">
        {COLLABORATORS.map((collaborator) => (
          <li key={collaborator.id}>
            <Card variant="raised" className="collaborator-card">
              <img className="collaborator-card__logo" src={collaborator.logo} alt={`Logo del ${collaborator.name}`} width={96} height={96} loading="lazy" />
              <div className="stack-sm">
                <h4 className="collaborator-card__name">{collaborator.name}</h4>
                <p className="collaborator-card__motto">{collaborator.motto}</p>
                <p className="text-secondary">{collaborator.contribution}</p>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
