import { Monitor, Moon, Smartphone, Sun } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { useRepositories } from '@/data/RepositoriesProvider';
import { mergeSections } from '@/data/repositories';
import type { Publication, PublicStats, SectionKey } from '@/data/types';
import { SectionView } from '@/features/landing/sections/SectionView';

type Device = 'desktop' | 'mobile';
type Theme = 'light' | 'dark';

// Ancho al que se dibuja la página en cada modo; luego se escala al panel.
const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, mobile: 390 };
const FRAME_HEIGHT = 620;
const ROOT_ID = 'vista-previa';

/*
 * Documento vacío del iframe. No se carga ninguna URL: así no lo bloquea la
 * cabecera `frame-ancestors 'none'` del sitio (que protege contra clickjacking)
 * y el iframe hereda la CSP y el origen del panel.
 */
const FRAME_DOC = `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body><div id="${ROOT_ID}"></div></body></html>`;

const currentTheme = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

/** Copia al iframe las hojas de estilo del panel (tokens, landing y fuentes). */
function copyStyles(target: Document) {
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => target.head.appendChild(target.importNode(node, true)));
}

/** Prepara el documento del iframe una sola vez y devuelve el nodo donde montar React. */
function prepareFrame(frame: HTMLIFrameElement): HTMLElement | null {
  const doc = frame.contentDocument;
  if (!doc?.body) return null;
  if (doc.body.dataset.ready === 'true') return doc.getElementById(ROOT_ID);
  copyStyles(doc);
  let mount = doc.getElementById(ROOT_ID);
  if (!mount) {
    mount = doc.createElement('div');
    mount.id = ROOT_ID;
    doc.body.appendChild(mount);
  }
  doc.body.dataset.ready = 'true';
  return mount;
}

/**
 * Vista previa en vivo de la sección que se está editando: el borrador (aún
 * sin publicar) con los mismos componentes de la landing. Se dibuja en un
 * iframe para que su ancho active los mismos cortes responsivos que la página
 * real, en escritorio o celular y en tema claro u oscuro.
 */
export function SectionPreview({ sectionKey, label, value }: Readonly<{ sectionKey: SectionKey; label: string; value: unknown }>) {
  const { stats, publications } = useRepositories();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<Root | null>(null);
  const mountedDoc = useRef<Document | null>(null);
  const [frameVersion, setFrameVersion] = useState(0);
  const [device, setDevice] = useState<Device>('desktop');
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const [boxWidth, setBoxWidth] = useState(0);
  const [data, setData] = useState<PublicStats | null | undefined>(undefined);
  const [posts, setPosts] = useState<Publication[]>([]);

  useEffect(() => {
    let alive = true;
    stats.publicStats().then((result) => alive && setData(result));
    publications.listPublished().then((result) => alive && setPosts(result));
    return () => {
      alive = false;
    };
  }, [stats, publications]);

  // El borrador pasa por los mismos sanitizadores que lo publicado: campos a
  // medio escribir no rompen la vista previa.
  const sections = useMemo(() => mergeSections([{ key: sectionKey, value }]), [sectionKey, value]);
  const hidden = (value as { visible?: unknown } | null)?.visible === false;

  // Cada carga del iframe trae un documento nuevo (srcdoc reemplaza al
  // about:blank inicial): se monta React de nuevo sobre ese documento.
  const mount = () => {
    const frame = frameRef.current;
    // Mismo documento (load repetido): React ya está montado ahí.
    if (!frame?.contentDocument || frame.contentDocument === mountedDoc.current) return;
    const node = prepareFrame(frame);
    if (!node) return;
    const previous = rootRef.current;
    if (previous) setTimeout(() => previous.unmount(), 0);
    rootRef.current = createRoot(node);
    mountedDoc.current = frame.contentDocument;
    setFrameVersion((version) => version + 1);
  };

  useEffect(
    () => () => {
      const root = rootRef.current;
      rootRef.current = null;
      // Desmontar fuera del render en curso evita el aviso de React.
      if (root) setTimeout(() => root.unmount(), 0);
    },
    [],
  );

  useEffect(() => {
    const root = rootRef.current;
    const doc = frameRef.current?.contentDocument;
    if (!frameVersion || !root || !doc) return;
    doc.documentElement.dataset.theme = theme;
    root.render(
      <MemoryRouter>
        <div className="preview-page">
          {hidden ? (
            <p className="preview-page__notice" role="status">
              Esta sección está oculta: no se ve en la landing.
            </p>
          ) : null}
          <SectionView sectionKey={sectionKey} sections={sections} data={{ stats: data, posts }} />
        </div>
      </MemoryRouter>,
    );
  }, [frameVersion, theme, sectionKey, sections, hidden, data, posts]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const width = DEVICE_WIDTH[device];
  const scale = boxWidth ? Math.min(1, boxWidth / width) : 1;

  return (
    <section className="card section-preview" aria-label={`Vista previa de ${label}`}>
      <div className="section-preview__bar">
        <strong className="text-small">Vista previa</strong>
        <div className="row" style={{ gap: 6 }}>
          <div className="segmented" role="group" aria-label="Tamaño de la vista previa">
            <button type="button" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>
              <Monitor size={15} aria-hidden /> Escritorio
            </button>
            <button type="button" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}>
              <Smartphone size={15} aria-hidden /> Celular
            </button>
          </div>
          <div className="segmented" role="group" aria-label="Tema de la vista previa">
            <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
              <Sun size={15} aria-hidden /> Claro
            </button>
            <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
              <Moon size={15} aria-hidden /> Oscuro
            </button>
          </div>
        </div>
      </div>
      <div ref={boxRef} className="section-preview__viewport" style={{ height: FRAME_HEIGHT }}>
        <div className="section-preview__stage" style={{ width: width * scale, height: FRAME_HEIGHT }}>
          <iframe
            ref={frameRef}
            title={`Vista previa: ${label}`}
            srcDoc={FRAME_DOC}
            className="section-preview__frame"
            style={{ width, height: FRAME_HEIGHT / scale, transform: `scale(${scale})` }}
            onLoad={mount}
          />
        </div>
      </div>
      <p className="text-small text-muted section-preview__caption">Muestra el borrador: los cambios se ven aquí al escribir y en la landing solo al publicar.</p>
    </section>
  );
}
