import { Pencil, Plus, Search, Trash2, type LucideIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useResource } from '@/lib/useResource';
import { Button, Dialog, EmptyState, PageHeader, SelectField, SkeletonRows, TextArea, TextField, useFeedback } from '@/ui';

export type CrudField<T> = {
  key: keyof T & string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'select';
  options?: string[];
  required?: boolean;
  hint?: string;
};

type Props<T extends { id?: number }> = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  itemName: string;
  load: () => Promise<T[]>;
  save: (item: T) => Promise<void>;
  remove: (id: number) => Promise<void>;
  empty: T;
  fields: CrudField<T>[];
  columns: { label: string; render: (item: T) => ReactNode }[];
  searchText: (item: T) => string;
  describe: (item: T) => string;
};

const normalize = (value: string) => value.toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Página CRUD genérica (tabla + búsqueda + formulario en diálogo +
 * eliminación con confirmación). La usan Diccionario y Vocabulario: un solo
 * componente garantiza el mismo comportamiento y feedback en ambas.
 */
export function CrudPage<T extends { id?: number }>({ title, subtitle, icon, itemName, load, save, remove, empty, fields, columns, searchText, describe }: Props<T>) {
  const { confirm, notify, runBlocking } = useFeedback();
  const items = useResource(load, []);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<T | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return (items.data || []).filter((item) => !q || normalize(searchText(item)).includes(q));
  }, [items.data, query, searchText]);

  const submit = async () => {
    if (!editing) return;
    const nextErrors: Record<string, string> = {};
    fields.forEach((field) => {
      const value = editing[field.key];
      if (field.required && (value === undefined || value === null || String(value).trim() === '')) nextErrors[field.key] = 'Campo obligatorio.';
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    try {
      await runBlocking('Guardando…', () => save(editing));
      notify({ tone: 'success', message: `${itemName} guardado.` });
      setEditing(null);
      items.reload();
    } catch (error) {
      notify({ tone: 'danger', title: 'No se pudo guardar', message: (error as Error).message });
    }
  };

  const askRemove = async (item: T) => {
    try {
      const done = await confirm({
        title: `¿Eliminar ${describe(item)}?`,
        message: 'Dejará de aparecer en la app. Esta acción no se puede deshacer.',
        tone: 'danger',
        confirmLabel: 'Eliminar',
        onConfirm: () => remove(item.id as number),
      });
      if (done) {
        notify({ tone: 'success', message: `${itemName} eliminado.` });
        items.reload();
      }
    } catch (error) {
      notify({ tone: 'danger', title: 'No se pudo eliminar', message: (error as Error).message });
    }
  };

  const setField = (key: string, value: unknown) => setEditing((prev) => (prev ? ({ ...prev, [key]: value } as T) : prev));

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Button icon={Plus} onClick={() => { setErrors({}); setEditing({ ...empty }); }}>
            Nuevo
          </Button>
        }
      />
      <div style={{ maxWidth: 420, marginBottom: 16 }}>
        <TextField aria-label={`Buscar ${itemName.toLowerCase()}`} placeholder="Buscar…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {items.loading ? (
        <SkeletonRows rows={5} />
      ) : items.error ? (
        <EmptyState icon={icon} title="No se pudo cargar" message={items.error} action={<Button onClick={items.reload}>Reintentar</Button>} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Sin resultados" message="Prueba con otra búsqueda o crea un elemento nuevo." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.label} scope="col">
                    {column.label}
                  </th>
                ))}
                <th scope="col">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, index) => (
                <tr key={item.id ?? index}>
                  {columns.map((column) => (
                    <td key={column.label}>{column.render(item)}</td>
                  ))}
                  <td>
                    <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                      <Button variant="ghost" size="sm" icon={Pencil} aria-label={`Editar ${describe(item)}`} onClick={() => { setErrors({}); setEditing({ ...item }); }} />
                      <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Eliminar ${describe(item)}`} onClick={() => askRemove(item)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={Boolean(editing)}
        wide
        title={editing?.id ? `Editar ${itemName.toLowerCase()}` : `Nuevo ${itemName.toLowerCase()}`}
        onClose={() => setEditing(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={submit}>Guardar</Button>
          </>
        }
      >
        {editing ? (
          <div className="grid-2" style={{ marginBottom: 20 }}>
            {fields.map((field) => {
              const value = editing[field.key] as unknown;
              const label = `${field.label}${field.required ? ' *' : ''}`;
              if (field.type === 'textarea') {
                return (
                  <div key={field.key} style={{ gridColumn: '1 / -1' }}>
                    <TextArea label={label} hint={field.hint} rows={3} value={(value as string) || ''} error={errors[field.key]} onChange={(e) => setField(field.key, e.target.value)} />
                  </div>
                );
              }
              if (field.type === 'select') {
                return (
                  <SelectField
                    key={field.key}
                    label={label}
                    value={(value as string) || ''}
                    error={errors[field.key]}
                    onChange={(e) => setField(field.key, e.target.value)}
                    options={[{ value: '', label: '—' }, ...(field.options || []).map((option) => ({ value: option, label: option }))]}
                  />
                );
              }
              return (
                <TextField
                  key={field.key}
                  label={label}
                  hint={field.hint}
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={value === null || value === undefined ? '' : String(value)}
                  error={errors[field.key]}
                  onChange={(e) => setField(field.key, field.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
                />
              );
            })}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
