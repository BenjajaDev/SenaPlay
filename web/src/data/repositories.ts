import type { SupabaseClient } from '@supabase/supabase-js';
import { ExerciseFactory, toUserMessage } from '@/lib/domain';
import type {
  AuditEntry,
  ConfigRow,
  DictionaryEntry,
  ExerciseDraft,
  FeatureFlag,
  Level,
  LevelWithExercises,
  MediaItem,
  MediaKind,
  Profile,
  PublicStats,
  Role,
  VocabularySign,
} from './types';

/**
 * Repositorios del portal (patrón Repository). Reciben el cliente de
 * Supabase por parámetro (inyección de dependencias) para poder probarlos con
 * un cliente falso. Todos lanzan `RepositoryError` con mensaje en español
 * listo para mostrar; la UI los captura con useFeedback().notify.
 */
export class RepositoryError extends Error {}

async function run<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>, fallback: string): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new RepositoryError(toUserMessage(error, fallback));
  return data as T;
}

// ── Contenido ────────────────────────────────────────────────────────
export function createContentRepository(client: SupabaseClient) {
  return {
    async listLevels(): Promise<Level[]> {
      const rows = await run<(Level & { exercises: { count: number }[] })[]>(
        client.from('levels').select('id, title, description, category, available, sort_order, updated_at, exercises(count)').order('sort_order'),
        'No se pudieron cargar los niveles.',
      );
      return rows.map(({ exercises, ...level }) => ({ ...level, exercise_count: exercises?.[0]?.count ?? 0 }));
    },

    async getLevel(id: number): Promise<LevelWithExercises> {
      const row = await run<Level & { exercises: (ExerciseDraft & { position: number; hint: string | null })[] }>(
        client.from('levels').select('*, exercises(position, type, title, hint, payload)').eq('id', id).single(),
        'No se encontró el nivel.',
      );
      const exercises = [...(row.exercises || [])]
        .sort((a, b) => a.position - b.position)
        .map((exercise) => ({ type: exercise.type, title: exercise.title || '', hint: exercise.hint || '', payload: exercise.payload || {} }));
      return { ...row, exercises };
    },

    /**
     * Valida TODOS los ejercicios con la misma ExerciseFactory que usa la
     * app antes de enviar; así no se publica nada que la app no pueda dibujar.
     */
    validateExercises(exercises: ExerciseDraft[]) {
      return exercises.map((exercise, index) => {
        const { valid, error } = ExerciseFactory.validate({ type: exercise.type, title: exercise.title, hint: exercise.hint, ...exercise.payload });
        return { index, valid, error };
      });
    },

    async saveLevel(level: Omit<Level, 'updated_at' | 'exercise_count'>, exercises: ExerciseDraft[]): Promise<number> {
      const invalid = this.validateExercises(exercises).filter((item) => !item.valid);
      if (invalid.length) {
        throw new RepositoryError(`Ejercicio ${invalid[0].index + 1}: ${invalid[0].error}`);
      }
      const payload = exercises.map((exercise) => {
        const normalized = ExerciseFactory.create({ type: exercise.type, title: exercise.title, hint: exercise.hint, ...exercise.payload });
        const row = ExerciseFactory.toRow(normalized, 0);
        return { type: row.type, title: row.title, hint: row.hint, payload: row.payload };
      });
      return run<number>(client.rpc('save_level', { p_level: level, p_exercises: payload }), 'No se pudo guardar el nivel.');
    },

    async deleteLevel(id: number) {
      await run(client.from('levels').delete().eq('id', id), 'No se pudo eliminar el nivel.');
    },

    async listDictionary(): Promise<DictionaryEntry[]> {
      return run(client.from('dictionary').select('*').order('sort_order'), 'No se pudo cargar el diccionario.');
    },

    async saveDictionaryEntry(entry: DictionaryEntry) {
      const query = entry.id ? client.from('dictionary').update(entry).eq('id', entry.id) : client.from('dictionary').insert(entry);
      await run(query, 'No se pudo guardar la entrada.');
    },

    async deleteDictionaryEntry(id: number) {
      await run(client.from('dictionary').delete().eq('id', id), 'No se pudo eliminar la entrada.');
    },

    async listVocabulary(): Promise<VocabularySign[]> {
      return run(client.from('signs').select('*').order('word'), 'No se pudo cargar el vocabulario.');
    },

    async saveVocabulary(sign: VocabularySign) {
      const query = sign.id ? client.from('signs').update(sign).eq('id', sign.id) : client.from('signs').insert(sign);
      await run(query, 'No se pudo guardar la seña.');
    },

    async deleteVocabulary(id: number) {
      await run(client.from('signs').delete().eq('id', id), 'No se pudo eliminar la seña.');
    },
  };
}

// ── Medios ───────────────────────────────────────────────────────────
const MEDIA_BUCKET = 'media';
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export function kindFromMime(mime: string): MediaKind {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  return 'document';
}

export function safeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .toLowerCase();
}

export function createMediaRepository(client: SupabaseClient) {
  return {
    async list(): Promise<MediaItem[]> {
      return run(client.from('media').select('*').order('sort_order').order('created_at', { ascending: false }), 'No se pudieron cargar los medios.');
    },

    async upload(file: File, meta: { title: string; category: string; description?: string; tags?: string[]; signKey?: string }) {
      if (file.size > MAX_UPLOAD_BYTES) throw new RepositoryError('El archivo supera el máximo de 200 MB.');
      const kind = kindFromMime(file.type);
      const path = `${kind}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await client.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new RepositoryError(toUserMessage(uploadError, 'No se pudo subir el archivo.'));
      const { data } = client.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      try {
        return await run<MediaItem>(
          client
            .from('media')
            .insert({
              kind,
              title: meta.title,
              description: meta.description || null,
              category: meta.category || 'General',
              tags: meta.tags || [],
              sign_key: meta.signKey || null,
              storage_path: path,
              public_url: data.publicUrl,
              mime_type: file.type,
              size_bytes: file.size,
              published: false,
            })
            .select()
            .single(),
          'No se pudo registrar el archivo.',
        );
      } catch (error) {
        // Sin registro en la tabla, el archivo quedaría huérfano en Storage.
        await client.storage.from(MEDIA_BUCKET).remove([path]);
        throw error;
      }
    },

    async update(id: string, patch: Partial<MediaItem>) {
      await run(client.from('media').update(patch).eq('id', id), 'No se pudo actualizar el recurso.');
    },

    async remove(item: MediaItem) {
      await run(client.from('media').delete().eq('id', item.id), 'No se pudo eliminar el recurso.');
      await client.storage.from(MEDIA_BUCKET).remove([item.storage_path]);
    },
  };
}

// ── Configuración remota ─────────────────────────────────────────────
export function createConfigRepository(client: SupabaseClient) {
  return {
    async getConfig(): Promise<ConfigRow[]> {
      return run(client.from('app_config').select('*').order('key'), 'No se pudo cargar la configuración.');
    },
    async setConfig(key: string, value: unknown) {
      await run(client.from('app_config').upsert({ key, value }), 'No se pudo guardar la configuración.');
    },
    async listFlags(): Promise<FeatureFlag[]> {
      return run(client.from('feature_flags').select('*').order('key'), 'No se pudieron cargar los flags.');
    },
    async saveFlag(flag: FeatureFlag) {
      await run(
        client.from('feature_flags').upsert({
          key: flag.key,
          enabled: flag.enabled,
          rollout_percentage: flag.rollout_percentage,
          starts_at: flag.starts_at || null,
          ends_at: flag.ends_at || null,
          description: flag.description,
        }),
        'No se pudo guardar el flag.',
      );
    },
    async deleteFlag(key: string) {
      await run(client.from('feature_flags').delete().eq('key', key), 'No se pudo eliminar el flag.');
    },
    async listAudit(limit = 50): Promise<AuditEntry[]> {
      return run(client.from('config_audit').select('*').order('changed_at', { ascending: false }).limit(limit), 'No se pudo cargar el historial.');
    },
  };
}

// ── Usuarios y métricas ──────────────────────────────────────────────
export function createUsersRepository(client: SupabaseClient) {
  return {
    async list(): Promise<Profile[]> {
      return run(client.from('profiles').select('id, email, full_name, role, created_at').order('created_at', { ascending: false }), 'No se pudieron cargar los usuarios.');
    },
    async setRole(id: string, role: Role) {
      await run(client.from('profiles').update({ role }).eq('id', id), 'No se pudo cambiar el rol.');
    },
    async getRole(id: string): Promise<Role> {
      const { data } = await client.from('profiles').select('role').eq('id', id).maybeSingle();
      return (data?.role as Role) || 'user';
    },
  };
}

export function createStatsRepository(client: SupabaseClient) {
  return {
    async publicStats(): Promise<PublicStats | null> {
      try {
        const { data, error } = await client.rpc('public_stats');
        return error ? null : (data as PublicStats);
      } catch {
        return null;
      }
    },
  };
}

export type Repositories = {
  content: ReturnType<typeof createContentRepository>;
  media: ReturnType<typeof createMediaRepository>;
  config: ReturnType<typeof createConfigRepository>;
  users: ReturnType<typeof createUsersRepository>;
  stats: ReturnType<typeof createStatsRepository>;
};

export function createRepositories(client: SupabaseClient): Repositories {
  return {
    content: createContentRepository(client),
    media: createMediaRepository(client),
    config: createConfigRepository(client),
    users: createUsersRepository(client),
    stats: createStatsRepository(client),
  };
}
