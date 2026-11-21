import { Monitor, Moon, Smartphone, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { SectionKey } from '@/data/types';
import { isPreviewReady, PREVIEW_PATH, previewUpdate, type PreviewTheme } from '@/lib/sectionPreview';

type Device = 'desktop' | 'mobile';

// Ancho al que se dibuja la página en cada modo; luego se escala al panel.
const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, mobile: 390 };
const FRAME_HEIGHT = 620;

const currentTheme = (): PreviewTheme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

/**
 * Vista previa en vivo de la sección que se está editando. Muestra el
 * borrador (aún sin publicar) con los mismos componentes de la landing, en
 * escritorio o celular y en tema claro u oscuro.
 */
export function SectionPreview({ sectionKey, label, value }: Readonly<{ sectionKey: SectionKey; label: string; value: unknown }>) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Cada «listo» del iframe (incluida una recarga) vuelve a enviar el borrador.
  const [readyTick, setReadyTick] = useState(0);
  const [device, setDevice] = useState<Device>('desktop');
  const [theme, setTheme] = useState<PreviewTheme>(currentTheme);
  const [boxWidth, setBoxWidth] = useState(0);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === frameRef.current?.contentWindow && isPreviewReady(event.data)) setReadyTick((tick) => tick + 1);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (readyTick) frameRef.current?.contentWindow?.postMessage(previewUpdate(sectionKey, value, theme), window.location.origin);
  }, [readyTick, sectionKey, value, theme]);

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
            src={PREVIEW_PATH}
            className="section-preview__frame"
            style={{ width, height: FRAME_HEIGHT / scale, transform: `scale(${scale})` }}
          />
        </div>
      </div>
      <p className="text-small text-muted section-preview__caption">Muestra el borrador: los cambios se ven aquí al escribir y en la landing solo al publicar.</p>
    </section>
  );
}
