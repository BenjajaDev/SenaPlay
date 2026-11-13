import { MVP_CLIP_CATALOG } from '../clipCatalog';
import { SIGN_IMAGE_KEYS } from '../../data/local/signAssets';
import {
  groupClipsByKey,
  isPlayableClip,
  isValidSignKey,
  missingSignMedia,
  PHOTO_SIGN_KEYS,
  resolveSignMedia,
  toSignKey,
  toStorageFolder,
} from '../signMedia';

const clip = (overrides = {}) => ({
  id: 'c1',
  signKey: 'dolor',
  gloss: 'DOLOR',
  variant: 1,
  region: 'general',
  videoUrl: 'https://cdn.test/sign-clips/dolor/1-a.mp4',
  posterUrl: 'https://cdn.test/sign-clips/dolor/1-a.webp',
  durationMs: 2800,
  ...overrides,
});

describe('toSignKey', () => {
  test.each([
    ['DOLOR', 'dolor'],
    ['MÉDICO / DOCTOR', 'medico'],
    ['ENFERMO/A', 'enfermo'],
    ['SÍ', 'si'],
    ['DESDE / HACE', 'desde'],
    ['VÓMITO', 'vomito'],
    ['MAÑANA', 'mañana'],
    ['  Dolor de cabeza  ', 'dolor-de-cabeza'],
    ['n~', 'n~'],
    ['Ñ', 'ñ'],
  ])('%s → %s', (gloss, key) => {
    expect(toSignKey(gloss)).toBe(key);
    expect(isValidSignKey(key)).toBe(true);
  });

  test('devuelve una cadena vacía si no hay caracteres válidos', () => {
    expect(toSignKey('¿?')).toBe('');
    expect(toSignKey(null)).toBe('');
    expect(isValidSignKey('')).toBe(false);
  });
});

// Mismas salidas que `public.sign_clip_folder` en supabase/tests/10_rls_policies.sql:
// si cambias un caso aquí, cámbialo allá.
describe('toStorageFolder', () => {
  const STORAGE_SAFE = /^[A-Za-z0-9_/!.*'() &$=@;:+,?-]*$/;

  test.each([
    ['dolor', 'dolor'],
    ['mañana', 'man_ana'],
    ['ñ', 'n_'],
    ['n~', 'n_'],
    ['año-nuevo', 'an_o-nuevo'],
  ])('%s → %s', (key, folder) => {
    expect(toStorageFolder(key)).toBe(folder);
    expect(STORAGE_SAFE.test(folder)).toBe(true);
  });

  test('toda clave válida produce una carpeta aceptada por Storage', () => {
    ['mañana', 'n~', 'ñ', 'a-b-c', '19'].forEach((key) => {
      expect(STORAGE_SAFE.test(toStorageFolder(key))).toBe(true);
    });
  });
});

describe('isPlayableClip', () => {
  test('acepta un clip completo', () => {
    expect(isPlayableClip(clip())).toBe(true);
  });

  test.each([
    ['sin id', { id: '' }],
    ['clave con tilde', { signKey: 'médico' }],
    ['variante 0', { variant: 0 }],
    ['video con javascript:', { videoUrl: 'javascript:alert(1)' }],
    ['imagen sin URL', { posterUrl: null }],
    ['duración fuera de rango', { durationMs: 11000 }],
  ])('rechaza un clip %s', (_, overrides) => {
    expect(isPlayableClip(clip(overrides))).toBe(false);
  });

  test('rechaza valores que no son objetos', () => {
    expect(isPlayableClip(null)).toBe(false);
    expect(isPlayableClip('dolor')).toBe(false);
  });
});

describe('groupClipsByKey', () => {
  test('agrupa por clave, ordena por variante y descarta los inválidos', () => {
    const groups = groupClipsByKey([
      clip({ id: 'b', variant: 2 }),
      clip({ id: 'a', variant: 1 }),
      clip({ id: 'f', signKey: 'fiebre' }),
      clip({ id: 'x', videoUrl: 'ftp://nope' }),
    ]);
    expect(Object.keys(groups).sort()).toEqual(['dolor', 'fiebre']);
    expect(groups.dolor.map((c) => c.id)).toEqual(['a', 'b']);
  });

  test('tolera una entrada que no es arreglo', () => {
    expect(groupClipsByKey(undefined)).toEqual({});
  });
});

describe('resolveSignMedia', () => {
  const clipsByKey = groupClipsByKey([clip(), clip({ id: 'c2', variant: 2 })]);
  const stills = [101];

  test('prefiere el clip y entrega todas sus variantes', () => {
    const media = resolveSignMedia({ signKey: 'dolor', clipsByKey, stills });
    expect(media.kind).toBe('clip');
    expect(media.clip.id).toBe('c1');
    expect(media.variants).toHaveLength(2);
  });

  test('encuentra el clip aunque la clave venga con tildes o mayúsculas', () => {
    const byKey = groupClipsByKey([clip({ signKey: 'medico' })]);
    expect(resolveSignMedia({ signKey: 'Médico', clipsByKey: byKey }).kind).toBe('clip');
  });

  test('con el flag apagado vuelve a la foto', () => {
    expect(resolveSignMedia({ signKey: 'dolor', clipsByKey, stills, clipsEnabled: false })).toEqual({
      kind: 'still',
      sources: stills,
    });
  });

  test('sin clip ni foto muestra el placeholder con la clave en mayúsculas', () => {
    expect(resolveSignMedia({ signKey: 'tos' })).toEqual({ kind: 'placeholder', label: 'TOS' });
    expect(resolveSignMedia({ signKey: 'tos', label: '' })).toEqual({ kind: 'placeholder', label: '' });
  });
});

describe('MVP_CLIP_CATALOG', () => {
  test('tiene las 31 glosas del catálogo sanitario, cada una con clave válida y única', () => {
    const keys = MVP_CLIP_CATALOG.map((entry) => toSignKey(entry.gloss));
    expect(MVP_CLIP_CATALOG).toHaveLength(31);
    expect(keys.every(isValidSignKey)).toBe(true);
    expect(new Set(keys).size).toBe(31);
  });
});

describe('missingSignMedia', () => {
  test('la lista de fotos del dominio coincide con las fotos empaquetadas en la app', () => {
    expect([...PHOTO_SIGN_KEYS].sort()).toEqual([...SIGN_IMAGE_KEYS].sort());
  });

  test('marca solo las señas sin clip publicado ni foto, una vez cada una', () => {
    expect(missingSignMedia(['a', 'Dolor', 'MÉDICO', 'tos', 'tos', ' '], { clipKeys: ['dolor', 'medico'] })).toEqual(['tos']);
    expect(missingSignMedia(undefined)).toEqual([]);
  });
});
