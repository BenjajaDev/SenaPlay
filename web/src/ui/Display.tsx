import type { LucideIcon } from 'lucide-react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

type CardVariant = 'surface' | 'raised' | 'gradient' | 'brand';

export function Card({
  variant = 'surface',
  interactive = false,
  className = '',
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant; interactive?: boolean }) {
  const classes = ['card', variant !== 'surface' && `card--${variant}`, interactive && 'card--interactive', className].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}

export type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function Badge({ tone = 'brand', icon: Icon, children }: { tone?: Tone; icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className={`badge${tone !== 'brand' ? ` badge--${tone}` : ''}`}>
      {Icon ? <Icon size={12} aria-hidden /> : null}
      {children}
    </span>
  );
}

export function Spinner({ size = 44, label }: { size?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="stack-sm" style={{ alignItems: 'center' }}>
      <span className="spinner" style={{ ['--spinner-size' as string]: `${size}px` } as CSSProperties} aria-hidden />
      <span className={label ? 'text-secondary text-small' : 'visually-hidden'}>{label || 'Cargando'}</span>
    </div>
  );
}

export function Skeleton({ width = '100%', height = 16, radius }: { width?: number | string; height?: number; radius?: number }) {
  return <span className="skeleton" aria-hidden style={{ width, height, borderRadius: radius }} />;
}

/** Filas esqueleto para tablas y listas mientras cargan datos. */
export function SkeletonRows({ rows = 4, label = 'Cargando' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="stack-sm">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="card row" style={{ padding: 14 }}>
          <Skeleton width={40} height={40} radius={10} />
          <div className="stack-sm" style={{ flex: 1 }}>
            <Skeleton width="45%" />
            <Skeleton width="70%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, message, action }: { icon: LucideIcon; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="stack-sm" style={{ alignItems: 'center', textAlign: 'center', padding: '40px 16px' }}>
      <span style={{ width: 64, height: 64, borderRadius: 32, display: 'grid', placeItems: 'center', background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
        <Icon size={30} aria-hidden />
      </span>
      <h3 style={{ fontSize: 17 }}>{title}</h3>
      {message ? <p className="text-secondary">{message}</p> : null}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="row-between" style={{ marginBottom: 20 }}>
      <div className="stack-sm" style={{ gap: 4 }}>
        <h1 style={{ fontSize: 26 }}>{title}</h1>
        {subtitle ? <p className="text-secondary">{subtitle}</p> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </header>
  );
}

export function StatTile({ icon: Icon, label, value, tone = 'brand' }: { icon: LucideIcon; label: string; value: ReactNode; tone?: Tone }) {
  const colors: Record<Tone, [string, string]> = {
    brand: ['var(--color-primary-soft)', 'var(--color-primary)'],
    success: ['var(--color-success-soft)', 'var(--color-success-text)'],
    warning: ['var(--color-warning-soft)', 'var(--color-warning-text)'],
    danger: ['var(--color-danger-soft)', 'var(--color-danger-text)'],
    info: ['var(--color-info-soft)', 'var(--color-info-text)'],
    neutral: ['var(--color-surface-sunken)', 'var(--color-text-secondary)'],
  };
  const [bg, fg] = colors[tone];
  return (
    <div className="card row stat-tile hover-lift" style={{ gap: 14 }}>
      <span className="stat-tile__icon" style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', background: bg, color: fg }}>
        <Icon size={22} aria-hidden />
      </span>
      <div>
        <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.1 }}>{value}</div>
        <div className="text-secondary text-small">{label}</div>
      </div>
    </div>
  );
}
