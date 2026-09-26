import {
  BookOpen,
  Film,
  Flag,
  HeartHandshake,
  History,
  Home,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  Moon,
  Newspaper,
  Settings2,
  Sun,
  Type,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { brandIcon } from '@/lib/brand';
import { useThemeMode } from '@/lib/useThemeMode';
import { Badge, Button, useFeedback } from '@/ui';

type NavItem = { to: string; label: string; icon: LucideIcon; adminOnly?: boolean; end?: boolean };

const SECTIONS: { label: string; items: NavItem[] }[] = [
  { label: 'General', items: [{ to: '/admin', label: 'Resumen', icon: LayoutDashboard, end: true }] },
  {
    label: 'Contenido',
    items: [
      { to: '/admin/levels', label: 'Niveles y ejercicios', icon: Layers },
      { to: '/admin/dictionary', label: 'Diccionario', icon: Type },
      { to: '/admin/vocabulary', label: 'Vocabulario', icon: BookOpen },
      { to: '/admin/media', label: 'Medios', icon: Film },
    ],
  },
  {
    label: 'Sitio web',
    items: [
      { to: '/admin/site/sections', label: 'Secciones de la landing', icon: LayoutTemplate },
      { to: '/admin/site/publications', label: 'Publicaciones', icon: Newspaper },
      { to: '/admin/site/about', label: 'Nosotros', icon: HeartHandshake },
    ],
  },
  {
    label: 'App móvil',
    items: [
      { to: '/admin/config', label: 'Configuración remota', icon: Settings2, adminOnly: true },
      { to: '/admin/flags', label: 'Módulos y eventos', icon: Flag, adminOnly: true },
      { to: '/admin/audit', label: 'Historial de cambios', icon: History, adminOnly: true },
      { to: '/admin/users', label: 'Usuarios y roles', icon: Users, adminOnly: true },
    ],
  },
];

/** Estructura del backoffice: barra lateral (menú desplegable en móvil) + contenido. */
export function AdminLayout() {
  const auth = useAuth();
  const { confirm } = useFeedback();
  const { mode, toggle } = useThemeMode();
  const [open, setOpen] = useState(false);

  // En móvil el menú es un panel superpuesto: Escape lo cierra, como un diálogo.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const signOut = async () => {
    if (await confirm({ title: '¿Cerrar sesión?', message: 'Tendrás que volver a ingresar para administrar.', tone: 'warning', confirmLabel: 'Cerrar sesión' })) {
      await auth.signOut();
    }
  };

  return (
    <div className="admin">
      <a className="skip-link" href="#admin-main">
        Saltar al contenido
      </a>
      <div className="admin__topbar">
        <Button
          variant="ghost"
          icon={open ? X : Menu}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          aria-controls="admin-sidebar"
          onClick={() => setOpen((v) => !v)}
        />
        <strong>SeñaPlay · Panel</strong>
        <Button variant="ghost" icon={mode === 'dark' ? Sun : Moon} aria-label="Cambiar tema" onClick={toggle} />
      </div>

      {open ? <div className="admin__backdrop" aria-hidden onClick={() => setOpen(false)} /> : null}
      <aside id="admin-sidebar" className="admin__sidebar" data-open={open} aria-label="Navegación del panel">
        <Link to="/" className="brand-link">
          <img src={brandIcon(mode)} alt="" width={36} height={36} />
          <span>SeñaPlay</span>
        </Link>
        <nav className="admin__nav admin__nav--scroll">
          {SECTIONS.map((section) => (
            <div key={section.label} className="admin__nav">
              <span className="admin__section-label">{section.label}</span>
              {section.items
                .filter((item) => !item.adminOnly || auth.isAdmin)
                .map(({ to, label, icon: Icon, end }) => (
                  <NavLink key={to} to={to} end={end} className="admin__link" onClick={() => setOpen(false)}>
                    <Icon size={18} aria-hidden /> {label}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="admin__user">
          <div className="row-between">
            <span className="text-small text-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {auth.session?.user.email}
            </span>
            <Badge tone={auth.isAdmin ? 'brand' : 'info'}>{auth.role}</Badge>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <Link to="/" className="btn btn--ghost btn--sm">
              <Home size={16} aria-hidden /> Sitio
            </Link>
            <Button variant="ghost" size="sm" icon={mode === 'dark' ? Sun : Moon} onClick={toggle} aria-label="Cambiar tema" />
            <Button variant="ghost" size="sm" icon={LogOut} onClick={signOut}>
              Salir
            </Button>
          </div>
        </div>
      </aside>

      <main id="admin-main" className="admin__main">
        <Outlet />
      </main>
    </div>
  );
}
