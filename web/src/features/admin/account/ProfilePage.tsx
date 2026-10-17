import { KeyRound, Save, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { useRepositories } from '@/data/RepositoriesProvider';
import type { ProfileDraft, Role } from '@/data/types';
import { useResource } from '@/lib/useResource';
import { Badge, Button, Card, EmptyState, PageHeader, SkeletonRows, Switch, TextField, useFeedback } from '@/ui';

const ROLE_LABEL: Record<Role, string> = { user: 'Estudiante', editor: 'Editor de contenido', admin: 'Administrador' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

type PasswordDraft = { current: string; next: string; confirm: string };
const EMPTY_PASSWORD: PasswordDraft = { current: '', next: '', confirm: '' };

/** Reglas de la contraseña nueva; devuelve los errores por campo (vacío = válida). */
export function validatePassword(draft: PasswordDraft): Partial<Record<keyof PasswordDraft, string>> {
  const errors: Partial<Record<keyof PasswordDraft, string>> = {};
  if (!draft.current) errors.current = 'Escribe tu contraseña actual.';
  if (draft.next.length < MIN_PASSWORD) errors.next = `Usa al menos ${MIN_PASSWORD} caracteres.`;
  else if (!/[a-zA-Z]/.test(draft.next) || !/\d/.test(draft.next)) errors.next = 'Combina letras y números.';
  else if (draft.next === draft.current) errors.next = 'Debe ser distinta de la actual.';
  if (!errors.next && draft.confirm !== draft.next) errors.confirm = 'Las contraseñas no coinciden.';
  return errors;
}

/** Nombre y correo de la cuenta. El cambio de correo se confirma por enlace. */
function PersonalDataCard({ userId, email }: { userId: string; email: string | null }) {
  const { account } = useRepositories();
  const { confirm, notify } = useFeedback();
  const profile = useResource(() => account.getProfile(userId), [account, userId]);
  const [draft, setDraft] = useState<ProfileDraft>({ full_name: '', email: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileDraft, string>>>({});
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const saved = useMemo<ProfileDraft>(() => ({ full_name: profile.data?.full_name || '', email: email || profile.data?.email || '' }), [profile.data, email]);
  useEffect(() => setDraft(saved), [saved]);
  const dirty = draft.full_name.trim() !== saved.full_name || draft.email.trim().toLowerCase() !== saved.email.toLowerCase();

  if (profile.loading) return <SkeletonRows rows={2} label="Cargando tu perfil" />;
  if (profile.error) {
    return <EmptyState icon={UserRound} title="No se pudo cargar tu perfil" message={profile.error} action={<Button onClick={profile.reload}>Reintentar</Button>} />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!draft.full_name.trim()) next.full_name = 'Escribe tu nombre.';
    if (!EMAIL_RE.test(draft.email.trim())) next.email = 'Escribe un correo válido.';
    setErrors(next);
    if (Object.keys(next).length) return;
    const emailChanged = draft.email.trim().toLowerCase() !== saved.email.toLowerCase();
    try {
      let emailPending = false;
      const done = await confirm({
        title: '¿Guardar tus datos?',
        message: emailChanged
          ? `Te enviaremos un enlace a ${draft.email.trim()} para confirmar el nuevo correo. Hasta entonces seguirás entrando con el actual.`
          : 'Tu nombre se actualizará en el panel y en la app.',
        tone: 'info',
        confirmLabel: 'Guardar',
        onConfirm: async () => {
          ({ emailPending } = await account.updateProfile(userId, draft, saved.email));
        },
      });
      if (!done) return;
      profile.setData((prev) => (prev ? { ...prev, full_name: draft.full_name.trim() } : prev));
      if (emailPending) {
        setPendingEmail(draft.email.trim());
        setDraft((prev) => ({ ...prev, email: saved.email }));
        notify({ tone: 'info', title: 'Revisa tu correo', message: 'Confirma el enlace que te enviamos para terminar el cambio.' });
      } else {
        notify({ tone: 'success', message: 'Datos actualizados.' });
      }
    } catch (error) {
      notify({ tone: 'danger', title: 'No se pudo guardar', message: (error as Error).message });
    }
  };

  return (
    <Card className="stack" aria-labelledby="datos-title">
      <div className="row-between">
        <h2 id="datos-title" className="row" style={{ fontSize: 18, gap: 8 }}>
          <UserRound size={20} aria-hidden /> Datos personales
        </h2>
        {profile.data ? <Badge tone={profile.data.role === 'admin' ? 'brand' : 'info'}>{ROLE_LABEL[profile.data.role]}</Badge> : null}
      </div>
      <form className="stack" onSubmit={submit} noValidate>
        <div className="grid-2">
          <TextField
            label="Nombre completo *"
            autoComplete="name"
            value={draft.full_name}
            error={errors.full_name}
            onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
          />
          <TextField
            label="Correo *"
            type="email"
            autoComplete="email"
            hint={pendingEmail ? `Pendiente de confirmar: ${pendingEmail}` : 'Lo usas para entrar al panel y a la app.'}
            value={draft.email}
            error={errors.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button
            variant="secondary"
            disabled={!dirty}
            onClick={() => {
              setErrors({});
              setDraft(saved);
            }}
          >
            Descartar
          </Button>
          <Button type="submit" icon={Save} disabled={!dirty}>
            Guardar datos
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Cambio de contraseña: pide la actual y la nueva dos veces. */
function PasswordCard({ email }: { email: string | null }) {
  const { account } = useRepositories();
  const { confirm, notify } = useFeedback();
  const [draft, setDraft] = useState<PasswordDraft>(EMPTY_PASSWORD);
  const [errors, setErrors] = useState<ReturnType<typeof validatePassword>>({});
  const [visible, setVisible] = useState(false);

  const set = (key: keyof PasswordDraft, value: string) => setDraft((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = validatePassword(draft);
    setErrors(next);
    if (Object.keys(next).length || !email) return;
    try {
      const done = await confirm({
        title: '¿Cambiar tu contraseña?',
        message: 'La próxima vez que entres al panel o a la app tendrás que usar la nueva.',
        tone: 'warning',
        confirmLabel: 'Cambiar contraseña',
        onConfirm: () => account.changePassword(email, draft.current, draft.next),
      });
      if (done) {
        setDraft(EMPTY_PASSWORD);
        notify({ tone: 'success', message: 'Contraseña actualizada.' });
      }
    } catch (error) {
      const message = (error as Error).message;
      // La actual incorrecta se muestra junto a su campo, no solo en un aviso.
      if (/actual/i.test(message)) setErrors({ current: message });
      else notify({ tone: 'danger', title: 'No se pudo cambiar', message });
    }
  };

  const type = visible ? 'text' : 'password';

  return (
    <Card className="stack" aria-labelledby="clave-title">
      <h2 id="clave-title" className="row" style={{ fontSize: 18, gap: 8 }}>
        <KeyRound size={20} aria-hidden /> Contraseña
      </h2>
      <form className="stack" onSubmit={submit} noValidate>
        {/* Campo oculto para que el gestor de contraseñas asocie la cuenta. */}
        <input type="email" autoComplete="username" value={email || ''} readOnly hidden />
        <TextField
          label="Contraseña actual *"
          type={type}
          autoComplete="current-password"
          value={draft.current}
          error={errors.current}
          onChange={(e) => set('current', e.target.value)}
        />
        <div className="grid-2">
          <TextField
            label="Nueva contraseña *"
            type={type}
            autoComplete="new-password"
            hint={`Mínimo ${MIN_PASSWORD} caracteres, con letras y números.`}
            value={draft.next}
            error={errors.next}
            onChange={(e) => set('next', e.target.value)}
          />
          <TextField
            label="Repite la nueva contraseña *"
            type={type}
            autoComplete="new-password"
            value={draft.confirm}
            error={errors.confirm}
            onChange={(e) => set('confirm', e.target.value)}
          />
        </div>
        <div className="row-between">
          <Switch label="Mostrar contraseñas" checked={visible} onChange={setVisible} />
          <Button type="submit" icon={KeyRound} disabled={!draft.current || !draft.next}>
            Cambiar contraseña
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Panel → Mi perfil: cada persona del equipo edita sus datos y su contraseña. */
export function ProfilePage() {
  const auth = useAuth();
  const user = auth.session?.user;
  if (!user) return null;
  return (
    <>
      <PageHeader title="Mi perfil" subtitle="Tus datos personales y la contraseña con la que entras al panel." />
      <div className="stack" style={{ gap: 'var(--space-6)', maxWidth: 820 }}>
        <PersonalDataCard userId={user.id} email={user.email ?? null} />
        <PasswordCard email={user.email ?? null} />
      </div>
    </>
  );
}
