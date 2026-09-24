import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: boolean;
  loading?: boolean;
  block?: boolean;
  children?: ReactNode;
};

/**
 * Botón único del portal (mismas variantes que la app móvil). Estados:
 * hover, active (pressed), focus-visible, disabled y loading (bloquea el
 * doble envío y anuncia aria-busy).
 */
export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight = false,
  loading = false,
  block = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variant !== 'primary' && `btn--${variant}`,
    size !== 'md' && `btn--${size}`,
    block && 'btn--block',
    !children && Icon && 'btn--icon',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const iconNode = loading ? (
    <span className="spinner" style={{ ['--spinner-size' as string]: '16px', borderWidth: 2 }} aria-hidden />
  ) : Icon ? (
    <Icon size={size === 'sm' ? 16 : 18} aria-hidden />
  ) : null;

  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {!iconRight && iconNode}
      {children}
      {iconRight && iconNode}
    </button>
  );
}
