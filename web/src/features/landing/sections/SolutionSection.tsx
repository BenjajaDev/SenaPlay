import { Sparkles } from 'lucide-react';
import { LANDING_LIMITS } from '@/data/repositories';
import type { LandingSections } from '@/data/types';
import { splitFeatures } from '@/lib/site';
import { Card } from '@/ui';
import { ItemIcon, SectionHead } from './SectionHead';

/** «La solución» (antes Características): las destacadas en grande y el resto como chips con su texto al pasar el mouse. */
export function SolutionSection({ config }: Readonly<{ config: LandingSections['features'] }>) {
  const { featured, extras } = splitFeatures(config.items, LANDING_LIMITS.highlightedFeatures);
  return (
    <section id="solucion" className="section" aria-labelledby="solucion-title">
      <div className="section-inner">
        <SectionHead id="solucion-title" icon={Sparkles} badge={config.badge} title={config.title} lead={config.intro} />
        <div className="features-grid stagger">
          {featured.map((item, index) => (
            <Card key={`${item.title}-${index}`} variant="raised" className="feature">
              <span className="feature__icon">
                <ItemIcon item={item} />
              </span>
              <h3>{item.title}</h3>
              <p className="text-secondary">{item.text}</p>
            </Card>
          ))}
        </div>
        {extras.length ? (
          <div className="feature-extras">
            <span className="text-secondary">Además:</span>
            <ul className="tag-list">
              {extras.map((item, index) => (
                <li key={`${item.title}-${index}`} className="tag-chip tag-chip--icon" title={item.text}>
                  <ItemIcon item={item} size={15} /> {item.title}
                  <span className="visually-hidden">: {item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
