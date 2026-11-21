import { Eye, EyeOff, ExternalLink, HeartHandshake, RotateCcw, Save } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useRepositories } from '@/data/RepositoriesProvider';
import { DEFAULT_SECTIONS, LANDING_LIMITS, SECTION_KEYS, sectionImagePaths } from '@/data/repositories';
import type { AudienceCard, FooterLink, Highlight, LandingSections, PhoneScreen, SectionItem, SectionKey, SignSlide, SocialLink, Sponsor } from '@/data/types';
import { oneInEvery } from '@/lib/site';
import { safeLinkHref, socialError, socialHref } from '@/lib/social';
import { useResource } from '@/lib/useResource';
import { Badge, Button, Card, PageHeader, SkeletonRows, Switch, TextArea, TextField, useFeedback } from '@/ui';
import { AudienceEditor, HighlightsEditor, ItemsEditor, SponsorsEditor, StringListEditor, type EditableItem, type Errors } from './ContentEditors';
import { LinksEditor, ScreensEditor, SignDecksEditor } from './LandingMediaEditors';
import { SectionPreview } from './SectionPreview';
import { SocialsEditor } from './SocialsEditor';

type FieldKind =
  | 'text'
  | 'textarea'
  | 'switch'
  | 'items'
  | 'number'
  | 'signDecks'
  | 'screens'
  | 'socials'
  | 'links'
  | 'stringList'
  | 'highlights'
  | 'audience'
  | 'sponsors';

type FieldSpec = {
  field: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  required?: boolean;
  rows?: number;
  /** items: tarjetas que se pueden destacar (`feature`) o con etiquetas (`tagged`). */
  variant?: 'feature' | 'tagged';
  /** stringList: nombre de cada elemento, si es texto largo y cuántos caben. */
  itemLabel?: string;
  multiline?: boolean;
  max?: number;
};

type SectionSpec = { label: string; description: string; fields: FieldSpec[]; publicPath?: string };

/** Qué se puede editar de cada sección (en el orden en que aparecen en la landing). */
const SPECS: Record<SectionKey, SectionSpec> = {
  hero: {
    label: 'Portada',
    description: 'Lo primero que se ve: etiqueta, título, texto y botones.',
    fields: [
      { field: 'badge', label: 'Etiqueta', kind: 'text', hint: 'Texto corto sobre el título. Déjalo vacío para ocultarla.' },
      { field: 'title', label: 'Título', kind: 'text', required: true },
      { field: 'text', label: 'Texto', kind: 'textarea', required: true, rows: 3 },
      { field: 'primaryLabel', label: 'Botón principal', kind: 'text', required: true, hint: 'Lleva a la descarga para Android.' },
      { field: 'secondaryLabel', label: 'Botón secundario', kind: 'text', hint: 'Baja a la primera sección visible. Vacío = sin botón.' },
      { field: 'signsInterval', label: 'Segundos entre cambios de seña', kind: 'number', hint: 'Cada tarjeta cambia de seña a este ritmo, desfasada de las demás.' },
      { field: 'signDecks', label: 'Tarjetas de señas', kind: 'signDecks', hint: 'Las tres tarjetas junto al título. Cada una rota entre sus señas.' },
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
  problem: {
    label: 'El problema',
    description: 'Por qué existe SeñaPlay: contexto, cifras destacadas y preguntas clave.',
    fields: [
      { field: 'visible', label: 'Mostrar la sección', kind: 'switch' },
      { field: 'badge', label: 'Etiqueta', kind: 'text', hint: 'Texto corto sobre el título. Vacío = sin etiqueta.' },
      { field: 'title', label: 'Título', kind: 'text', required: true },
      { field: 'paragraphs', label: 'Texto', kind: 'stringList', itemLabel: 'Párrafo', multiline: true, max: LANDING_LIMITS.paragraphs, required: true },
      { field: 'citation', label: 'Referencia', kind: 'text', hint: 'Opcional. Se muestra en letra pequeña bajo el texto. Ej: Minte et al. (2025).' },
      { field: 'highlights', label: 'Cifras destacadas', kind: 'highlights' },
      { field: 'questions', label: 'Tarjetas de preguntas', kind: 'items' },
    ],
  },
  features: {
    label: 'La solución',
    description: 'Qué ofrece SeñaPlay. Las tarjetas destacadas van grandes y el resto como etiquetas.',
    fields: [
      { field: 'visible', label: 'Mostrar la sección', kind: 'switch' },
      { field: 'badge', label: 'Etiqueta', kind: 'text', hint: 'Texto corto sobre el título. Vacío = sin etiqueta.' },
      { field: 'title', label: 'Título', kind: 'text', required: true },
      { field: 'intro', label: 'Introducción', kind: 'textarea', rows: 3, hint: 'Opcional.' },
      { field: 'items', label: 'Tarjetas', kind: 'items', variant: 'feature' },
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
  showcase: {
    label: 'La app',
    description: 'Teléfono con capturas de la app que avanzan solas. Se muestra solo si hay al menos una captura.',
    fields: [
      { field: 'visible', label: 'Mostrar la sección', kind: 'switch' },
      { field: 'title', label: 'Título', kind: 'text', required: true },
      { field: 'text', label: 'Texto', kind: 'textarea', rows: 2, hint: 'Opcional.' },
      { field: 'interval', label: 'Segundos entre capturas', kind: 'number' },
      { field: 'screens', label: 'Capturas', kind: 'screens' },
    ],
  },
  territory: {
    label: 'Territorio',
    description: 'Dónde se sitúa el proyecto y a quién beneficia, directa e indirectamente.',
    fields: [
      { field: 'visible', label: 'Mostrar la sección', kind: 'switch' },
      { field: 'badge', label: 'Etiqueta', kind: 'text', hint: 'Texto corto sobre el título. Vacío = sin etiqueta.' },
      { field: 'title', label: 'Título', kind: 'text', required: true },
      { field: 'place', label: 'Territorio', kind: 'audience' },
      { field: 'direct', label: 'Beneficiarios directos', kind: 'audience' },
      { field: 'bridge', label: 'Texto de la flecha', kind: 'text', hint: 'Une ambas tarjetas. Opcional.' },
      { field: 'indirect', label: 'Beneficiarios indirectos', kind: 'audience' },
    ],
  },
  publications: {
    label: 'Avances',
    description: 'Título e introducción de las publicaciones (en el menú se llama «Avances»). Las publicaciones se gestionan en Sitio web → Publicaciones.',
    fields: [
      { field: 'visible', label: 'Mostrar la sección (si hay publicaciones visibles)', kind: 'switch' },
      { field: 'title', label: 'Título', kind: 'text', required: true },
      { field: 'intro', label: 'Introducción', kind: 'textarea', rows: 2, hint: 'Opcional.' },
    ],
  },
  club: {
    label: 'Club de Sordos',
    description: 'Bloque «Colaboran con nosotros» dentro de Nosotros: quién es el Club de Sordos de Talca y su rol en el proyecto. El logo es fijo.',
    fields: [
      { field: 'visible', label: 'Mostrar el bloque', kind: 'switch' },
      { field: 'name', label: 'Nombre', kind: 'text', required: true },
      { field: 'motto', label: 'Lema', kind: 'text', hint: 'Opcional. Se muestra bajo el nombre.' },
      { field: 'paragraphs', label: 'Descripción', kind: 'stringList', itemLabel: 'Párrafo', multiline: true, max: LANDING_LIMITS.paragraphs, required: true },
      { field: 'facts', label: 'Datos destacados', kind: 'items', hint: 'Ej: miembros activos, sede, tipo de organización.' },
      { field: 'roleTitle', label: 'Título del rol en el proyecto', kind: 'text' },
      { field: 'roleText', label: 'Texto del rol', kind: 'textarea', rows: 3 },
      { field: 'roles', label: 'Aportes al proyecto', kind: 'stringList', itemLabel: 'Aporte', max: LANDING_LIMITS.tags },
    ],
  },
  funding: {
    label: 'Financiamiento',
    description: 'Fuente de los fondos del proyecto e instituciones que lo respaldan.',
    fields: [
      { field: 'visible', label: 'Mostrar la sección', kind: 'switch' },
      { field: 'title', label: 'Título', kind: 'text', required: true },
      { field: 'lead', label: 'Inicio en negrita', kind: 'text', hint: 'Opcional. Ej: Fuente de financiamiento.' },
      { field: 'text', label: 'Texto', kind: 'textarea', required: true, rows: 4 },
      { field: 'sponsors', label: 'Instituciones', kind: 'sponsors' },
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
  privacy: {
    label: 'Privacidad',
    description: 'Resumen en la landing y política completa en /privacidad. Siempre visible: Google Play exige una política pública.',
    publicPath: '/privacidad',
    fields: [
      { field: 'badge', label: 'Etiqueta', kind: 'text', hint: 'Texto corto sobre el título. Vacío = sin etiqueta.' },
      { field: 'title', label: 'Título', kind: 'text', required: true },
      { field: 'intro', label: 'Introducción', kind: 'textarea', required: true, rows: 3 },
      { field: 'laws', label: 'Leyes', kind: 'stringList', itemLabel: 'Ley', max: LANDING_LIMITS.laws },
      { field: 'items', label: 'Tarjetas del resumen', kind: 'items', variant: 'tagged' },
      {
        field: 'body',
        label: 'Texto completo (/privacidad)',
        kind: 'textarea',
        required: true,
        rows: 14,
        hint: 'Separa los párrafos con una línea en blanco. Empieza un párrafo con «## » para que sea un subtítulo.',
      },
    ],
  },
  footer: {
    label: 'Pie de página',
    description: 'Marca, redes, enlaces y contacto al final de la landing. Las columnas vacías no se muestran.',
    fields: [
      { field: 'text', label: 'Frase de la marca', kind: 'text', required: true, hint: 'Aparece bajo el logo.' },
      { field: 'note', label: 'Texto junto al ©', kind: 'text', hint: 'Opcional. Ej: la línea de financiamiento.' },
      { field: 'email', label: 'Correo de contacto', kind: 'text', hint: 'Opcional.' },
      { field: 'location', label: 'Ubicación', kind: 'text', hint: 'Opcional. Ej: Talca, Chile.' },
      { field: 'socials', label: 'Redes de SeñaPlay', kind: 'socials' },
      { field: 'links', label: 'Enlaces propios', kind: 'links', hint: 'Columna «Enlaces»: sitio de la universidad, políticas, etc.' },
    ],
  },
};

const REQUIRED = 'Campo obligatorio.';

/** Recorta espacios de todos los textos y quita los vacíos de las listas de texto (etiquetas). */
function clean<T>(value: T): T {
  if (typeof value === 'string') return value.trim() as T;
  if (Array.isArray(value)) return value.map(clean).filter((entry) => entry !== '') as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, clean(inner)])) as T;
  return value;
}

const blank = (value: unknown) => !String(value ?? '').trim();

function validateItems(field: string, items: SectionItem[], mustHaveOne: boolean, errors: Errors) {
  if (mustHaveOne && !items.length) errors[field] = 'Agrega al menos un elemento o desactiva la sección.';
  items.forEach((item, index) => {
    if (blank(item.title)) errors[`${field}.${index}.title`] = REQUIRED;
    if (blank(item.text)) errors[`${field}.${index}.text`] = REQUIRED;
  });
}

function validateHighlights(highlights: Highlight[], errors: Errors) {
  highlights.forEach((item, index) => {
    if (blank(item.value)) errors[`highlights.${index}.value`] = REQUIRED;
    if (blank(item.label)) errors[`highlights.${index}.label`] = REQUIRED;
    if (item.total === null) return;
    if (!Number.isInteger(item.total) || item.total <= 0) errors[`highlights.${index}.total`] = 'Usa un número entero positivo o déjalo vacío.';
    else if (!oneInEvery(item.value, item.total)) errors[`highlights.${index}.total`] = 'Para calcular «1 de cada N», la cifra debe ser un número menor que el total.';
  });
}

function validate(key: SectionKey, section: Record<string, unknown>): Errors {
  const errors: Errors = {};
  // Las secciones sin interruptor (privacidad, portada…) siempre se muestran.
  const shown = section.visible !== false;
  SPECS[key].fields.forEach(({ field, kind, required }) => {
    const value = section[field];
    if (kind === 'items') {
      validateItems(field, value as SectionItem[], shown, errors);
    } else if (kind === 'stringList') {
      const values = value as string[];
      if (required && shown && !values.length) errors[field] = 'Agrega al menos uno o desactiva la sección.';
      values.forEach((entry, index) => {
        if (blank(entry)) errors[`${field}.${index}`] = REQUIRED;
      });
    } else if (kind === 'highlights') {
      validateHighlights(value as Highlight[], errors);
    } else if (kind === 'audience') {
      if (blank((value as AudienceCard).title)) errors[`${field}.title`] = REQUIRED;
    } else if (kind === 'sponsors') {
      (value as Sponsor[]).forEach((sponsor, index) => {
        if (blank(sponsor.name)) errors[`sponsors.${index}.name`] = REQUIRED;
        if (!blank(sponsor.url) && !safeLinkHref(sponsor.url)) errors[`sponsors.${index}.url`] = 'Usa una dirección https://…';
      });
    } else if (kind === 'number') {
      const number = Number(value);
      const { min, max } = LANDING_LIMITS.interval;
      if (!Number.isInteger(number) || number < min || number > max) errors[field] = `Usa un número entero entre ${min} y ${max}.`;
    } else if (kind === 'signDecks') {
      (value as SignSlide[][]).forEach((deck, deckIndex) =>
        deck.forEach((slide, slideIndex) => {
          if (blank(slide.label)) errors[`signDecks.${deckIndex}.${slideIndex}`] = 'Escribe la letra o palabra.';
        }),
      );
    } else if (kind === 'socials') {
      (value as SocialLink[]).forEach((link, index) => {
        const problem = socialError(link);
        if (problem) errors[`social-${index}`] = problem;
      });
    } else if (kind === 'links') {
      (value as FooterLink[]).forEach((link, index) => {
        if (blank(link.label)) errors[`links.${index}.label`] = REQUIRED;
        if (!safeLinkHref(link.url)) errors[`links.${index}.url`] = 'Usa https://…, mailto:… o #seccion.';
      });
    } else if (required && blank(value)) {
      errors[field] = REQUIRED;
    }
  });
  if (key === 'footer' && !blank(section.email) && !socialHref({ network: 'email', url: String(section.email) })) {
    errors.email = 'Escribe un correo válido.';
  }
  return errors;
}

/** Bloque con título para los editores de listas. */
function FieldGroup({ label, hint, children }: Readonly<{ label: string; hint?: string; children: ReactNode }>) {
  return (
    <div className="stack-sm">
      <div className="stack-sm" style={{ gap: 0 }}>
        <h3 style={{ fontSize: 16 }}>{label}</h3>
        {hint ? <span className="text-small text-secondary">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

/** Un campo del formulario según su tipo. */
function FieldEditor({
  spec,
  draft,
  errors,
  set,
}: Readonly<{ spec: FieldSpec; draft: Record<string, unknown>; errors: Errors; set: (field: string, value: unknown) => void }>) {
  const { field, label, kind, hint, required, rows } = spec;
  const value = draft[field];
  const fullLabel = required ? `${label} *` : label;
  switch (kind) {
    case 'switch':
      return <Switch label={label} checked={Boolean(value)} onChange={(next) => set(field, next)} />;
    case 'items':
      return (
        <FieldGroup label={label} hint={hint}>
          <ItemsEditor field={field} items={value as EditableItem[]} variant={spec.variant} errors={errors} onChange={(next) => set(field, next)} />
        </FieldGroup>
      );
    case 'stringList':
      return (
        <FieldGroup label={fullLabel} hint={hint}>
          <StringListEditor
            field={field}
            values={value as string[]}
            itemLabel={spec.itemLabel || 'Elemento'}
            multiline={spec.multiline}
            max={spec.max || LANDING_LIMITS.items}
            errors={errors}
            onChange={(next) => set(field, next)}
          />
        </FieldGroup>
      );
    case 'highlights':
      return (
        <FieldGroup label={label} hint={hint}>
          <HighlightsEditor highlights={value as Highlight[]} errors={errors} onChange={(next) => set(field, next)} />
        </FieldGroup>
      );
    case 'audience':
      return (
        <FieldGroup label={label} hint={hint}>
          <AudienceEditor field={field} card={value as AudienceCard} errors={errors} onChange={(next) => set(field, next)} />
        </FieldGroup>
      );
    case 'sponsors':
      return (
        <FieldGroup label={label} hint={hint}>
          <SponsorsEditor sponsors={value as Sponsor[]} errors={errors} onChange={(next) => set(field, next)} />
        </FieldGroup>
      );
    case 'number': {
      const { min, max } = LANDING_LIMITS.interval;
      return (
        <div style={{ maxWidth: 320 }}>
          <TextField
            label={fullLabel}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            hint={hint || `Entre ${min} y ${max} segundos.`}
            value={String(value ?? '')}
            error={errors[field]}
            onChange={(e) => set(field, e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
      );
    }
    case 'socials':
      return (
        <SocialsEditor
          description="Se muestran en el pie de página, con su animación al pasar el mouse."
          value={value as SocialLink[]}
          errors={errors}
          onChange={(next) => set(field, next)}
        />
      );
    case 'signDecks':
      return (
        <FieldGroup label={label} hint={hint}>
          <SignDecksEditor decks={value as SignSlide[][]} errors={errors} onChange={(next) => set(field, next)} />
        </FieldGroup>
      );
    case 'screens':
      return (
        <FieldGroup label={label} hint={hint}>
          <ScreensEditor screens={value as PhoneScreen[]} onChange={(next) => set(field, next)} />
        </FieldGroup>
      );
    case 'links':
      return (
        <FieldGroup label={label} hint={hint}>
          <LinksEditor links={value as FooterLink[]} errors={errors} onChange={(next) => set(field, next)} />
        </FieldGroup>
      );
    case 'textarea':
      return <TextArea label={fullLabel} hint={hint} rows={rows} value={String(value ?? '')} error={errors[field]} onChange={(e) => set(field, e.target.value)} />;
    case 'text':
      return <TextField label={fullLabel} hint={hint} value={String(value ?? '')} error={errors[field]} onChange={(e) => set(field, e.target.value)} />;
  }
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
  // Imágenes subidas en esta visita, por sección: si al final no se usan
  // (descartar o reemplazar), se borran del bucket para no dejar huérfanas.
  const uploads = useRef(new Map<SectionKey, Set<string>>());
  const spec = SPECS[sectionKey];

  const trackUploads = (value: Record<string, unknown>) => {
    const known = new Set(sectionImagePaths(saved));
    const set = uploads.current.get(sectionKey) || new Set<string>();
    sectionImagePaths(value).forEach((path) => !known.has(path) && set.add(path));
    uploads.current.set(sectionKey, set);
  };
  const unusedPaths = (kept: Record<string, unknown>) => {
    const inUse = new Set(sectionImagePaths(kept));
    const candidates = [...sectionImagePaths(saved), ...(uploads.current.get(sectionKey) || [])];
    return [...new Set(candidates)].filter((path) => !inUse.has(path));
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const isDefault = JSON.stringify(draft) === JSON.stringify(DEFAULT_SECTIONS[sectionKey]);

  useEffect(() => setErrors({}), [sectionKey]);

  const set = (field: string, value: unknown) => {
    const next = { ...draft, [field]: value };
    trackUploads(next);
    onDraft(next);
  };

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
        site.removeLandingImages(unusedPaths(value));
        uploads.current.delete(sectionKey);
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
        {spec.publicPath ? (
          <a className="text-small" href={spec.publicPath} target="_blank" rel="noopener noreferrer">
            Ver {spec.publicPath} <ExternalLink size={13} aria-label="(se abre en otra pestaña)" />
          </a>
        ) : null}
      </div>
      {spec.fields.map((fieldSpec) => (
        <FieldEditor key={fieldSpec.field} spec={fieldSpec} draft={draft} errors={errors} set={set} />
      ))}
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
              // Lo subido y no publicado se borra; lo publicado se conserva.
              site.removeLandingImages(unusedPaths(saved).filter((path) => uploads.current.get(sectionKey)?.has(path)));
              uploads.current.delete(sectionKey);
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

/** Sitio web → Secciones: edita los textos de cada sección de la landing, con vista previa en vivo. */
export function SectionsPage() {
  const { site } = useRepositories();
  const saved = useResource(() => site.getSections(), [site]);
  const [drafts, setDrafts] = useState<LandingSections | null>(null);
  const [active, setActive] = useState<SectionKey>('hero');
  const [showPreview, setShowPreview] = useState(true);

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
        subtitle="Edita los textos de cada sección y elige cuáles se muestran. La vista previa cambia mientras escribes; cada sección se publica por separado."
        actions={
          <div className="row" style={{ gap: 8 }}>
            <Button variant="secondary" size="sm" icon={showPreview ? EyeOff : Eye} aria-pressed={showPreview} onClick={() => setShowPreview((value) => !value)}>
              {showPreview ? 'Ocultar vista previa' : 'Mostrar vista previa'}
            </Button>
            <a className="btn btn--secondary btn--sm" href="/" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} aria-hidden /> Ver la landing
            </a>
          </div>
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
          <div className={showPreview ? 'sections-workspace' : undefined}>
            <SectionForm
              sectionKey={active}
              draft={drafts[active] as Record<string, unknown>}
              saved={saved.data[active] as Record<string, unknown>}
              onDraft={(value) => setDrafts((prev) => (prev ? { ...prev, [active]: value } : prev))}
              onSaved={(value) => saved.setData((prev) => (prev ? { ...prev, [active]: value } : prev))}
            />
            {showPreview ? (
              <div className="sections-workspace__preview">
                <SectionPreview sectionKey={active} label={SPECS[active].label} value={drafts[active]} />
              </div>
            ) : null}
          </div>
        </>
      )}
    </>
  );
}
