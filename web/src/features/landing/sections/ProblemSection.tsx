import { CircleAlert } from 'lucide-react';
import type { Highlight, LandingSections } from '@/data/types';
import { oneInEvery, RATIO_DOTS_MAX } from '@/lib/site';
import { ItemIcon, SectionHead } from './SectionHead';

/** Fila de puntos «1 de cada N»: el destacado es más grande y relleno (no depende solo del color). */
function RatioDots({ ratio }: Readonly<{ ratio: number }>) {
  const text = `≈ 1 de cada ${ratio.toLocaleString('es-CL')} habitantes`;
  const middle = Math.floor(ratio / 2);
  return (
    <div className="stat__ratio">
      {ratio <= RATIO_DOTS_MAX ? (
        <div className="stat__dots" style={{ gridTemplateColumns: `repeat(${ratio}, minmax(0, 1fr))` }} aria-hidden>
          {Array.from({ length: ratio }, (_, index) => (
            <span key={index} className={index === middle ? 'stat__dot stat__dot--on' : 'stat__dot'} />
          ))}
        </div>
      ) : null}
      <span className="stat__ratio-text">{text}</span>
    </div>
  );
}

function FeaturedStat({ highlight }: Readonly<{ highlight: Highlight }>) {
  const ratio = oneInEvery(highlight.value, highlight.total);
  return (
    <article className="stat stat--featured" aria-label={`Cifra destacada: ${highlight.value}`}>
      <span className="stat__value">{highlight.value}</span>
      {highlight.label ? <p className="stat__label">{highlight.label}</p> : null}
      {ratio ? <RatioDots ratio={ratio} /> : null}
      {highlight.note ? <p className="stat__note">{highlight.note}</p> : null}
      {highlight.source ? <span className="stat__source">Fuente: {highlight.source}</span> : null}
    </article>
  );
}

function MiniStat({ highlight }: Readonly<{ highlight: Highlight }>) {
  return (
    <article className="stat stat--mini">
      <span className="stat__value">{highlight.value}</span>
      <div className="stack-sm" style={{ gap: 2 }}>
        {highlight.label ? <p className="text-secondary">{highlight.label}</p> : null}
        {highlight.source ? <span className="text-small text-muted">Fuente: {highlight.source}</span> : null}
      </div>
    </article>
  );
}

/** «El problema»: contexto, cifras destacadas y tarjetas de preguntas (editable en Secciones → El problema). */
export function ProblemSection({ config }: Readonly<{ config: LandingSections['problem'] }>) {
  const [featured, ...others] = config.highlights.filter((item) => item.value.trim());
  const paragraphs = config.paragraphs.filter((paragraph) => paragraph.trim());
  return (
    <section id="problema" className="section section--tinted" aria-labelledby="problema-title">
      <div className="section-inner">
        <SectionHead id="problema-title" icon={CircleAlert} badge={config.badge} title={config.title} />
        <div className={`problem${featured ? '' : ' problem--single'}`}>
          <div className="problem__text">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            {others.map((highlight, index) => (
              <MiniStat key={`${highlight.value}-${index}`} highlight={highlight} />
            ))}
            {config.citation ? <p className="text-small text-muted">{config.citation}</p> : null}
          </div>
          {featured ? <FeaturedStat highlight={featured} /> : null}
        </div>
        {config.questions.length ? (
          <div className="question-grid">
            {config.questions.map((item, index) => (
              <article key={`${item.title}-${index}`} className="card card--raised question-card">
                <span className="question-card__icon">
                  <ItemIcon item={item} size={22} />
                </span>
                <h3>{item.title}</h3>
                <p className="text-secondary">{item.text}</p>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
