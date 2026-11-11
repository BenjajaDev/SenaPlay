import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { moveCrop, resizeCrop, type ClipSource, type CropSquare } from '@/lib/domain';

type Drag = { mode: 'move' | 'resize'; x: number; y: number; crop: CropSquare };

/**
 * Cuadro 1:1 movible y escalable sobre el video. Trabaja en píxeles del
 * video original: la escala a pantalla se calcula con el ancho visible.
 * Fuera del cuadro el video se oscurece; dentro, una guía de signado
 * (margen sobre la cabeza, línea de cintura y márgenes para los codos).
 *
 * Teclado (con el cuadro enfocado): flechas mueven 1 px (Mayús: 10 px);
 * + y − agrandan o achican 10 px (Mayús: 50 px).
 */
export function CropOverlay({
  source,
  crop,
  onChange,
  showGuide,
  children,
}: {
  source: ClipSource;
  crop: CropSquare;
  onChange: (crop: CropSquare) => void;
  showGuide: boolean;
  children: ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const update = () => setScale(stage.clientWidth / source.width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [source.width]);

  const start = (mode: Drag['mode']) => (event: PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { mode, x: event.clientX, y: event.clientY, crop };
  };

  const move = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || !scale) return;
    const dx = (event.clientX - current.x) / scale;
    const dy = (event.clientY - current.y) / scale;
    onChange(current.mode === 'move' ? moveCrop(current.crop, dx, dy, source) : resizeCrop(current.crop, dx + dy, source));
  };

  const end = () => {
    drag.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1;
    const resizeStep = event.shiftKey ? 50 : 10;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[event.key]) {
      onChange(moveCrop(crop, moves[event.key][0], moves[event.key][1], source));
    } else if (event.key === '+' || event.key === '=') {
      onChange(resizeCrop(crop, resizeStep, source));
    } else if (event.key === '-') {
      onChange(resizeCrop(crop, -resizeStep, source));
    } else {
      return;
    }
    event.preventDefault();
  };

  return (
    <div ref={stageRef} className="crop-stage" style={{ aspectRatio: `${source.width} / ${source.height}` }}>
      {children}
      {scale ? (
        <div
          className="crop-box"
          role="group"
          tabIndex={0}
          aria-label={`Encuadre: ${crop.size} px de lado, a ${crop.left} px de la izquierda y ${crop.top} px de arriba`}
          aria-describedby="crop-help"
          style={{ left: crop.left * scale, top: crop.top * scale, width: crop.size * scale, height: crop.size * scale }}
          onPointerDown={start('move')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onKeyDown={onKeyDown}
        >
          {showGuide ? (
            <div className="crop-guide" aria-hidden>
              <span className="crop-guide__head" />
              <span className="crop-guide__waist" />
            </div>
          ) : null}
          <span
            className="crop-handle"
            aria-hidden
            onPointerDown={start('resize')}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
        </div>
      ) : null}
      <span id="crop-help" className="visually-hidden">
        Arrastra el cuadro para moverlo y la esquina para cambiar su tamaño. Con el teclado: flechas para mover, más y menos para el tamaño.
      </span>
    </div>
  );
}
