import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spinner } from '@/ui';
import { useAuth } from './AuthProvider';

/** Protege rutas del panel: exige sesión con rol editor/admin (o admin si `admin`). */
export function RequireStaff({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') {
    return (
      <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <Spinner label="Verificando acceso…" />
      </div>
    );
  }
  if (auth.status !== 'signedIn' || !auth.isStaff) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (admin && !auth.isAdmin) {
    return (
      <div className="card" role="alert">
        <h2 style={{ fontSize: 18 }}>Solo administradores</h2>
        <p className="text-secondary">Esta sección requiere el rol de administrador.</p>
      </div>
    );
  }
  return <>{children}</>;
}
