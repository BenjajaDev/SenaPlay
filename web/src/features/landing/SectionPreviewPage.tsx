import { EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRepositories } from '@/data/RepositoriesProvider';
import { mergeSections } from '@/data/repositories';
import type { LandingSections, Publication, PublicStats, SectionKey } from '@/data/types';
import { parsePreviewUpdate, previewReady } from '@/lib/sectionPreview';
import { Spinner } from '@/ui';
import { SectionView } from './sections/SectionView';

type PreviewState = { key: SectionKey; sections: LandingSections; hidden: boolean };

/**
 * Vista previa de una sección (se abre dentro del editor, en un iframe). Al
 * ser una página aparte, el ancho del iframe activa los mismos cortes
 * responsivos que la landing real: así se ve también cómo queda en celular.
 */
export function SectionPreviewPage() {
  const { stats, publications } = useRepositories();
  const [state, setState] = useState<PreviewState | null>(null);
  const [data, setData] = useState<PublicStats | null | undefined>(undefined);
  const [posts, setPosts] = useState<Publication[]>([]);

  useEffect(() => {
    let mounted = true;
    stats.publicStats().then((value) => mounted && setData(value));
    publications.listPublished().then((value) => mounted && setPosts(value));
    return () => {
      mounted = false;
    };
  }, [stats, publications]);

  useEffect(() => {
    const embedded = window.parent !== window;
    const onMessage = (event: MessageEvent) => {
      if (!embedded || event.origin !== window.location.origin || event.source !== window.parent) return;
      const update = parsePreviewUpdate(event.data);
      if (!update) return;
      document.documentElement.dataset.theme = update.theme;
      const value = update.value as Record<string, unknown> | null;
      setState({ key: update.key, sections: mergeSections([{ key: update.key, value }]), hidden: value?.visible === false });
    };
    window.addEventListener('message', onMessage);
    if (embedded) window.parent.postMessage(previewReady(), window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!state) {
    return (
      <div className="preview-page preview-page--empty">
        <Spinner label="Esperando la sección…" />
      </div>
    );
  }

  return (
    <div className="preview-page">
      {state.hidden ? (
        <p className="preview-page__notice" role="status">
          <EyeOff size={16} aria-hidden /> Esta sección está oculta: no se ve en la landing.
        </p>
      ) : null}
      <SectionView sectionKey={state.key} sections={state.sections} data={{ stats: data, posts }} />
    </div>
  );
}

