import {
  clampCrop,
  createClipEdit,
  defaultKeyFrame,
  initialCrop,
  moveCrop,
  resizeCrop,
  snapToFrame,
  validateClipEdit,
} from '../clipEdit';

const landscape = { width: 1920, height: 1080, durationMs: 12000 };
const portrait = { width: 1080, height: 1920, durationMs: 4000 };

const validEdit = (overrides = {}) => ({
  source: landscape,
  crop: { left: 420, top: 0, size: 1080 },
  trim: { startMs: 300, endMs: 3300 },
  keyFrameMs: 1500,
  ...overrides,
});

describe('encuadre', () => {
  test('parte del cuadrado más grande centrado', () => {
    expect(initialCrop(landscape)).toEqual({ left: 420, top: 0, size: 1080 });
    expect(initialCrop(portrait)).toEqual({ left: 0, top: 420, size: 1080 });
  });

  test('mover no saca el recorte del video', () => {
    const crop = { left: 420, top: 0, size: 1080 };
    expect(moveCrop(crop, 10000, -50, landscape)).toEqual({ left: 840, top: 0, size: 1080 });
    expect(moveCrop(crop, -10000, 0, landscape)).toEqual({ left: 0, top: 0, size: 1080 });
  });

  test('escalar mantiene el centro y respeta el mínimo y el máximo', () => {
    const crop = { left: 420, top: 0, size: 1080 };
    expect(resizeCrop(crop, -480, landscape)).toEqual({ left: 660, top: 240, size: 600 });
    expect(resizeCrop(crop, -5000, landscape).size).toBe(240);
    expect(resizeCrop(crop, 5000, landscape).size).toBe(1080);
  });

  test('en un video más chico que el mínimo, el recorte usa todo el lado disponible', () => {
    const tiny = { width: 200, height: 150, durationMs: 2000 };
    expect(clampCrop({ left: 30, top: 0, size: 10 }, tiny)).toEqual({ left: 30, top: 0, size: 150 });
  });

  test('redondea a píxeles enteros', () => {
    expect(clampCrop({ left: 10.6, top: 3.2, size: 500.4 }, landscape)).toEqual({ left: 11, top: 3, size: 500 });
  });
});

describe('tiempo', () => {
  test('ajusta al cuadro más cercano a 30 fps', () => {
    expect(snapToFrame(0)).toBe(0);
    expect(snapToFrame(20)).toBe(33);
    expect(snapToFrame(1010)).toBe(1000);
  });

  test('propone el punto medio del tramo como imagen fija', () => {
    expect(defaultKeyFrame({ startMs: 0, endMs: 3000 })).toBe(1500);
  });

  test('la edición inicial limita el tramo a 10 s y es válida', () => {
    const edit = createClipEdit(landscape);
    expect(edit.trim).toEqual({ startMs: 0, endMs: 10000 });
    expect(edit.keyFrameMs).toBe(5000);
    expect(validateClipEdit(edit).valid).toBe(true);
  });
});

describe('validateClipEdit', () => {
  test('acepta una edición correcta sin advertencias', () => {
    expect(validateClipEdit(validEdit())).toEqual({ valid: true, errors: {}, warnings: {} });
  });

  test('advierte, sin bloquear, cuando el encuadre mide menos de 480 px', () => {
    const result = validateClipEdit(validEdit({ crop: { left: 0, top: 0, size: 360 } }));
    expect(result.valid).toBe(true);
    expect(result.warnings.crop).toMatch(/360 px.*borroso/);
  });

  test('rechaza un encuadre que se sale del video', () => {
    const result = validateClipEdit(validEdit({ crop: { left: 1000, top: 0, size: 1080 } }));
    expect(result.errors.crop).toBe('El encuadre se sale del video.');
  });

  test('rechaza un encuadre bajo el mínimo', () => {
    expect(validateClipEdit(validEdit({ crop: { left: 0, top: 0, size: 100 } })).errors.crop).toMatch(/240 px/);
  });

  test('informa la duración con coma decimal cuando el tramo es muy largo o muy corto', () => {
    expect(validateClipEdit(validEdit({ trim: { startMs: 0, endMs: 11200 }, keyFrameMs: 100 })).errors.trim).toBe(
      'El tramo dura 11,2 s; debe durar entre 0,5 y 10,0 s.',
    );
    expect(validateClipEdit(validEdit({ trim: { startMs: 1000, endMs: 1300 }, keyFrameMs: 1100 })).errors.trim).toMatch(
      /0,3 s/,
    );
  });

  test('rechaza un tramo invertido o fuera del video', () => {
    expect(validateClipEdit(validEdit({ trim: { startMs: 3000, endMs: 1000 } })).errors.trim).toMatch(/antes del fin/);
    expect(validateClipEdit(validEdit({ trim: { startMs: 5000, endMs: 13000 } })).errors.trim).toMatch(/dentro del video/);
  });

  test('exige que la imagen fija esté dentro del tramo', () => {
    expect(validateClipEdit(validEdit({ keyFrameMs: 5000 })).errors.keyFrame).toMatch(/dentro del tramo/);
    expect(validateClipEdit(validEdit({ keyFrameMs: undefined })).errors.keyFrame).toMatch(/Elige/);
  });

  test('sin datos del video no sigue validando', () => {
    expect(validateClipEdit({ source: { width: 0, height: 0, durationMs: 0 } })).toEqual({
      valid: false,
      errors: { source: 'No se pudo leer el tamaño o la duración del video.' },
      warnings: {},
    });
    expect(validateClipEdit(undefined).valid).toBe(false);
  });
});
