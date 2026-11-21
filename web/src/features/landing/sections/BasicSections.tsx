import { Smartphone, type LucideIcon } from 'lucide-react';
import type { LandingSections, PublicStats } from '@/data/types';
import { env } from '@/lib/env';
import { formatCount, STAT_ITEMS } from '@/lib/site';
import { Card, Skeleton } from '@/ui';
import { HeroSigns } from '../HeroSigns';
import { ItemIcon } from './SectionHead';

/** Portada: etiqueta, título, texto, botones y tarjetas de señas (Secciones → Portada). */
export function HeroSection({ hero, moreHref }: Readonly<{ hero: LandingSections['hero']; moreHref: string }>) {
  return (
    <section className="hero">
      <div className="hero__content stagger">
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
            <a className="btn btn--lg btn--ghost hero__ghost" href={moreHref}>
              {hero.secondaryLabel}
            </a>
          ) : null}
        </div>
      </div>
      <HeroSigns decks={hero.signDecks} intervalSeconds={hero.signsInterval} />
    </section>
  );
}

/** Portada mientras cargan los textos. */
export function HeroLoading() {
  return (
    <section className="hero" aria-busy>
      <div className="hero__content">
        <div className="stack hero__loading" role="status" aria-label="Cargando">
          <Skeleton width={180} height={24} />
          <Skeleton height={48} />
          <Skeleton width="80%" height={48} />
          <Skeleton width="90%" height={20} />
        </div>
      </div>
      <div className="hero__visual" aria-hidden />
    </section>
  );
}

// value: undefined = cargando (skeleton), null = no disponible (guion).
function Metric({ value, label, icon: Icon }: Readonly<{ value: number | null | undefined; label: string; icon: LucideIcon }>) {
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

/** Cifras en vivo de la app (RPC public_stats). `stats`: undefined = cargando, null = no disponible. */
export function MetricsSection({ config, stats }: Readonly<{ config: LandingSections['metrics']; stats: PublicStats | null | undefined }>) {
  const pick = (key: keyof PublicStats) => (stats === undefined ? undefined : stats === null ? null : stats[key]);
  return (
    <>
      <section className="metrics stagger" aria-label={config.title || 'SeñaPlay en números'}>
        {STAT_ITEMS.map((item) => (
          <Metric key={item.key} value={pick(item.key)} label={item.label} icon={item.icon} />
        ))}
      </section>
      {stats === null ? (
        <p className="text-muted text-small" style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>
          Métricas no disponibles por ahora.
        </p>
      ) : null}
    </>
  );
}

export function AccessibilitySection({ config }: Readonly<{ config: LandingSections['accessibility'] }>) {
  return (
    <section id="accesibilidad" className="section section--tinted">
      <h2 className="section__title">{config.title}</h2>
      <div className="grid-3">
        {config.items.map((item, index) => (
          <div key={`${item.title}-${index}`} className="a11y-item">
            <ItemIcon item={item} size={28} color="var(--color-primary)" />
            <h3>{item.title}</h3>
            <p className="text-secondary">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function DownloadSection({ config }: Readonly<{ config: LandingSections['download'] }>) {
  return (
    <section id="descargar" className="section">
      <Card variant="brand" className="download">
        <div className="stack-sm">
          <h2>{config.title}</h2>
          <p style={{ opacity: 0.92 }}>{config.text}</p>
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
  );
}
