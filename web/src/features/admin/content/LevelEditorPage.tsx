import { ArrowLeft, Layers, Plus, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useRepositories } from '@/data/RepositoriesProvider';
import type { ExerciseDraft, Level } from '@/data/types';
import { LEVEL_CATEGORIES } from '@/lib/domain';
import { Button, Card, EmptyState, PageHeader, SelectField, SkeletonRows, Switch, TextArea, TextField, useFeedback } from '@/ui';
import { ExerciseEditor } from './ExerciseEditor';

const EMPTY_EXERCISE: ExerciseDraft = { type: 'multiple-choice', title: '', hint: '', payload: {} };

/**
 * Editor de un nivel completo. Valida en vivo cada ejercicio con la misma
 * ExerciseFactory de la app y guarda todo en una transacción (save_level):
 * la app nunca lee un nivel a medio guardar.
 */
export function LevelEditorPage() {
  const params = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { content } = useRepositories();
  const { confirm, notify } = useFeedback();
  const isNew = params.id === undefined;

  const [level, setLevel] = useState<Omit<Level, 'updated_at' | 'exercise_count'>>({
    id: Number(search.get('id')) || 1,
    title: '',
    description: '',
    category: 'alfabeto',
    available: true,
    sort_order: Number(search.get('id')) || 0,
  });
  const [exercises, setExercises] = useState<ExerciseDraft[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (isNew) return;
    content
      .getLevel(Number(params.id))
      .then(({ exercises: loaded, ...rest }) => {
        setLevel({ id: rest.id, title: rest.title, description: rest.description, category: rest.category, available: rest.available, sort_order: rest.sort_order });
        setExercises(loaded);
      })
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setLoading(false));
  }, [content, isNew, params.id]);

  // Evita perder cambios al cerrar la pestaña.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const validation = useMemo(() => content.validateExercises(exercises), [content, exercises]);
  const invalidCount = validation.filter((item) => !item.valid).length;
  const levelErrors = { title: level.title.trim() ? null : 'El nivel necesita un título.', id: level.id > 0 ? null : 'Usa un número positivo.' };

  const updateLevel = (patch: Partial<typeof level>) => {
    setLevel((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };
  const updateExercises = (updater: (prev: ExerciseDraft[]) => ExerciseDraft[]) => {
    setExercises(updater);
    setDirty(true);
  };

  const move = (index: number, direction: -1 | 1) =>
    updateExercises((prev) => {
      const next = [...prev];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });

  const removeExercise = async (index: number) => {
    if (await confirm({ title: `¿Quitar el ejercicio ${index + 1}?`, message: 'El cambio se aplica al guardar el nivel.', tone: 'danger', confirmLabel: 'Quitar' })) {
      updateExercises((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const save = async () => {
    if (levelErrors.title || levelErrors.id || invalidCount) {
      notify({ tone: 'warning', title: 'Revisa el formulario', message: invalidCount ? `${invalidCount} ejercicio(s) con errores.` : 'Faltan datos del nivel.' });
      return;
    }
    try {
      const saved = await confirm({
        title: isNew ? '¿Crear y publicar este nivel?' : '¿Publicar los cambios?',
        message: `«${level.title}» con ${exercises.length} ejercicio(s) quedará disponible en la app en el próximo inicio.`,
        tone: 'info',
        confirmLabel: 'Publicar',
        onConfirm: async () => {
          await content.saveLevel(level, exercises);
        },
      });
      if (saved) {
        setDirty(false);
        notify({ tone: 'success', title: 'Nivel publicado', message: 'La app lo verá al refrescar el catálogo.' });
        if (isNew) navigate(`/admin/levels/${level.id}`, { replace: true });
      }
    } catch (error) {
      notify({ tone: 'danger', title: 'No se pudo guardar', message: (error as Error).message });
    }
  };

  if (loading) return <SkeletonRows rows={4} label="Cargando nivel" />;
  if (loadError) return <EmptyState icon={Layers} title="No se pudo abrir el nivel" message={loadError} action={<Link to="/admin/levels">Volver</Link>} />;

  return (
    <>
      <PageHeader
        title={isNew ? 'Nuevo nivel' : `Nivel ${level.id}`}
        subtitle={dirty ? 'Tienes cambios sin publicar' : 'Todo publicado'}
        actions={
          <>
            <Link to="/admin/levels" className="btn btn--ghost">
              <ArrowLeft size={18} aria-hidden /> Volver
            </Link>
            <Button icon={Save} onClick={save} disabled={!dirty && !isNew}>
              Guardar y publicar
            </Button>
          </>
        }
      />

      <div className="stack">
        <Card variant="raised" className="stack">
          <h2 style={{ fontSize: 18 }}>Datos del nivel</h2>
          <div className="grid-2">
            <TextField label="Número (id) *" type="number" min={1} value={level.id} disabled={!isNew} error={levelErrors.id} onChange={(e) => updateLevel({ id: Number(e.target.value) })} />
            <TextField label="Título *" value={level.title} error={dirty ? levelErrors.title : null} onChange={(e) => updateLevel({ title: e.target.value })} />
            <SelectField
              label="Categoría"
              value={level.category}
              onChange={(e) => updateLevel({ category: e.target.value })}
              options={LEVEL_CATEGORIES.map((category) => ({ value: category, label: category }))}
            />
            <TextField label="Orden en la ruta" type="number" value={level.sort_order} onChange={(e) => updateLevel({ sort_order: Number(e.target.value) })} />
          </div>
          <TextArea label="Descripción" rows={2} value={level.description || ''} onChange={(e) => updateLevel({ description: e.target.value })} />
          <Switch label="Visible en la app" description="Si está apagado, el nivel aparece como «Muy pronto»." checked={level.available} onChange={(available) => updateLevel({ available })} />
        </Card>

        <div className="row-between">
          <h2 style={{ fontSize: 18 }}>
            Ejercicios ({exercises.length}){invalidCount ? <span className="text-danger text-small"> · {invalidCount} con errores</span> : null}
          </h2>
          <Button variant="secondary" icon={Plus} onClick={() => updateExercises((prev) => [...prev, { ...EMPTY_EXERCISE, payload: {} }])}>
            Agregar ejercicio
          </Button>
        </div>

        {exercises.length === 0 ? (
          <EmptyState icon={Layers} title="Sin ejercicios" message="Un nivel sin ejercicios válidos no se muestra en la app." />
        ) : (
          exercises.map((exercise, index) => (
            <ExerciseEditor
              key={index}
              exercise={exercise}
              index={index}
              total={exercises.length}
              error={validation[index]?.error || null}
              onChange={(next) => updateExercises((prev) => prev.map((item, i) => (i === index ? next : item)))}
              onMove={(direction) => move(index, direction)}
              onDuplicate={() => updateExercises((prev) => [...prev.slice(0, index + 1), structuredClone(exercise), ...prev.slice(index + 1)])}
              onRemove={() => removeExercise(index)}
            />
          ))
        )}
      </div>
    </>
  );
}
