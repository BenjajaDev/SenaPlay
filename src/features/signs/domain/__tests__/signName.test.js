import clubTalcaClips from '../../data/content/clubTalcaClips.json';
import { buildClubIndex, CLUB_THEME_ORDER } from '../clubDictionary';
import { signDisplayName } from '../signName';

const { wordByKey } = buildClubIndex(clubTalcaClips.clips);

describe('signDisplayName', () => {
  test('señas del club: con tildes y nombres propios', () => {
    expect(signDisplayName('buenos-dias', { wordByKey })).toBe('Buenos días');
    expect(signDisplayName('viña-del-mar', { wordByKey })).toBe('Viña del Mar');
    expect(signDisplayName('cafe-color', { wordByKey })).toBe('Café (color)');
  });

  test('letras y números se dicen como tales', () => {
    expect(signDisplayName('a')).toBe('Letra A');
    expect(signDisplayName('ñ')).toBe('Letra Ñ');
    expect(signDisplayName('n~')).toBe('Letra Ñ');
    expect(signDisplayName('7', { wordByKey })).toBe('Número 7');
    expect(signDisplayName('19', { wordByKey })).toBe('Número 19');
  });

  test('sin palabra del club usa la glosa del clip y, si no hay, la clave', () => {
    expect(signDisplayName('fiebre', { clip: { gloss: 'FIEBRE' } })).toBe('Fiebre');
    expect(signDisplayName('abrir-lata')).toBe('Abrir lata');
    expect(signDisplayName('ABEJA')).toBe('Abeja');
  });

  test('sin clave no hay nombre', () => {
    expect(signDisplayName('')).toBeNull();
    expect(signDisplayName(null)).toBeNull();
    expect(signDisplayName('   ')).toBeNull();
  });
});

describe('índice del curso del club', () => {
  const { positionByKey } = buildClubIndex(clubTalcaClips.clips);

  test('los números quedan en orden numérico y la seña del tema va primero', () => {
    // El 19 no está: su único clip dura más de 10 s (CLUB_EXCLUDED_VARIANTS).
    const numbers = ['1', '2', '3', '9', '10', '11', '18', '20', '90'].map((key) => positionByKey.get(key));
    expect(numbers.every((position) => Number.isInteger(position))).toBe(true);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(positionByKey.get('numeros')).toBeLessThan(positionByKey.get('1'));
  });

  test('los temas siguen el orden del curso, sin repetir', () => {
    expect(CLUB_THEME_ORDER[0]).toBe('Saludos');
    expect(CLUB_THEME_ORDER.at(-1)).toBe('Ciudades');
    expect(new Set(CLUB_THEME_ORDER).size).toBe(CLUB_THEME_ORDER.length);
  });
});
