import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/ui';

type NavLink = { href: string; label: string };

/**
 * Menú de la landing para pantallas angostas (bajo 860 px los enlaces de la
 * barra no caben). Se abre con el botón, se cierra al elegir un enlace, con
 * Escape o tocando fuera, y devuelve el foco al botón.
 */
export function MobileNav({ links }: Readonly<{ links: NavLink[] }>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (returnFocus: boolean) => {
      setOpen(false);
      if (returnFocus) rootRef.current?.querySelector('button')?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  if (!links.length) return null;

  return (
    <div ref={rootRef} className="mobile-nav">
      <Button
        variant="ghost"
        icon={open ? X : Menu}
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={open}
        aria-controls="menu-movil"
        onClick={() => setOpen((value) => !value)}
      />
      {open ? (
        <nav id="menu-movil" className="mobile-nav__panel" aria-label="Secciones">
          <ul>
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href} onClick={() => setOpen(false)}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
