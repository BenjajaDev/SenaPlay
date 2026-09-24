import { Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { useRepositories } from '@/data/RepositoriesProvider';
import type { Profile, Role } from '@/data/types';
import { useResource } from '@/lib/useResource';
import { Badge, EmptyState, PageHeader, SelectField, SkeletonRows, TextField, useFeedback } from '@/ui';

const ROLE_LABEL: Record<Role, string> = { user: 'Estudiante', editor: 'Editor de contenido', admin: 'Administrador' };

/** Gestión de roles (solo admin). El cambio lo protege también un trigger en la BD. */
export function UsersPage() {
  const { users } = useRepositories();
  const auth = useAuth();
  const { confirm, notify } = useFeedback();
  const list = useResource(() => users.list(), [users]);
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => (list.data || []).filter((profile) => `${profile.email} ${profile.full_name}`.toLowerCase().includes(query.toLowerCase())),
    [list.data, query],
  );

  const changeRole = async (profile: Profile, role: Role) => {
    if (role === profile.role) return;
    try {
      const done = await confirm({
        title: `¿Cambiar el rol de ${profile.email}?`,
        message: `Pasará de «${ROLE_LABEL[profile.role]}» a «${ROLE_LABEL[role]}».${role === 'admin' ? ' Tendrá control total de la configuración de la app.' : ''}`,
        tone: role === 'admin' ? 'danger' : 'warning',
        confirmLabel: 'Cambiar rol',
        onConfirm: () => users.setRole(profile.id, role),
      });
      if (done) {
        notify({ tone: 'success', message: 'Rol actualizado.' });
        list.reload();
      }
    } catch (error) {
      notify({ tone: 'danger', message: (error as Error).message });
    }
  };

  return (
    <>
      <PageHeader title="Usuarios y roles" subtitle="Asigna quién puede editar contenido o administrar la app" />
      <div style={{ maxWidth: 420, marginBottom: 16 }}>
        <TextField aria-label="Buscar usuarios" placeholder="Buscar por correo o nombre…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {list.loading ? (
        <SkeletonRows rows={5} label="Cargando usuarios" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="Sin usuarios" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Usuario</th>
                <th scope="col">Registro</th>
                <th scope="col">Rol</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((profile) => (
                <tr key={profile.id}>
                  <td>
                    <strong>{profile.full_name || '—'}</strong>
                    <div className="text-small text-secondary">{profile.email}</div>
                  </td>
                  <td className="text-small">{new Date(profile.created_at).toLocaleDateString('es-CL')}</td>
                  <td style={{ minWidth: 220 }}>
                    {profile.id === auth.session?.user.id ? (
                      <Badge>{ROLE_LABEL[profile.role]} (tú)</Badge>
                    ) : (
                      <SelectField
                        aria-label={`Rol de ${profile.email}`}
                        value={profile.role}
                        onChange={(e) => changeRole(profile, e.target.value as Role)}
                        options={(Object.keys(ROLE_LABEL) as Role[]).map((role) => ({ value: role, label: ROLE_LABEL[role] }))}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
