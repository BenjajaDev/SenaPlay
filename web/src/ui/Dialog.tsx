import { AlertCircle, CheckCircle2, Info, Trash2, Trophy, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type DialogTone = 'info' | 'success' | 'warning' | 'danger' | 'celebration';

const TONES: Record<DialogTone, { icon: LucideIcon; accent: string; soft: string }> = {
  info: { icon: Info, accent: 'var(--color-info)', soft: 'var(--color-info-soft)' },
  success: { icon: CheckCircle2, accent: 'var(--color-success)', soft: 'var(--color-success-soft)' },
  warning: { icon: AlertCircle, accent: 'var(--color-warning)', soft: 'var(--color-warning-soft)' },
  danger: { icon: Trash2, accent: 'var(--color-danger)', soft: 'var(--color-danger-soft)' },
  celebration: { icon: Trophy, accent: 'var(--color-gold)', soft: 'var(--color-primary-soft)' },
};

type DialogProps = {
  open: boolean;
  tone?: DialogTone;
  icon?: LucideIcon;
  title: string;
  message?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  dismissible?: boolean;
  wide?: boolean;
  onClose?: () => void;
};

/**
 * Diálogo modal accesible: role="dialog" + aria-modal, foco inicial dentro,
 * Escape y clic en el fondo cierran (si es descartable), y el foco vuelve al
 * elemento que lo abrió. Base visual de confirmaciones y formularios.
 */
export function Dialog({ open, tone = 'info', icon, title, message, children, actions, dismissible = true, wide = false, onClose }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const toneConfig = TONES[tone];
  const Icon = icon || toneConfig.icon;

  // onClose/dismissible se leen desde refs: las páginas suelen pasar
  // `onClose={() => …}` nuevo en cada render, y si fuera dependencia del
  // efecto de foco, cada tecla re-enfocaba el primer campo (se escribía en
  // «Descripción» y el texto aparecía en «Título»).
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;

  // Foco inicial y retorno del foco: solo al abrir y al cerrar.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-autofocus-skip])');
    (focusable || panelRef.current)?.focus();
    return () => {
      previous?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissibleRef.current) onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && dismissible && onClose?.()}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`dialog${wide ? ' dialog--wide' : ''}`}>
        <span className="dialog__accent" style={{ background: tone === 'celebration' ? 'var(--gradient-celebration)' : toneConfig.accent }} />
        {!wide ? (
          <div className="dialog__badge" style={{ background: toneConfig.soft, color: toneConfig.accent }}>
            <Icon size={28} aria-hidden />
          </div>
        ) : null}
        <h2 id={titleId} className="dialog__title" style={wide ? { textAlign: 'left' } : undefined}>
          {title}
        </h2>
        {message ? (
          <div className="dialog__message" style={wide ? { textAlign: 'left' } : undefined}>
            {message}
          </div>
        ) : null}
        {children}
        {actions ? <div className="dialog__actions">{actions}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
