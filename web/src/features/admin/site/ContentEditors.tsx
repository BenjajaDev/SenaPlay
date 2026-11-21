import { Plus, Trash2 } from 'lucide-react';
import { LANDING_LIMITS } from '@/data/repositories';
import type { AudienceCard, Highlight, SectionItem, SiteIconKey, Sponsor } from '@/data/types';
import { useListKeys } from '@/lib/listKeys';
import { initialsOf, oneInEvery, SITE_ICONS } from '@/lib/site';
import { Button, Card, SelectField, Switch, TextArea, TextField } from '@/ui';
import { ImageUploadButton, moveItem, RowActions } from './LandingMediaEditors';

export type Errors = Record<string, string>;

const ICON_OPTIONS = (Object.keys(SITE_ICONS) as SiteIconKey[]).map((value) => ({ value, label: SITE_ICONS[value].label }));

/**
 * Etiquetas como texto separado por comas. Se guarda el texto tal cual se
 * escribe (con espacios) para no mover el cursor; las vacías se quitan al
 * publicar y la landing las ignora.
 */
function TagsField({ label, tags, hint, onChange }: Readonly<{ label: string; tags: string[]; hint?: string; onChange: (tags: string[]) => void }>) {
  return (
    <TextField
      label={label}
      hint={hint || 'Sepáralas con comas.'}
      value={tags.join(',')}
      onChange={(event) => onChange(event.target.value ? event.target.value.split(',') : [])}
    />
  );
}

function ErrorText({ message }: Readonly<{ message?: string }>) {
  return message ? (
    <span className="text-danger text-small" role="alert">
      {message}
    </span>
  ) : null;
}

type ItemsVariant = 'plain' | 'feature' | 'tagged';

/** Forma común de las tarjetas editables: `highlight` solo en «La solución», `tags` solo en privacidad. */
export type EditableItem = SectionItem & { highlight?: boolean; tags?: string[] };

const NEW_ITEM: Record<ItemsVariant, EditableItem> = {
  plain: { icon: 'sparkles', title: '', text: '' },
  feature: { icon: 'sparkles', title: '', text: '', highlight: false },
  tagged: { icon: 'sparkles', title: '', text: '', tags: [] },
};

/**
 * Tarjetas con ícono, título y texto. `feature` agrega «destacar» (máximo
 * LANDING_LIMITS.highlightedFeatures) y `tagged`, etiquetas.
 */
export function ItemsEditor({
  field,
  items,
  errors,
  variant = 'plain',
  onChange,
}: Readonly<{ field: string; items: EditableItem[]; errors: Errors; variant?: ItemsVariant; onChange: (items: EditableItem[]) => void }>) {
  const rows = useListKeys(items.length);
  const update = (index: number, patch: Partial<EditableItem>) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const highlighted = items.filter((item) => item.highlight).length;
  const full = items.length >= LANDING_LIMITS.items;

  return (
    <div className="stack-sm">
      {variant === 'feature' ? (
        <span className="text-small text-secondary">
          Las destacadas se ven como tarjetas grandes (máximo {LANDING_LIMITS.highlightedFeatures}); el resto, como etiquetas bajo ellas.
        </span>
      ) : null}
      {items.map((item, index) => {
        const Icon = SITE_ICONS[item.icon].icon;
        const name = item.title.trim() || `Elemento ${index + 1}`;
        const isHighlighted = Boolean(item.highlight);
        return (
          <Card key={rows.keys[index]} className="item-editor stack-sm">
            <div className="row-between">
              <strong className="row" style={{ gap: 8 }}>
                <Icon size={18} aria-hidden color="var(--color-primary)" /> {index + 1}. {name}
              </strong>
              <RowActions
                name={name}
                index={index}
                total={items.length}
                onMove={(delta) => {
                  rows.move(index, delta);
                  onChange(moveItem(items, index, delta));
                }}
                onRemove={() => {
                  rows.remove(index);
                  onChange(items.filter((_, i) => i !== index));
                }}
              />
            </div>
            <div className="grid-2">
              <TextField label="Título *" value={item.title} error={errors[`${field}.${index}.title`]} onChange={(e) => update(index, { title: e.target.value })} />
              <SelectField label="Ícono" options={ICON_OPTIONS} value={item.icon} onChange={(e) => update(index, { icon: e.target.value as SiteIconKey })} />
            </div>
            <TextArea label="Texto *" rows={2} value={item.text} error={errors[`${field}.${index}.text`]} onChange={(e) => update(index, { text: e.target.value })} />
            {variant === 'tagged' ? <TagsField label="Etiquetas" tags={item.tags ?? []} onChange={(tags) => update(index, { tags })} /> : null}
            {variant === 'feature' ? (
              <Switch
                label="Destacar en grande"
                description={!isHighlighted && highlighted >= LANDING_LIMITS.highlightedFeatures ? `Ya hay ${LANDING_LIMITS.highlightedFeatures} destacadas: quita una para destacar esta.` : undefined}
                checked={isHighlighted}
                disabled={!isHighlighted && highlighted >= LANDING_LIMITS.highlightedFeatures}
                onChange={(value) => update(index, { highlight: value })}
              />
            ) : null}
          </Card>
        );
      })}
      <ErrorText message={errors[field]} />
      <div>
        <Button
          variant="secondary"
          size="sm"
          icon={Plus}
          disabled={full}
          onClick={() => {
            rows.add();
            onChange([...items, structuredClone(NEW_ITEM[variant])]);
          }}
        >
          {full ? `Máximo ${LANDING_LIMITS.items} elementos` : 'Agregar elemento'}
        </Button>
      </div>
    </div>
  );
}

/** Lista de textos (párrafos, leyes) con orden y borrado. */
export function StringListEditor({
  field,
  values,
  itemLabel,
  multiline,
  max,
  errors,
  onChange,
}: Readonly<{ field: string; values: string[]; itemLabel: string; multiline?: boolean; max: number; errors: Errors; onChange: (values: string[]) => void }>) {
  const rows = useListKeys(values.length);
  const update = (index: number, value: string) => onChange(values.map((entry, i) => (i === index ? value : entry)));
  const full = values.length >= max;
  return (
    <div className="stack-sm">
      {values.map((value, index) => {
        const label = `${itemLabel} ${index + 1} *`;
        const name = `${itemLabel.toLowerCase()} ${index + 1}`;
        return (
          <div key={rows.keys[index]} className="list-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              {multiline ? (
                <TextArea label={label} rows={4} value={value} error={errors[`${field}.${index}`]} onChange={(e) => update(index, e.target.value)} />
              ) : (
                <TextField label={label} value={value} error={errors[`${field}.${index}`]} onChange={(e) => update(index, e.target.value)} />
              )}
            </div>
            <RowActions
              name={name}
              index={index}
              total={values.length}
              onMove={(delta) => {
                rows.move(index, delta);
                onChange(moveItem(values, index, delta));
              }}
              onRemove={() => {
                rows.remove(index);
                onChange(values.filter((_, i) => i !== index));
              }}
            />
          </div>
        );
      })}
      <ErrorText message={errors[field]} />
      <div>
        <Button
          variant="secondary"
          size="sm"
          icon={Plus}
          disabled={full}
          onClick={() => {
            rows.add();
            onChange([...values, '']);
          }}
        >
          {full ? `Máximo ${max}` : `Agregar ${itemLabel.toLowerCase()}`}
        </Button>
      </div>
    </div>
  );
}

const NEW_HIGHLIGHT: Highlight = { value: '', label: '', note: '', source: '', total: null };

/** Cifras de «El problema». La primera se muestra grande. */
export function HighlightsEditor({ highlights, errors, onChange }: Readonly<{ highlights: Highlight[]; errors: Errors; onChange: (highlights: Highlight[]) => void }>) {
  const rows = useListKeys(highlights.length);
  const update = (index: number, patch: Partial<Highlight>) => onChange(highlights.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const full = highlights.length >= LANDING_LIMITS.highlights;
  return (
    <div className="stack-sm">
      <span className="text-small text-secondary">La primera cifra se muestra grande junto al texto; las demás, como tarjetas pequeñas.</span>
      {highlights.map((item, index) => {
        const name = item.value.trim() ? `cifra ${item.value.trim()}` : `cifra ${index + 1}`;
        const ratio = oneInEvery(item.value, item.total);
        return (
          <Card key={rows.keys[index]} className="item-editor stack-sm">
            <div className="row-between">
              <strong>
                {index === 0 ? 'Cifra principal' : `Cifra ${index + 1}`}
                {item.value.trim() ? ` · ${item.value.trim()}` : ''}
              </strong>
              <RowActions
                name={name}
                index={index}
                total={highlights.length}
                onMove={(delta) => {
                  rows.move(index, delta);
                  onChange(moveItem(highlights, index, delta));
                }}
                onRemove={() => {
                  rows.remove(index);
                  onChange(highlights.filter((_, i) => i !== index));
                }}
              />
            </div>
            <div className="grid-2">
              <TextField
                label="Cifra *"
                hint="Tal como se lee: 488.511, 24/7, 3 de 10…"
                value={item.value}
                error={errors[`highlights.${index}.value`]}
                onChange={(e) => update(index, { value: e.target.value })}
              />
              <TextField label="Fuente" hint="Opcional. Ej: Engloba, 2026" value={item.source} onChange={(e) => update(index, { source: e.target.value })} />
            </div>
            <TextArea label="Qué significa *" rows={2} value={item.label} error={errors[`highlights.${index}.label`]} onChange={(e) => update(index, { label: e.target.value })} />
            <TextField label="Nota" hint="Opcional. Aclaración en letra pequeña." value={item.note} onChange={(e) => update(index, { note: e.target.value })} />
            <div style={{ maxWidth: 360 }}>
              <TextField
                label="Total de referencia"
                type="number"
                inputMode="numeric"
                min={1}
                hint={ratio ? `Se mostrará «≈ 1 de cada ${ratio.toLocaleString('es-CL')} habitantes».` : 'Opcional. Ej: 17910000 habitantes, para mostrar «1 de cada N».'}
                value={item.total === null ? '' : String(item.total)}
                error={errors[`highlights.${index}.total`]}
                onChange={(e) => update(index, { total: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </div>
          </Card>
        );
      })}
      <ErrorText message={errors.highlights} />
      <div>
        <Button
          variant="secondary"
          size="sm"
          icon={Plus}
          disabled={full}
          onClick={() => {
            rows.add();
            onChange([...highlights, { ...NEW_HIGHLIGHT }]);
          }}
        >
          {full ? `Máximo ${LANDING_LIMITS.highlights} cifras` : 'Agregar cifra'}
        </Button>
      </div>
    </div>
  );
}

/** Una tarjeta de territorio o de beneficiarios. */
export function AudienceEditor({
  field,
  card,
  errors,
  onChange,
}: Readonly<{ field: string; card: AudienceCard; errors: Errors; onChange: (card: AudienceCard) => void }>) {
  const update = (patch: Partial<AudienceCard>) => onChange({ ...card, ...patch });
  return (
    <Card className="item-editor stack-sm">
      <div className="grid-2">
        <TextField label="Etiqueta" hint="Texto pequeño sobre el título." value={card.label} onChange={(e) => update({ label: e.target.value })} />
        <TextField label="Título *" value={card.title} error={errors[`${field}.title`]} onChange={(e) => update({ title: e.target.value })} />
      </div>
      <TextArea label="Texto" rows={2} hint="Opcional." value={card.text} onChange={(e) => update({ text: e.target.value })} />
      <TagsField label="Grupos o etiquetas" tags={card.tags} onChange={(tags) => update({ tags })} />
    </Card>
  );
}

const NEW_SPONSOR: Sponsor = { name: '', url: '', image_url: '', image_path: null };

/** Instituciones de «Financiamiento»: nombre, enlace y logo opcional. */
export function SponsorsEditor({ sponsors, errors, onChange }: Readonly<{ sponsors: Sponsor[]; errors: Errors; onChange: (sponsors: Sponsor[]) => void }>) {
  const rows = useListKeys(sponsors.length);
  const update = (index: number, patch: Partial<Sponsor>) => onChange(sponsors.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const full = sponsors.length >= LANDING_LIMITS.sponsors;
  return (
    <div className="stack-sm">
      {sponsors.map((sponsor, index) => {
        const name = sponsor.name.trim() || `institución ${index + 1}`;
        return (
          <Card key={rows.keys[index]} className="item-editor stack-sm">
            <div className="row-between">
              <strong>{name}</strong>
              <RowActions
                name={name}
                index={index}
                total={sponsors.length}
                onMove={(delta) => {
                  rows.move(index, delta);
                  onChange(moveItem(sponsors, index, delta));
                }}
                onRemove={() => {
                  rows.remove(index);
                  onChange(sponsors.filter((_, i) => i !== index));
                }}
              />
            </div>
            <div className="grid-2">
              <TextField label="Nombre *" value={sponsor.name} error={errors[`sponsors.${index}.name`]} onChange={(e) => update(index, { name: e.target.value })} />
              <TextField
                label="Enlace"
                placeholder="https://…"
                hint="Opcional."
                value={sponsor.url}
                error={errors[`sponsors.${index}.url`]}
                onChange={(e) => update(index, { url: e.target.value })}
              />
            </div>
            <div className="row">
              {sponsor.image_url ? (
                <img className="sponsor-editor__logo" src={sponsor.image_url} alt={`Logo de ${name}`} />
              ) : (
                <span className="sponsor-editor__logo sponsor-editor__logo--empty" aria-hidden>
                  {initialsOf(sponsor.name, 5) || '—'}
                </span>
              )}
              <ImageUploadButton
                label={sponsor.image_url ? 'Cambiar logo' : 'Subir logo'}
                ariaLabel={`${sponsor.image_url ? 'Cambiar' : 'Subir'} el logo de ${name}`}
                onUploaded={({ url, path }) => update(index, { image_url: url, image_path: path })}
              />
              {sponsor.image_url ? (
                <Button variant="ghost" size="sm" icon={Trash2} className="btn--ghost-danger" onClick={() => update(index, { image_url: '', image_path: null })}>
                  Quitar logo
                </Button>
              ) : (
                <span className="text-small text-muted">Sin logo se muestran sus iniciales.</span>
              )}
            </div>
          </Card>
        );
      })}
      <div>
        <Button
          variant="secondary"
          size="sm"
          icon={Plus}
          disabled={full}
          onClick={() => {
            rows.add();
            onChange([...sponsors, { ...NEW_SPONSOR }]);
          }}
        >
          {full ? `Máximo ${LANDING_LIMITS.sponsors} instituciones` : 'Agregar institución'}
        </Button>
      </div>
    </div>
  );
}
