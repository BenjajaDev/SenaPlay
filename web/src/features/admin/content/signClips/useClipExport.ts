import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExportedClip } from '@/data/repositories';
import type { ClipEdit, ClipSource } from '@/lib/domain';
import { checkExportSupport, exportClip, isCanceled, loadMediabunny, readSource, type ExportHandle } from './clipExport';

type Mediabunny = Awaited<ReturnType<typeof loadMediabunny>>;

export type ExportState =
  | { phase: 'idle' }
  | { phase: 'converting'; progress: number; retried: boolean }
  | { phase: 'error'; message: string };

/**
 * Carga mediabunny, comprueba si el navegador puede exportar, lee el video
 * elegido y lo exporta con progreso y cancelación. La UI solo lee el estado.
 */
export function useClipExport(file: File | null) {
  const [mb, setMb] = useState<Mediabunny | null>(null);
  const [unsupported, setUnsupported] = useState<string | null>(null);
  const [source, setSource] = useState<ClipSource | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [state, setState] = useState<ExportState>({ phase: 'idle' });
  const handle = useRef<ExportHandle | null>(null);

  useEffect(() => {
    let mounted = true;
    loadMediabunny()
      .then(async (module) => {
        const problem = await checkExportSupport(module);
        if (!mounted) return;
        setMb(module);
        setUnsupported(problem);
      })
      .catch(() => mounted && setUnsupported('No se pudo cargar el editor de video. Recarga la página.'));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setSource(null);
    setSourceError(null);
    if (!mb || !file || unsupported) return undefined;
    readSource(mb, file)
      .then((value) => mounted && setSource(value))
      .catch(() => mounted && setSourceError('No se pudo leer el video. Prueba con un MP4, MOV o WebM.'));
    return () => {
      mounted = false;
    };
  }, [mb, file, unsupported]);

  useEffect(
    () => () => {
      void handle.current?.cancel();
    },
    [],
  );

  const run = useCallback(
    async (edit: ClipEdit): Promise<ExportedClip | null> => {
      if (!mb || !file) return null;
      setState({ phase: 'converting', progress: 0, retried: false });
      try {
        const exported = await exportClip(mb, file, edit, {
          onStart: (next) => {
            handle.current = next;
          },
          onProgress: (progress) => setState((prev) => (prev.phase === 'converting' ? { ...prev, progress } : prev)),
          onRetry: () => setState({ phase: 'converting', progress: 0, retried: true }),
        });
        setState({ phase: 'idle' });
        return exported;
      } catch (error) {
        setState(isCanceled(mb, error) ? { phase: 'idle' } : { phase: 'error', message: (error as Error).message });
        return null;
      } finally {
        handle.current = null;
      }
    },
    [mb, file],
  );

  const cancel = useCallback(async () => {
    await handle.current?.cancel();
  }, []);

  return { ready: Boolean(mb), unsupported, source, sourceError, state, run, cancel };
}
