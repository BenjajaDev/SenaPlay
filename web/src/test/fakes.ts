import { vi } from 'vitest';
import type { Repositories } from '@/data/repositories';
import type { AboutContent, FeatureFlag, Level, MediaItem, TeamMember } from '@/data/types';

// Repositorios en memoria para probar pantallas sin Supabase.
export function fakeRepositories(overrides: Partial<Repositories> = {}): Repositories {
  const levels: Level[] = [
    { id: 1, title: 'Letras A-E', description: 'Inicio', category: 'alfabeto', available: true, sort_order: 0, exercise_count: 2 },
  ];
  const flags: FeatureFlag[] = [
    { key: 'games.quiz', enabled: true, rollout_percentage: 100, starts_at: null, ends_at: null, description: 'Quiz' },
  ];
  const media: MediaItem[] = [];
  const about: AboutContent = {
    title: 'Quiénes somos',
    intro: 'Un equipo que fomenta la LSCh.',
    mission: 'Fomentar la práctica diaria de la LSCh.',
    vision: 'Una sociedad donde comunicarse en señas sea cotidiano.',
  };
  const team: TeamMember[] = [
    { id: 't1', full_name: 'Ana Pérez', role: 'Diseño', bio: null, photo_url: null, photo_path: null, sort_order: 0, published: true },
    { id: 't2', full_name: 'Luis Soto', role: 'Desarrollo', bio: null, photo_url: null, photo_path: null, sort_order: 1, published: false },
  ];
  return {
    content: {
      listLevels: vi.fn(async () => levels),
      getLevel: vi.fn(async () => ({ ...levels[0], exercises: [{ type: 'typing', title: 'Escribe', hint: '', payload: { sign: 'a', answer: 'A' } }] })),
      validateExercises: vi.fn((exercises: { payload: Record<string, unknown>; type: string }[]) =>
        exercises.map((exercise, index) => ({ index, valid: Boolean(exercise.payload.sign), error: exercise.payload.sign ? null : 'falta el campo "sign"' })),
      ),
      saveLevel: vi.fn(async () => 1),
      deleteLevel: vi.fn(async () => {}),
      listDictionary: vi.fn(async () => []),
      saveDictionaryEntry: vi.fn(async () => {}),
      deleteDictionaryEntry: vi.fn(async () => {}),
      listVocabulary: vi.fn(async () => []),
      saveVocabulary: vi.fn(async () => {}),
      deleteVocabulary: vi.fn(async () => {}),
    } as unknown as Repositories['content'],
    media: { list: vi.fn(async () => media), upload: vi.fn(), update: vi.fn(async () => {}), remove: vi.fn(async () => {}) } as unknown as Repositories['media'],
    config: {
      getConfig: vi.fn(async () => [{ key: 'maintenance', value: { enabled: false }, description: null, updated_at: '' }]),
      setConfig: vi.fn(async () => {}),
      listFlags: vi.fn(async () => flags),
      saveFlag: vi.fn(async () => {}),
      deleteFlag: vi.fn(async () => {}),
      listAudit: vi.fn(async () => []),
    },
    users: { list: vi.fn(async () => []), setRole: vi.fn(async () => {}), getRole: vi.fn(async () => 'admin' as const) },
    stats: { publicStats: vi.fn(async () => ({ levels: 12, exercises: 90, dictionary: 47, vocabulary: 7, videos: 3, learners: 150 })) },
    site: {
      getAbout: vi.fn(async () => about),
      saveAbout: vi.fn(async () => {}),
      listTeam: vi.fn(async () => team),
      listPublishedTeam: vi.fn(async () => team.filter((member) => member.published)),
      saveTeamMember: vi.fn(async () => {}),
      setTeamMemberPublished: vi.fn(async () => {}),
      deleteTeamMember: vi.fn(async () => {}),
    },
    ...overrides,
  };
}
