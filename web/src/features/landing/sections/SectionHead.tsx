import type { LucideIcon } from 'lucide-react';
import type { SectionItem } from '@/data/types';
import { SITE_ICONS } from '@/lib/site';

/** Encabezado de sección con etiqueta (kicker), título y texto opcional. */
export function SectionHead({
  id,
  icon: Icon,
  badge,
  title,
  lead,
  center = false,
}: Readonly<{ id: string; icon: LucideIcon; badge?: string; title: string; lead?: string; center?: boolean }>) {
  return (
    <div className={`section-head${center ? ' section-head--center' : ''}`}>
      {badge ? (
        <span className="kicker">
          <Icon size={15} aria-hidden /> {badge}
        </span>
      ) : null}
      <h2 id={id} className="section-head__title">
        {title}
      </h2>
      {lead ? <p className="text-secondary section-head__lead">{lead}</p> : null}
    </div>
  );
}

export function ItemIcon({ item, size = 24, color }: Readonly<{ item: SectionItem; size?: number; color?: string }>) {
  const Icon = SITE_ICONS[item.icon].icon;
  return <Icon size={size} color={color} aria-hidden />;
}

/** Etiquetas cortas (grupos, derechos, leyes). Se omite si no hay ninguna. */
export function TagList({ tags, label, className }: Readonly<{ tags: string[]; label?: string; className?: string }>) {
  const visible = tags.map((tag) => tag.trim()).filter(Boolean);
  if (!visible.length) return null;
  return (
    <ul className={className ? `tag-list ${className}` : 'tag-list'} aria-label={label}>
      {visible.map((tag, index) => (
        <li key={`${tag}-${index}`} className="tag-chip">
          {tag}
        </li>
      ))}
    </ul>
  );
}
