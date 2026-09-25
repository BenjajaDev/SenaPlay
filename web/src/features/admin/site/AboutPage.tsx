import { Eye, EyeOff, HeartHandshake, ImagePlus, Pencil, Save, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRepositories } from '@/data/RepositoriesProvider';
import { MAX_PHOTO_BYTES } from '@/data/repositories';
import type { AboutContent, TeamMember } from '@/data/types';
import { useResource } from '@/lib/useResource';
import { Badge, Button, Card, Dialog, EmptyState, PageHeader, SkeletonRows, Switch, TextArea, TextField, useFeedback } from '@/ui';

const EMPTY_MEMBER: TeamMember = { full_name: '', role: '', bio: '', photo_url: null, photo_path: null, sort_order: 0, published: true };

const ABOUT_FIELDS: { key: keyof AboutContent; label: string; rows: number; hint?: string }[] = [
  { key: 'intro', label: 'Presentación', rows: 4, hint: 'Quiénes son y por qué crearon SeñaPlay.' },
  { key: 'mission', label: 'Misión', rows: 3, hint: 'Preséntenla como práctica y fomento de la LSCh, no como enseñanza.' },
  { key: 'vision', label: 'Visión', rows: 3 },
];

/** Textos de «Nosotros» (título, presentación, misión y visión). */
function AboutForm() {
  const { site } = useRepositories();
  const { confirm, notify } = useFeedback();
  const saved = useResource(() => site.getAbout(), [site]);
  const [draft, setDraft] = useState<AboutContent | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof AboutContent, string>>>({});

  useEffect(() => {
    if (saved.data) setDraft(saved.data);
  }, [saved.data]);

  const dirty = useMemo(() => Boolean(draft && saved.data && JSON.stringify(draft) !== JSON.stringify(saved.data)), [draft, saved.data]);

  if (saved.loading || !draft) return <SkeletonRows rows={4} label="Cargando textos" />;

  const set = (key: keyof AboutContent, value: string) => setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));

  const publish = async () => {
    const next: typeof errors = {};
    (['title', 'intro', 'mission', 'vision'] as const).forEach((key) => {
      if (!draft[key].trim()) next[key] = 'Campo obligatorio.';
    });
    setErrors(next);
    if (Object.keys(next).length) return;
    const clean = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()])) as AboutContent;
    try {
      const done = await confirm({
        title: '¿Publicar los cambios?',
        message: 'Los textos de la sección Nosotros se actualizarán en la landing de inmediato.',
        confirmLabel: 'Publicar',
        onConfirm: () => site.saveAbout(clean),
      });
      if (done) {
        notify({ tone: 'success', message: 'Sección Nosotros actualizada.' });
        saved.setData(clean);
      }
    } catch (error) {
      notify({ tone: 'danger', title: 'No se pudo guardar', message: (error as Error).message });
    }
  };

  return (
    <Card className="stack">
      <TextField label="Título de la sección *" value={draft.title} error={errors.title} onChange={(e) => set('title', e.target.value)} />
      {ABOUT_FIELDS.map((field) => (
        <TextArea
          key={field.key}
          label={`${field.label} *`}
          hint={field.hint}
          rows={field.rows}
          value={draft[field.key]}
          error={errors[field.key]}
          onChange={(e) => set(field.key, e.target.value)}
        />
      ))}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button variant="secondary" disabled={!dirty} onClick={() => { setErrors({}); setDraft(saved.data); }}>
          Descartar
        </Button>
        <Button icon={Save} disabled={!dirty} onClick={publish}>
          Guardar y publicar
        </Button>
      </div>
    </Card>
  );
}

/** Formulario de un integrante, con foto opcional (se sube al guardar). */
function MemberDialog({ member, onClose, onSaved }: { member: TeamMember | null; onClose: () => void; onSaved: () => void }) {
  const { site } = useRepositories();
  const { notify, runBlocking } = useFeedback();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<TeamMember>(EMPTY_MEMBER);
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!member) return;
    setDraft(member);
    setPhoto(null);
    setErrors({});
  }, [member]);

  // Vista previa local de la foto elegida; se libera al cambiarla o cerrar.
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, photo: 'Elige una imagen PNG, JPG o WebP.' }));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setErrors((prev) => ({ ...prev, photo: 'La foto supera el máximo de 5 MB.' }));
      return;
    }
    setErrors((prev) => ({ ...prev, photo: '' }));
    setPhoto(file);
  };

  const save = async () => {
    const next: Record<string, string> = {};
    if (!draft.full_name.trim()) next.full_name = 'Campo obligatorio.';
    if (!draft.role.trim()) next.role = 'Campo obligatorio.';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await runBlocking(photo ? 'Subiendo foto y guardando…' : 'Guardando…', () => site.saveTeamMember(draft, photo));
      notify({ tone: 'success', message: `${draft.full_name.trim()} guardado.` });
      onSaved();
    } catch (error) {
      notify({ tone: 'danger', title: 'No se pudo guardar', message: (error as Error).message });
    }
  };

  const shownPhoto = preview || draft.photo_url;

  return (
    <Dialog
      open={Boolean(member)}
      wide
      title={member?.id ? `Editar a ${member.full_name}` : 'Nuevo integrante'}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>Guardar</Button>
        </>
      }
    >
      <div className="stack" style={{ marginBottom: 20 }}>
        <div className="photo-picker">
          {shownPhoto ? (
            <img className="photo-picker__preview" src={shownPhoto} alt="Vista previa de la foto" />
          ) : (
            <span className="photo-picker__preview" aria-hidden>
              <ImagePlus size={28} />
            </span>
          )}
          <div className="stack-sm">
            <Button variant="secondary" size="sm" icon={ImagePlus} onClick={() => inputRef.current?.click()}>
              {shownPhoto ? 'Cambiar foto' : 'Elegir foto'}
            </Button>
            {errors.photo ? (
              <span className="text-danger text-small" role="alert">
                {errors.photo}
              </span>
            ) : (
              <span className="text-small text-secondary">PNG, JPG o WebP · máx. 5 MB · idealmente cuadrada</span>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            aria-label="Foto del integrante"
            onChange={(event) => {
              pickPhoto(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </div>
        <div className="grid-2">
          <TextField label="Nombre *" value={draft.full_name} error={errors.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} />
          <TextField label="Rol en el equipo *" hint="Ej: Desarrollo, Diseño, Intérprete LSCh" value={draft.role} error={errors.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
        </div>
        <TextArea label="Descripción" hint="Opcional: una o dos frases." rows={3} value={draft.bio || ''} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} />
        <div className="grid-2" style={{ alignItems: 'center' }}>
          <TextField label="Orden" hint="Los números menores aparecen primero." type="number" value={String(draft.sort_order)} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })} />
          <Switch label="Visible en la landing" checked={draft.published} onChange={(published) => setDraft({ ...draft, published })} />
        </div>
      </div>
    </Dialog>
  );
}

/** Integrantes del equipo que muestra la landing. */
function TeamManager() {
  const { site } = useRepositories();
  const { confirm, notify } = useFeedback();
  const team = useResource(() => site.listTeam(), [site]);
  const [editing, setEditing] = useState<TeamMember | null>(null);

  const toggleVisible = async (member: TeamMember) => {
    const publishing = !member.published;
    try {
      const done = await confirm({
        title: publishing ? `¿Mostrar a ${member.full_name}?` : `¿Ocultar a ${member.full_name}?`,
        message: publishing ? 'Aparecerá en la sección Nosotros de la landing.' : 'Dejará de mostrarse en la landing, pero no se borra.',
        tone: publishing ? 'info' : 'warning',
        confirmLabel: publishing ? 'Mostrar' : 'Ocultar',
        onConfirm: () => site.setTeamMemberPublished(member.id as string, publishing),
      });
      if (done) team.reload();
    } catch (error) {
      notify({ tone: 'danger', message: (error as Error).message });
    }
  };

  const remove = async (member: TeamMember) => {
    try {
      const done = await confirm({
        title: `¿Eliminar a ${member.full_name}?`,
        message: 'Se borra del equipo junto con su foto. Esta acción no se puede deshacer.',
        tone: 'danger',
        confirmLabel: 'Eliminar',
        onConfirm: () => site.deleteTeamMember(member),
      });
      if (done) {
        notify({ tone: 'success', message: 'Integrante eliminado.' });
        team.reload();
      }
    } catch (error) {
      notify({ tone: 'danger', title: 'No se pudo eliminar', message: (error as Error).message });
    }
  };

  return (
    <section className="stack" aria-labelledby="equipo-title">
      <div className="row-between">
        <h2 id="equipo-title" style={{ fontSize: 20 }}>
          Equipo
        </h2>
        <Button icon={UserPlus} onClick={() => setEditing({ ...EMPTY_MEMBER, sort_order: team.data?.length || 0 })}>
          Agregar integrante
        </Button>
      </div>

      {team.loading ? (
        <SkeletonRows rows={3} label="Cargando equipo" />
      ) : team.error ? (
        <EmptyState icon={HeartHandshake} title="No se pudo cargar el equipo" message={team.error} action={<Button onClick={team.reload}>Reintentar</Button>} />
      ) : !team.data?.length ? (
        <EmptyState icon={HeartHandshake} title="Aún no hay integrantes" message="Agrega a las personas que participan en SeñaPlay para mostrarlas en la landing." />
      ) : (
        <div className="grid-2 stagger">
          {team.data.map((member) => (
            <Card key={member.id} className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
              {member.photo_url ? (
                <img className="team-admin-photo" src={member.photo_url} alt="" />
              ) : (
                <span className="team-admin-photo team-card__initials" style={{ fontSize: 20 }} aria-hidden>
                  {member.full_name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="stack-sm" style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <strong>{member.full_name}</strong>
                <span className="text-small text-secondary">{member.role}</span>
                <div>{member.published ? <Badge tone="success" icon={Eye}>Visible</Badge> : <Badge tone="neutral" icon={EyeOff}>Oculto</Badge>}</div>
              </div>
              <div className="row" style={{ gap: 2 }}>
                <Button variant="ghost" size="sm" icon={Pencil} aria-label={`Editar a ${member.full_name}`} onClick={() => setEditing({ ...member })} />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={member.published ? EyeOff : Eye}
                  aria-label={member.published ? `Ocultar a ${member.full_name}` : `Mostrar a ${member.full_name}`}
                  onClick={() => toggleVisible(member)}
                />
                <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Eliminar a ${member.full_name}`} onClick={() => remove(member)} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <MemberDialog
        member={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          team.reload();
        }}
      />
    </section>
  );
}

/** Sitio web → Nosotros: textos (misión, visión) y equipo de la landing. */
export function AboutPage() {
  return (
    <>
      <PageHeader title="Nosotros" subtitle="Textos y equipo de la sección «Nosotros» de la landing pública." />
      <div className="stack" style={{ gap: 'var(--space-8)' }}>
        <AboutForm />
        <TeamManager />
      </div>
    </>
  );
}
