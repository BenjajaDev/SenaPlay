import { ArrowDown, ArrowUp, ExternalLink, HeartHandshake, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepositories } from '@/data/RepositoriesProvider';
import { DEFAULT_SECTIONS, SECTION_KEYS } from '@/data/repositories';
import type { LandingSections, SectionItem, SectionKey, SiteIconKey } from '@/data/types';
import { SITE_ICONS } from '@/lib/site';
import { useResource } from '@/lib/useResource';
import { Badge, Button, Card, PageHeader, SelectField, SkeletonRows, Switch, TextArea, TextField, useFeedback } from '@/ui';

const MAX_ITEMS = 9;

type FieldSpec = { field: string; label: string; kind: 'text' | 'textarea' | 'switch' | 'items'; hint?: string; required?: boolean; rows?: number };

/** Qué se puede editar de cada sección (en el orden en que aparecen en la landing). */
const SPECS: Record<SectionKey, { label: string; description: string; fields: FieldSpec[] }> = {
  hero: {
    label: 'Portada',
    description: 'Lo primero que se ve: etiqueta, título, texto y botones.',
    fields: [
      { field: 'badge', label: 'Etiqueta', kind: 'text', hint: 'Texto corto sobre el título. Déjalo vacío para ocultarla.' },
      { field: 'title', label: 'Título', kind: 'text', required: true },
      { field: 'text', label: 'Texto', kind: 'textarea', required: true, rows: 3 },
      { field: 'primaryLabel', label: 'Botón principal', kind: 'text', required: true, hint: 'Lleva a la descarga para Android.' },
      { field: 'secondaryLabel', label: 'Botón secundario', kind: 'text', hint: 'Baja a la primera sección visible. Vacío = sin botón.' },
    ],
  },
  metrics: {
    label: 'Cifras',
    description: 'Niveles disponibles, ejercicios, entradas de diccionario, vocabulario, videos publicados y usuarios registrados. Las cifras se calculan solas.',
    fields: [
      { field: 'visible', label: 'Mostrar las cifras en la landing', kind: 'switch' },
      { field: 'title', label: 'Nombre de la sección', kind: 'text', required: true, hint: 'No se ve en pantalla: lo anuncia el lector de pantalla.' },
    ],
  },
  features: {
    label: 'Características',
    description: 'Tarjetas con lo que ofrece SeñaPlay.',
    fields: [
      { field: 'visible', label: 'Mostrar la sección', kind: 'switch' },
      { field: 'title', label: 'Título', kind: 'text', required: true },
      { field: 'items', label: 'Tarjetas', kind: 'items' },
    ],
  },
  accessibility: {
    label: 'Accesibilidad',
    description: 'Cómo SeñaPlay cuida a personas oyentes y no oyentes.',
    fields: [
      { field: 'visible', label: 'Mostrar la sección', kind: 'switch' },
      { field: 'title', label: 'Título', kind: 'text', required: true },
      { field: 'items', label: 'Puntos destacados', kind: 'items' },
    ],
  },
  publications: {
    label: 'Publicaciones',
    description: 'Título e introducción. Las publicaciones se gestionan en Sitio web → Publicaciones.',
    fields: [
      { field: 'visible', label: 'Mostrar la sección (si hay publicaciones visibles)', kind: 'switch' },
      { field: 'title', label: 'Título', kind: 'text', required: true },
      { field: 'intro', label: 'Introducción', kind: 'textarea', rows: 2, hint: 'Opcional.' },
    ],
  },
  download: {
    label: 'Descarga',
    description: 'Llamado a descargar la app. Los enlaces a las tiendas se configuran en el despliegue.',
    fields: [
      { field: 'visible', label: 'Mostrar la sección', kind: 'switch' },
      { field: 'title', label: 'Título', kind: 'text', required: true },
      { field: 'text', label: 'Texto', kind: 'textarea', required: true, rows: 2 },
    ],
  },
  footer: {
    label: 'Pie de página',
    description: 'Frase que acompaña al © al final de la landing.',
    fields: [{ field: 'text', label: 'Texto', kind: 'text', required: true }],
  },
};

const ICON_OPTIONS = (Object.keys(SITE_ICONS) as SiteIconKey[]).map((value) => ({ value, label: SITE_ICONS[value].label }));

type Errors = Record<string, string>;

/** Recorta espacios de todos los textos antes de guardar. */
function clean<T>(value: T): T {
  if (typeof value === 'string') return value.trim() as T;
  if (Array.isArray(value)) return value.map(clean) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, clean(inner)])) as T;
  return value;
}

function validate(key: SectionKey, section: Record<string, unknown>): Errors {
  const errors: Errors = {};
  SPECS[key].fields.forEach(({ field, kind, required }) => {
    if (kind === 'items') {
      const items = section.items as SectionItem[];
      if (section.visible && !items.length) errors.items = 'Agrega al menos un elemento o desactiva la sección.';
      items.forEach((item, index) => {
        if (!item.title.trim()) errors[`items.${index}.title`] = 'Campo obligatorio.';
        if (!item.text.trim()) errors[`items.${index}.text`] = 'Campo obligatorio.';
      });
    } else if (required && !String(section[field] ?? '').trim()) {
      errors[field] = 'Campo obligatorio.';
    }
  });
  return errors;
}

function ItemsEditor({ items, errors, onChange }: { items: SectionItem[]; errors: Errors; onChange: (items: SectionItem[]) => void }) {
  const update = (index: number, patch: Partial<SectionItem>) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const move = (index: number, delta: number) => {
    const next = [...items];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };

  return (
    <div className="stack-sm">
      {items.map((item, index) => {
        const Icon = SITE_ICONS[item.icon].icon;
        const name = item.title.trim() || `Elemento ${index + 1}`;
        return (
          <Card key={index} className="item-editor stack-sm">
            <div className="row-between">
              <strong className="row" style={{ gap: 8 }}>
                <Icon size={18} aria-hidden color="var(--color-primary)" /> {index + 1}. {name}
              </strong>
              <div className="row" style={{ gap: 2 }}>
                <Button variant="ghost" size="sm" icon={ArrowUp} aria-label={`Subir ${name}`} disabled={index === 0} onClick={() => move(index, -1)} />
                <Button variant="ghost" size="sm" icon={ArrowDown} aria-label={`Bajar ${name}`} disabled={index === items.length - 1} onClick={() => move(index, 1)} />
                <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Quitar ${name}`} onClick={() => onChange(items.filter((_, i) => i !== index))} />
              </div>
            </div>
            <div className="grid-2">
              <TextField label="Título *" value={item.title} error={errors[`items.${index}.title`]} onChange={(e) => update(index, { title: e.target.value })} />
              <SelectField label="Ícono" options={ICON_OPTIONS} value={item.icon} onChange={(e) => update(index, { icon: e.target.value as SiteIconKey })} />
            </div>
            <TextArea label="Texto *" rows={2} value={item.text} error={errors[`items.${index}.text`]} onChange={(e) => update(index, { text: e.target.value })} />
          </Card>
        );
      })}
      {errors.items ? (
        <span className="text-danger text-small" role="alert">
          {errors.items}
        </span>
      ) : null}
      <div>
        <Button
          variant="secondary"
          size="sm"
          icon={Plus}
          disabled={items.length >= MAX_ITEMS}
          onClick={() => onChange([...items, { icon: 'sparkles', title: '', text: '' }])}
        >
          {items.length >= MAX_ITEMS ? `Máximo ${MAX_ITEMS} elementos` : 'Agregar elemento'}
        </Button>
      </div>
    </div>
  );
}

/** Formulario de una sección: guarda solo esa clave de site_content, tras confirmar. */
function SectionForm({
  sectionKey,
  draft,
  saved,
  onDraft,
  onSaved,
}: {
  sectionKey: SectionKey;
  draft: Record<string, unknown>;
  saved: Record<string, unknown>;
  onDraft: (value: Record<string, unknown>) => void;
  onSaved: (value: Record<string, unknown>) => void;
}) {
  const { site } = useRepositories();
  const { confirm, notify } = useFeedback();
  const [errors, setErrors] = useState<Errors>({});
  const spec = SPECS[sectionKey];
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const isDefault = JSON.stringify(draft) === JSON.stringify(DEFAULT_SECTIONS[sectionKey]);

  useEffect(() => setErrors({}), [sectionKey]);

  const set = (field: string, value: unknown) => onDraft({ ...draft, [field]: value });

  const publish = async () => {
    const next = validate(sectionKey, draft);
    setErrors(next);
    if (Object.keys(next).length) {
      notify({ tone: 'warning', message: 'Revisa los campos marcados antes de publicar.' });
      return;
    }
    const value = clean(draft);
    try {
      const done = await confirm({
        title: '¿Publicar los cambios?',
        message: `La sección «${spec.label}» se actualizará en la landing de inmediato.`,
        confirmLabel: 'Publicar',
        onConfirm: () => site.saveSection(sectionKey, value as never),
      });
      if (done) {
        notify({ tone: 'success', message: `Sección «${spec.label}» actualizada.` });
        onSaved(value);
      }
    } catch (error) {
      notify({ tone: 'danger', title: 'No se pudo guardar', message: (error as Error).message });
    }
  };

  return (
    <Card className="stack" role="tabpanel" aria-label={spec.label}>
      <div className="stack-sm" style={{ gap: 4 }}>
        <h2 style={{ fontSize: 20 }}>{spec.label}</h2>
        <p className="text-secondary text-small">{spec.description}</p>
      </div>
      {spec.fields.map(({ field, label, kind, hint, required, rows }) => {
        const fullLabel = required ? `${label} *` : label;
        if (kind === 'switch') {
          return <Switch key={field} label={label} checked={Boolean(draft[field])} onChange={(value) => set(field, value)} />;
        }
        if (kind === 'items') {
          return (
            <div key={field} className="stack-sm">
              <h3 style={{ fontSize: 16 }}>{label}</h3>
              <ItemsEditor items={draft.items as SectionItem[]} errors={errors} onChange={(items) => set('items', items)} />
            </div>
          );
        }
        const common = { label: fullLabel, hint, value: String(draft[field] ?? ''), error: errors[field] };
        return kind === 'textarea' ? (
          <TextArea key={field} {...common} rows={rows} onChange={(e) => set(field, e.target.value)} />
        ) : (
          <TextField key={field} {...common} onChange={(e) => set(field, e.target.value)} />
        );
      })}
      <div className="row-between">
        <Button variant="ghost" size="sm" icon={RotateCcw} disabled={isDefault} onClick={() => onDraft(structuredClone(DEFAULT_SECTIONS[sectionKey]))}>
          Usar el texto original
        </Button>
        <div className="row">
          <Button
            variant="secondary"
            disabled={!dirty}
            onClick={() => {
              setErrors({});
              onDraft(saved);
            }}
          >
            Descartar
          </Button>
          <Button icon={Save} disabled={!dirty} onClick={publish}>
            Guardar y publicar
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Sitio web → Secciones: edita los textos de cada sección de la landing. */
export function SectionsPage() {
  const { site } = useRepositories();
  const saved = useResource(() => site.getSections(), [site]);
  const [drafts, setDrafts] = useState<LandingSections | null>(null);
  const [active, setActive] = useState<SectionKey>('hero');

  // Solo al cargar: al publicar una sección no se pisan los borradores de las demás.
  useEffect(() => {
    if (saved.data) setDrafts((prev) => prev ?? structuredClone(saved.data));
  }, [saved.data]);

  const dirtyKeys = useMemo(
    () => new Set(drafts && saved.data ? SECTION_KEYS.filter((key) => JSON.stringify(drafts[key]) !== JSON.stringify(saved.data?.[key])) : []),
    [drafts, saved.data],
  );

  return (
    <>
      <PageHeader
        title="Secciones de la landing"
        subtitle="Edita los textos de cada sección y elige cuáles se muestran. Cada sección se publica por separado."
        actions={
          <a className="btn btn--secondary btn--sm" href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden /> Ver la landing
          </a>
        }
      />
      {saved.loading || !drafts || !saved.data ? (
        <SkeletonRows rows={4} label="Cargando secciones" />
      ) : (
        <>
          <div className="section-tabs">
            <div className="section-tabs" style={{ margin: 0 }} role="tablist" aria-label="Secciones de la landing">
              {SECTION_KEYS.map((key) => (
                <button key={key} type="button" role="tab" className="filter-chip" aria-selected={active === key} onClick={() => setActive(key)}>
                  {SPECS[key].label}
                  {dirtyKeys.has(key) ? <span className="visually-hidden"> (cambios sin publicar)</span> : null}
                  {dirtyKeys.has(key) ? <span aria-hidden> •</span> : null}
                </button>
              ))}
            </div>
            {/* «Nosotros» tiene su propia página (textos + equipo con fotos). */}
            <Link to="/admin/site/about" className="filter-chip filter-chip--link">
              <HeartHandshake size={16} aria-hidden /> Nosotros
            </Link>
          </div>
          {dirtyKeys.size ? (
            <div style={{ marginBottom: 12 }}>
              <Badge tone="warning">
                {dirtyKeys.size === 1 ? '1 sección con cambios sin publicar' : `${dirtyKeys.size} secciones con cambios sin publicar`}
              </Badge>
            </div>
          ) : null}
          <SectionForm
            sectionKey={active}
            draft={drafts[active] as Record<string, unknown>}
            saved={saved.data[active] as Record<string, unknown>}
            onDraft={(value) => setDrafts((prev) => (prev ? { ...prev, [active]: value } : prev))}
            onSaved={(value) => saved.setData((prev) => (prev ? { ...prev, [active]: value } : prev))}
          />
        </>
      )}
    </>
  );
}
