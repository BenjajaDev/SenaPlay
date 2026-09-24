import { Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useRepositories } from '@/data/RepositoriesProvider';
import type { Level } from '@/data/types';
import { useResource } from '@/lib/useResource';
import { Badge, Button, EmptyState, PageHeader, SkeletonRows, useFeedback } from '@/ui';

/** Lista de niveles del catálogo (lo que ve la app en la pestaña Niveles). */
export function LevelsPage() {
  const { content } = useRepositories();
  const { confirm, notify } = useFeedback();
  const navigate = useNavigate();
  const levels = useResource(() => content.listLevels(), [content]);

  const remove = async (level: Level) => {
    try {
      const done = await confirm({
        title: `¿Eliminar «${level.title}»?`,
        message: 'Se borrarán el nivel y sus ejercicios. Quienes lo completaron conservarán su progreso local, pero ya no aparecerá en la app.',
        tone: 'danger',
        confirmLabel: 'Eliminar nivel',
        onConfirm: () => content.deleteLevel(level.id),
      });
      if (done) {
        notify({ tone: 'success', message: 'Nivel eliminado.' });
        levels.reload();
      }
    } catch (error) {
      notify({ tone: 'danger', title: 'No se pudo eliminar', message: (error as Error).message });
    }
  };

  const nextId = Math.max(0, ...(levels.data || []).map((level) => level.id)) + 1;

  return (
    <>
      <PageHeader
        title="Niveles y ejercicios"
        subtitle="Los cambios se publican en la app al guardar (sin actualizarla)."
        actions={
          <Button icon={Plus} onClick={() => navigate(`/admin/levels/new?id=${nextId}`)}>
            Nuevo nivel
          </Button>
        }
      />
      {levels.loading ? (
        <SkeletonRows rows={5} label="Cargando niveles" />
      ) : levels.error ? (
        <EmptyState icon={Layers} title="No se pudieron cargar los niveles" message={levels.error} action={<Button onClick={levels.reload}>Reintentar</Button>} />
      ) : !levels.data?.length ? (
        <EmptyState icon={Layers} title="Aún no hay niveles" message="Crea el primero o importa el catálogo con el SQL inicial." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Nivel</th>
                <th scope="col">Categoría</th>
                <th scope="col">Ejercicios</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {levels.data.map((level) => (
                <tr key={level.id}>
                  <td>{level.id}</td>
                  <td>
                    <strong>{level.title}</strong>
                    {level.description ? <div className="text-small text-secondary">{level.description}</div> : null}
                  </td>
                  <td>
                    <Badge tone="neutral">{level.category}</Badge>
                  </td>
                  <td>{level.exercise_count}</td>
                  <td>{level.available ? <Badge tone="success">Visible</Badge> : <Badge tone="warning">Oculto</Badge>}</td>
                  <td>
                    <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      <Link to={`/admin/levels/${level.id}`} className="btn btn--ghost btn--sm" aria-label={`Editar ${level.title}`}>
                        <Pencil size={16} aria-hidden /> Editar
                      </Link>
                      <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Eliminar ${level.title}`} onClick={() => remove(level)} />
                    </div>
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
