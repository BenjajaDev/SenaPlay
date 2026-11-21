import { FileText, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { LandingSections } from '@/data/types';
import { ItemIcon, SectionHead, TagList } from './SectionHead';

/** Resumen de la política en la landing; la versión completa vive en /privacidad (Secciones → Privacidad). */
export function PrivacySection({ config }: Readonly<{ config: LandingSections['privacy'] }>) {
  return (
    <section id="privacidad" className="section section--tinted" aria-labelledby="privacidad-title">
      <div className="section-inner">
        <SectionHead id="privacidad-title" icon={ShieldCheck} badge={config.badge} title={config.title} lead={config.intro} />
        <TagList tags={config.laws} label="Leyes aplicables" className="privacy-laws" />
        <div className="privacy-grid">
          {config.items.map((item, index) => (
            <article key={`${item.title}-${index}`} className="card card--raised privacy-card">
              <span className="question-card__icon">
                <ItemIcon item={item} size={20} />
              </span>
              <div className="stack-sm" style={{ gap: 6, minWidth: 0 }}>
                <h3>{item.title}</h3>
                <p className="text-secondary">{item.text}</p>
                <TagList tags={item.tags} label={item.title} />
              </div>
            </article>
          ))}
        </div>
        <div className="privacy-cta">
          <span className="text-secondary">Revisa el detalle de cómo tratamos tus datos y cómo ejercer tus derechos.</span>
          <Link to="/privacidad" className="btn btn--secondary">
            <FileText size={18} aria-hidden /> Leer la política completa
          </Link>
        </div>
      </div>
    </section>
  );
}
