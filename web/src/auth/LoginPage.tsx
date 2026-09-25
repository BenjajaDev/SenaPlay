import { LogIn, ShieldAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { brandIcon } from '@/lib/brand';
import { useThemeMode } from '@/lib/useThemeMode';
import { Button, Card, TextField, useFeedback } from '@/ui';
import { useAuth } from './AuthProvider';

/** Acceso al panel. Solo usuarios con rol editor o admin pasan a /admin. */
export function LoginPage() {
  const auth = useAuth();
  const { runBlocking } = useFeedback();
  const { mode } = useThemeMode();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (auth.status === 'signedIn' && auth.isStaff) {
    const target = (location.state as { from?: string } | null)?.from || '/admin';
    return <Navigate to={target} replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }
    setError(await runBlocking('Entrando…', () => auth.signIn(email, password)));
  };

  const signedInWithoutRole = auth.status === 'signedIn' && !auth.isStaff;

  return (
    <main className="auth-page">
      <Card variant="raised" className="auth-card stack">
        <Link to="/" className="brand-link" aria-label="Volver al inicio">
          <img src={brandIcon(mode)} alt="" width={48} height={48} />
          <span>SeñaPlay</span>
        </Link>
        <div className="stack-sm" style={{ gap: 4 }}>
          <h1 style={{ fontSize: 24 }}>Panel de administración</h1>
          <p className="text-secondary">Gestiona contenido, medios y la configuración de la app.</p>
        </div>

        {signedInWithoutRole ? (
          <div className="card row" style={{ background: 'var(--color-warning-soft)', borderColor: 'var(--color-warning)' }} role="alert">
            <ShieldAlert aria-hidden color="var(--color-warning-text)" />
            <div className="stack-sm" style={{ gap: 2, flex: 1 }}>
              <strong>Tu cuenta no tiene permisos de administración</strong>
              <span className="text-small text-secondary">Pide a un administrador que te asigne el rol de editor.</span>
            </div>
            <Button variant="secondary" size="sm" onClick={auth.signOut}>
              Salir
            </Button>
          </div>
        ) : (
          <form className="stack" onSubmit={submit} noValidate>
            <TextField label="Correo" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
            <Button type="submit" icon={LogIn} iconRight block>
              Entrar
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
