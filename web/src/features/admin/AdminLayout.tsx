import {
  BookOpen,
  Film,
  Flag,
  History,
  Home,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings2,
  Sun,
  Type,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
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
        <Button variant="ghost" icon={Menu} aria-label="Abrir menú" aria-expanded={open} onClick={() => setOpen((v) => !v)} />
        <strong>SeñaPlay · Panel</strong>
        <Button variant="ghost" icon={mode === 'dark' ? Sun : Moon} aria-label="Cambiar tema" onClick={toggle} />
      </div>

      <aside className="admin__sidebar" data-open={open} aria-label="Navegación del panel">
        <Link to="/" className="brand-link">
          <img src="/logo.png" alt="" width={36} height={36} />
          <span>SeñaPlay</span>
        </Link>
        <nav className="admin__nav">
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
