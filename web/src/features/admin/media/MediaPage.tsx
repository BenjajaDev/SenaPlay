import { Copy, Eye, EyeOff, FileText, Film, ImageIcon, Pencil, Search, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { useRepositories } from '@/data/RepositoriesProvider';
import { MAX_UPLOAD_BYTES } from '@/data/repositories';
import type { MediaItem, MediaKind } from '@/data/types';
import { useResource } from '@/lib/useResource';
import { Badge, Button, Card, Dialog, EmptyState, PageHeader, SelectField, SkeletonRows, TextArea, TextField, useFeedback } from '@/ui';

const KIND_ICON = { video: Film, image: ImageIcon, document: FileText };
const KIND_LABEL: Record<MediaKind, string> = { video: 'Video', image: 'Imagen', document: 'Documento' };
const ACCEPT = 'video/mp4,video/webm,video/quicktime,image/png,image/jpeg,image/webp,image/gif,application/pdf,text/vtt';

type Meta = { title: string; category: string; description: string; tags: string; signKey: string };
const EMPTY_META: Meta = { title: '', category: 'Básico', description: '', tags: '', signKey: '' };

const formatSize = (bytes: number | null) => (bytes ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : '');

function Preview({ item }: { item: MediaItem }) {
  if (item.kind === 'video') {
    return (
      <video src={item.public_url} controls preload="metadata" aria-label={`Vista previa de ${item.title}`}>
        {item.captions_url ? <track kind="captions" src={item.captions_url} srcLang="es" label="Español" default /> : null}
      </video>
    );
  }
  if (item.kind === 'image') return <img src={item.public_url} alt={item.title} loading="lazy" />;
  return <FileText size={40} aria-hidden color="var(--color-text-muted)" />;
}

/**
 * Gestor de medios: sube archivos al bucket `media`, los categoriza y
 * decide cuáles ve la app (publicado/borrador). Publicar y eliminar piden
 * confirmación; los videos nuevos entran como borrador.
 */
export function MediaPage() {
  const { media } = useRepositories();
  const { confirm, notify, runBlocking } = useFeedback();
  const items = useResource(() => media.list(), [media]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const [meta, setMeta] = useState<Meta>(EMPTY_META);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [filter, setFilter] = useState<{ kind: string; query: string }>({ kind: 'all', query: '' });

  const filtered = useMemo(
    () =>
      (items.data || []).filter(
        (item) =>
          (filter.kind === 'all' || item.kind === filter.kind) &&
          (!filter.query || `${item.title} ${item.category} ${item.tags.join(' ')}`.toLowerCase().includes(filter.query.toLowerCase())),
      ),
    [items.data, filter],
  );

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      notify({ tone: 'warning', title: 'Archivo muy grande', message: 'El máximo es 200 MB.' });
      return;
    }
    setPending(file);
    setMeta({ ...EMPTY_META, title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') });
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    pickFile(event.dataTransfer.files?.[0]);
  };

  const upload = async () => {
    if (!pending || !meta.title.trim()) return;
    try {
      await runBlocking(`Subiendo ${pending.name}…`, () =>
        media.upload(pending, {
          title: meta.title.trim(),
          category: meta.category.trim() || 'General',
          description: meta.description.trim(),
          tags: meta.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
          signKey: meta.signKey.trim().toLowerCase(),
        }),
      );
      notify({ tone: 'success', title: 'Archivo subido', message: 'Quedó como borrador: publícalo cuando esté listo.' });
      setPending(null);
      items.reload();
    } catch (error) {
      notify({ tone: 'danger', title: 'No se pudo subir', message: (error as Error).message });
    }
  };

  const togglePublish = async (item: MediaItem) => {
    const publishing = !item.published;
    try {
      const done = await confirm({
        title: publishing ? `¿Publicar «${item.title}»?` : `¿Ocultar «${item.title}»?`,
        message: publishing ? 'Aparecerá en la pestaña Videos de la app.' : 'Dejará de mostrarse en la app, pero no se borra.',
        tone: publishing ? 'info' : 'warning',
        confirmLabel: publishing ? 'Publicar' : 'Ocultar',
        onConfirm: () => media.update(item.id, { published: publishing }),
      });
      if (done) {
        notify({ tone: 'success', message: publishing ? 'Recurso publicado.' : 'Recurso oculto.' });
        items.reload();
      }
    } catch (error) {
      notify({ tone: 'danger', message: (error as Error).message });
    }
  };

  const remove = async (item: MediaItem) => {
    try {
      const done = await confirm({
        title: `¿Eliminar «${item.title}»?`,
        message: 'Se borra el archivo del almacenamiento. Si está publicado, desaparecerá de la app.',
        tone: 'danger',
        confirmLabel: 'Eliminar',
        onConfirm: () => media.remove(item),
      });
      if (done) {
        notify({ tone: 'success', message: 'Recurso eliminado.' });
        items.reload();
      }
    } catch (error) {
      notify({ tone: 'danger', message: (error as Error).message });
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await runBlocking('Guardando…', () =>
        media.update(editing.id, {
          title: editing.title,
          category: editing.category,
          description: editing.description,
          captions_url: editing.captions_url || null,
          duration_seconds: editing.duration_seconds || null,
          sign_key: editing.sign_key || null,
          sort_order: editing.sort_order,
        }),
      );
      notify({ tone: 'success', message: 'Cambios guardados.' });
      setEditing(null);
      items.reload();
    } catch (error) {
      notify({ tone: 'danger', message: (error as Error).message });
    }
  };

  return (
    <>
      <PageHeader title="Medios" subtitle="Videos, imágenes y documentos de aprendizaje" actions={<Button icon={Upload} onClick={() => inputRef.current?.click()}>Subir archivo</Button>} />

      <div
        className="dropzone"
        data-active={dragging}
        role="button"
        tabIndex={0}
        aria-label="Arrastra un archivo o presiona para elegirlo"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{ marginBottom: 20 }}
      >
        <Upload size={28} aria-hidden color="var(--color-primary)" />
        <strong>Arrastra un video o imagen aquí</strong>
        <span className="text-small text-secondary">MP4, WebM, PNG, JPG, WebP, PDF o subtítulos VTT · máx. 200 MB</span>
        <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={(event) => { pickFile(event.target.files?.[0]); event.target.value = ''; }} />
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <div style={{ minWidth: 200 }}>
          <SelectField
            aria-label="Filtrar por tipo"
            value={filter.kind}
            onChange={(event) => setFilter((prev) => ({ ...prev, kind: event.target.value }))}
            options={[{ value: 'all', label: 'Todos los tipos' }, { value: 'video', label: 'Videos' }, { value: 'image', label: 'Imágenes' }, { value: 'document', label: 'Documentos' }]}
          />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <TextField aria-label="Buscar medios" placeholder="Buscar por título, categoría o etiqueta…" value={filter.query} onChange={(event) => setFilter((prev) => ({ ...prev, query: event.target.value }))} />
        </div>
      </div>

      {items.loading ? (
        <SkeletonRows rows={3} label="Cargando medios" />
      ) : items.error ? (
        <EmptyState icon={Film} title="No se pudieron cargar los medios" message={items.error} action={<Button onClick={items.reload}>Reintentar</Button>} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Sin archivos" message="Sube el primero arrastrándolo al recuadro." />
      ) : (
        <div className="media-grid stagger">
          {filtered.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <Card key={item.id} variant="raised" className="stack-sm" style={{ padding: 12 }}>
                <div className="media-thumb">
                  <Preview item={item} />
                </div>
                <div className="row-between">
                  <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.title}</strong>
                  {item.published ? <Badge tone="success" icon={Eye}>Publicado</Badge> : <Badge tone="warning" icon={EyeOff}>Borrador</Badge>}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <Badge tone="neutral" icon={Icon}>{KIND_LABEL[item.kind]}</Badge>
                  <Badge tone="info">{item.category}</Badge>
                  {item.captions_url ? <Badge tone="info">CC</Badge> : null}
                  <span className="text-small text-muted">{formatSize(item.size_bytes)}</span>
                </div>
                <div className="row" style={{ gap: 2 }}>
                  <Button variant={item.published ? 'secondary' : 'primary'} size="sm" icon={item.published ? EyeOff : Eye} onClick={() => togglePublish(item)}>
                    {item.published ? 'Ocultar' : 'Publicar'}
                  </Button>
                  <Button variant="ghost" size="sm" icon={Pencil} aria-label={`Editar ${item.title}`} onClick={() => setEditing({ ...item })} />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Copy}
                    aria-label={`Copiar enlace de ${item.title}`}
                    onClick={async () => {
                      await navigator.clipboard?.writeText(item.public_url);
                      notify({ tone: 'success', message: 'Enlace copiado.' });
                    }}
                  />
                  <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Eliminar ${item.title}`} onClick={() => remove(item)} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={Boolean(pending)}
        wide
        title="Datos del archivo"
        message={pending ? `${pending.name} · ${formatSize(pending.size)}` : undefined}
        onClose={() => setPending(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>Cancelar</Button>
            <Button icon={Upload} onClick={upload} disabled={!meta.title.trim()}>Subir como borrador</Button>
          </>
        }
      >
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <TextField label="Título *" value={meta.title} error={meta.title.trim() ? null : 'El título es obligatorio.'} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
          <TextField label="Categoría" value={meta.category} hint="Ej: Básico, Intermedio, Saludos" onChange={(e) => setMeta({ ...meta, category: e.target.value })} />
          <TextField label="Etiquetas" value={meta.tags} hint="Separadas por coma" onChange={(e) => setMeta({ ...meta, tags: e.target.value })} />
          <TextField label="Seña relacionada (clave)" value={meta.signKey} hint="Opcional, ej: hola" onChange={(e) => setMeta({ ...meta, signKey: e.target.value })} />
          <div style={{ gridColumn: '1 / -1' }}>
            <TextArea label="Descripción" rows={2} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        wide
        title="Editar recurso"
        onClose={() => setEditing(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Guardar</Button>
          </>
        }
      >
        {editing ? (
          <div className="grid-2" style={{ marginBottom: 20 }}>
            <TextField label="Título" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <TextField label="Categoría" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
            <TextField label="Duración (segundos)" type="number" value={editing.duration_seconds ?? ''} onChange={(e) => setEditing({ ...editing, duration_seconds: e.target.value ? Number(e.target.value) : null })} />
            <TextField label="Orden" type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
            <TextField label="URL de subtítulos (.vtt)" hint="Sube el .vtt y pega aquí su enlace" value={editing.captions_url || ''} onChange={(e) => setEditing({ ...editing, captions_url: e.target.value })} />
            <TextField label="Seña relacionada" value={editing.sign_key || ''} onChange={(e) => setEditing({ ...editing, sign_key: e.target.value })} />
            <div style={{ gridColumn: '1 / -1' }}>
              <TextArea label="Descripción" rows={2} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
