import { CalendarDays, Eye, EyeOff, ImagePlus, Newspaper, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRepositories } from '@/data/RepositoriesProvider';
import { MAX_PHOTO_BYTES, normalizeUrl } from '@/data/repositories';
import type { Publication, PublicationCategory } from '@/data/types';
import { formatEventDate, PUBLICATION_CATEGORIES } from '@/lib/site';
import { useResource } from '@/lib/useResource';
import { Badge, Button, Card, Dialog, EmptyState, PageHeader, SelectField, SkeletonRows, Switch, TextArea, TextField, useFeedback } from '@/ui';

const MAX_SUMMARY = 280;

const EMPTY_PUBLICATION: Publication = {
  title: '',
  summary: '',
  body: '',
  category: 'actividad',
  event_date: null,
  location: '',
  link_url: '',
  cover_url: null,
  cover_path: null,
  published: false,
};

const CATEGORY_OPTIONS = (Object.keys(PUBLICATION_CATEGORIES) as PublicationCategory[]).map((value) => ({
  value,
  label: PUBLICATION_CATEGORIES[value].label,
}));

/** Formulario de una publicación, con portada opcional (se sube al guardar). */
function PublicationDialog({ publication, onClose, onSaved }: { publication: Publication | null; onClose: () => void; onSaved: () => void }) {
  const { publications } = useRepositories();
  const { confirm, notify, runBlocking } = useFeedback();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Publication>(EMPTY_PUBLICATION);
  const [cover, setCover] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Mientras la confirmación está abierta, Escape no debe cerrar también el formulario.
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!publication) return;
    setDraft(publication);
    setCover(null);
    setRemoveCover(false);
    setErrors({});
  }, [publication]);

  const preview = useMemo(() => (cover ? URL.createObjectURL(cover) : null), [cover]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const set = <K extends keyof Publication>(key: K, value: Publication[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  const pickCover = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, cover: 'Elige una imagen PNG, JPG o WebP.' }));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setErrors((prev) => ({ ...prev, cover: 'La imagen supera el máximo de 5 MB.' }));
      return;
    }
    setErrors((prev) => ({ ...prev, cover: '' }));
    setCover(file);
    setRemoveCover(false);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!draft.title.trim()) next.title = 'Campo obligatorio.';
    if (!draft.summary.trim()) next.summary = 'Campo obligatorio.';
    else if (draft.summary.trim().length > MAX_SUMMARY) next.summary = `Máximo ${MAX_SUMMARY} caracteres.`;
    if (draft.link_url?.trim() && !normalizeUrl(draft.link_url)) next.link_url = 'Escribe una dirección web válida (ej: https://ejemplo.cl).';
    setErrors(next);
    return !Object.keys(next).length;
  };

  const save = async () => {
    if (!validate()) return;
    const task = () => publications.save(draft, cover, removeCover);
    try {
      if (draft.published) {
        // Publicar (o editar algo ya visible) cambia la landing de inmediato: se confirma.
        setConfirming(true);
        const done = await confirm({
          title: draft.id ? '¿Guardar y publicar los cambios?' : '¿Publicar en la landing?',
          message: 'La publicación quedará visible para cualquier persona que visite la landing.',
          confirmLabel: 'Publicar',
          onConfirm: task,
        }).finally(() => setConfirming(false));
        if (!done) return;
      } else {
        await runBlocking(cover ? 'Subiendo imagen y guardando…' : 'Guardando…', task);
      }
      notify({ tone: 'success', message: draft.published ? 'Publicación visible en la landing.' : 'Borrador guardado.' });
      onSaved();
    } catch (error) {
      notify({ tone: 'danger', title: 'No se pudo guardar', message: (error as Error).message });
    }
  };

  const shownCover = preview || (removeCover ? null : draft.cover_url);
  const summaryLength = draft.summary.trim().length;

  return (
    <Dialog
      open={Boolean(publication)}
      wide
      dismissible={!confirming}
      title={publication?.id ? 'Editar publicación' : 'Nueva publicación'}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>{draft.published ? 'Guardar y publicar' : 'Guardar borrador'}</Button>
        </>
      }
    >
      <div className="stack" style={{ marginBottom: 20 }}>
        <div className="photo-picker">
          {shownCover ? (
            <img className="publication-admin-cover" style={{ width: 160 }} src={shownCover} alt="Vista previa de la portada" />
          ) : (
            <span className="publication-admin-cover" style={{ width: 160 }} aria-hidden>
              <ImagePlus size={28} />
            </span>
          )}
          <div className="stack-sm">
            <div className="row" style={{ gap: 6 }}>
              <Button variant="secondary" size="sm" icon={ImagePlus} onClick={() => inputRef.current?.click()}>
                {shownCover ? 'Cambiar portada' : 'Elegir portada'}
              </Button>
              {shownCover ? (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={X}
                  onClick={() => {
                    setCover(null);
                    setRemoveCover(true);
                  }}
                >
                  Quitar
                </Button>
              ) : null}
            </div>
            {errors.cover ? (
              <span className="text-danger text-small" role="alert">
                {errors.cover}
              </span>
            ) : (
              <span className="text-small text-secondary">Opcional · PNG, JPG o WebP · máx. 5 MB · idealmente horizontal (16:9)</span>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            aria-label="Portada de la publicación"
            onChange={(event) => {
              pickCover(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </div>

        <TextField label="Título *" value={draft.title} error={errors.title} onChange={(e) => set('title', e.target.value)} />
        <div className="grid-3">
          <SelectField label="Tipo *" options={CATEGORY_OPTIONS} value={draft.category} onChange={(e) => set('category', e.target.value as PublicationCategory)} />
          <TextField label="Fecha" type="date" value={draft.event_date || ''} onChange={(e) => set('event_date', e.target.value || null)} />
          <TextField label="Lugar" hint="Ej: Universidad de Chile, Santiago" value={draft.location || ''} onChange={(e) => set('location', e.target.value)} />
        </div>
        <TextArea
          label="Resumen *"
          hint={`Se muestra en la tarjeta de la landing · ${summaryLength}/${MAX_SUMMARY}`}
          rows={3}
          value={draft.summary}
          error={errors.summary}
          onChange={(e) => set('summary', e.target.value)}
        />
        <TextArea
          label="Texto completo"
          hint="Opcional: aparece al abrir «Leer más». Deja una línea en blanco entre párrafos."
          rows={6}
          value={draft.body || ''}
          onChange={(e) => set('body', e.target.value)}
        />
        <TextField
          label="Enlace"
          hint="Opcional: nota de prensa, video, fotos o sitio del evento."
          inputMode="url"
          placeholder="https://"
          value={draft.link_url || ''}
          error={errors.link_url}
          onChange={(e) => set('link_url', e.target.value)}
        />
        <Switch label="Visible en la landing" checked={draft.published} onChange={(published) => set('published', published)} />
      </div>
    </Dialog>
  );
}

/** Sitio web → Publicaciones: congresos, actividades con personas Sordas, pruebas y noticias de la landing. */
export function PublicationsPage() {
  const { publications } = useRepositories();
  const { confirm, notify } = useFeedback();
  const list = useResource(() => publications.list(), [publications]);
  const [editing, setEditing] = useState<Publication | null>(null);

  const toggleVisible = async (publication: Publication) => {
    const publishing = !publication.published;
    try {
      const done = await confirm({
        title: publishing ? `¿Publicar «${publication.title}»?` : `¿Ocultar «${publication.title}»?`,
        message: publishing ? 'Aparecerá en la sección Publicaciones de la landing.' : 'Dejará de mostrarse en la landing, pero no se borra.',
        tone: publishing ? 'info' : 'warning',
        confirmLabel: publishing ? 'Publicar' : 'Ocultar',
        onConfirm: () => publications.setPublished(publication.id as string, publishing),
      });
      if (done) list.reload();
    } catch (error) {
      notify({ tone: 'danger', message: (error as Error).message });
    }
  };

  const remove = async (publication: Publication) => {
    try {
      const done = await confirm({
        title: `¿Eliminar «${publication.title}»?`,
        message: 'Se borra junto con su portada. Esta acción no se puede deshacer.',
        tone: 'danger',
        confirmLabel: 'Eliminar',
        onConfirm: () => publications.remove(publication),
      });
      if (done) {
        notify({ tone: 'success', message: 'Publicación eliminada.' });
        list.reload();
      }
    } catch (error) {
      notify({ tone: 'danger', title: 'No se pudo eliminar', message: (error as Error).message });
    }
  };

  return (
    <>
      <PageHeader
        title="Publicaciones"
        subtitle="Congresos, actividades con la comunidad Sorda, pruebas y noticias. La sección aparece en la landing cuando hay al menos una publicación visible."
        actions={
          <Button icon={Plus} onClick={() => setEditing({ ...EMPTY_PUBLICATION })}>
            Nueva publicación
          </Button>
        }
      />

      {list.loading ? (
        <SkeletonRows rows={3} label="Cargando publicaciones" />
      ) : list.error ? (
        <EmptyState icon={Newspaper} title="No se pudieron cargar las publicaciones" message={list.error} action={<Button onClick={list.reload}>Reintentar</Button>} />
      ) : !list.data?.length ? (
        <EmptyState
          icon={Newspaper}
          title="Aún no hay publicaciones"
          message="Cuenten en qué congresos participaron, las actividades con personas Sordas o las pruebas con usuarios."
          action={
            <Button icon={Plus} onClick={() => setEditing({ ...EMPTY_PUBLICATION })}>
              Crear la primera
            </Button>
          }
        />
      ) : (
        <div className="stack-sm stagger">
          {list.data.map((publication) => {
            const category = PUBLICATION_CATEGORIES[publication.category] || PUBLICATION_CATEGORIES.otro;
            const date = formatEventDate(publication.event_date);
            return (
              <Card key={publication.id} className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
                {publication.cover_url ? (
                  <img className="publication-admin-cover" src={publication.cover_url} alt="" />
                ) : (
                  <span className="publication-admin-cover" aria-hidden>
                    <Newspaper size={24} />
                  </span>
                )}
                <div className="stack-sm" style={{ flex: 1, minWidth: 200, gap: 4 }}>
                  <strong>{publication.title}</strong>
                  <div className="row" style={{ gap: 6 }}>
                    <Badge tone={category.tone}>{category.label}</Badge>
                    {publication.published ? <Badge tone="success" icon={Eye}>Visible</Badge> : <Badge tone="neutral" icon={EyeOff}>Borrador</Badge>}
                    {date ? (
                      <span className="text-small text-secondary row" style={{ gap: 4 }}>
                        <CalendarDays size={14} aria-hidden /> {date}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-small text-secondary">{publication.summary}</span>
                </div>
                <div className="row" style={{ gap: 2 }}>
                  <Button variant="ghost" size="sm" icon={Pencil} aria-label={`Editar ${publication.title}`} onClick={() => setEditing({ ...publication })} />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={publication.published ? EyeOff : Eye}
                    aria-label={publication.published ? `Ocultar ${publication.title}` : `Publicar ${publication.title}`}
                    onClick={() => toggleVisible(publication)}
                  />
                  <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Eliminar ${publication.title}`} onClick={() => remove(publication)} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <PublicationDialog
        publication={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          list.reload();
        }}
      />
    </>
  );
}
