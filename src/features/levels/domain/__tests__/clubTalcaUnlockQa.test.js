import { toStorageFolder } from '../../../signs/domain/signMedia';
import clubTalcaLevels from '../../data/content/clubTalcaLevels.json';
import ExerciseFactory from '../ExerciseFactory';
import { isWordMatching } from '../exerciseTypes';
import { resolveUnlockedIds } from '../levelProgress';

const done = { score: 10, hits: 1, fails: 0, stars: 1 };
const firstTwelve = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, available: true, sortOrder: i + 1 }));

describe('QA club Talca: desbloqueo y carpetas', () => {
  test('quien completó 1-12 con el 13 apagado ve el 13 desbloqueado al activarse', () => {
    const completed = Object.fromEntries(firstTwelve.map((l) => [l.id, done]));
    const progress = { unlocked: firstTwelve.map((l) => l.id), completed };
    const off = [...firstTwelve, { id: 13, available: false, sortOrder: 13 }];
    expect(resolveUnlockedIds(off, progress)).not.toContain(13);
    const on = [...firstTwelve, { id: 13, available: true, sortOrder: 13 }, { id: 14, available: true, sortOrder: 14 }];
    const ids = resolveUnlockedIds(on, progress);
    expect(ids).toContain(13);
    expect(ids).not.toContain(14);
  });

  test('los niveles 13-30 del JSON existen y todos tienen ejercicios válidos', () => {
    const ids = clubTalcaLevels.levels.map((l) => l.id);
    expect(ids).toEqual(Array.from({ length: 18 }, (_, i) => i + 13));
    clubTalcaLevels.levels.forEach((l) => l.exercises.forEach((e) => expect(ExerciseFactory.validate(e).valid).toBe(true)));
  });

  test('matching en modo letras no cambia: letras y ñ no son modo palabras', () => {
    expect(isWordMatching({ letters: ['a', 'b', 'c'] })).toBe(false);
    expect(isWordMatching({ letters: ['n~', 'a'] })).toBe(false);
  });

  test('toStorageFolder: mañana -> man_ana y cumple el patrón del check SQL', () => {
    const folder = toStorageFolder('mañana');
    expect(folder).toBe('man_ana');
    const re = new RegExp(`^${folder}/[0-9]+-[0-9a-f-]{36}\.mp4$`);
    expect(re.test('man_ana/1-123e4567-e89b-12d3-a456-426614174000.mp4')).toBe(true);
    expect(re.test('man_ana/../x/1-123e4567-e89b-12d3-a456-426614174000.mp4')).toBe(false);
    expect(toStorageFolder('n~')).toBe('n_');
  });
});
