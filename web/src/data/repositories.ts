import type { SupabaseClient } from '@supabase/supabase-js';
import { ExerciseFactory, toUserMessage } from '@/lib/domain';
import type {
  AboutContent,
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
  TeamMember,
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

// ── Contenido del sitio (sección «Nosotros») ─────────────────────────
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Texto por defecto de «Nosotros»: la landing lo muestra si la base aún no
 * tiene la clave `about` (o no responde), para no dejar la sección vacía.
 * SeñaPlay se presenta como herramienta de práctica, no como un curso.
 */
export const DEFAULT_ABOUT: AboutContent = {
  title: 'Quiénes somos',
  intro:
    'Somos un equipo que cree que la Lengua de Señas Chilena merece estar presente en el día a día. SeñaPlay nace como un espacio de práctica: una forma entretenida de entrenar y mantener activa la LSCh, complementando el aprendizaje que ocurre junto a la comunidad Sorda.',
  mission:
    'Fomentar el uso cotidiano de la Lengua de Señas Chilena con una herramienta de entrenamiento accesible, lúdica y gratuita, que ayude a practicar con constancia y a acercar a personas oyentes y Sordas.',
  vision:
    'Ser la herramienta de referencia en Chile para practicar la LSCh, contribuyendo a una sociedad más inclusiva donde comunicarse en señas sea parte de la vida diaria.',
};

export function createSiteRepository(client: SupabaseClient) {
  const uploadPhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) throw new RepositoryError('La foto debe ser una imagen (PNG, JPG o WebP).');
    if (file.size > MAX_PHOTO_BYTES) throw new RepositoryError('La foto supera el máximo de 5 MB.');
    const path = `team/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { error } = await client.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new RepositoryError(toUserMessage(error, 'No se pudo subir la foto.'));
    return { path, url: client.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl };
  };

  return {
    /** Nunca falla: si no hay datos, devuelve el texto por defecto. */
    async getAbout(): Promise<AboutContent> {
      try {
        const { data, error } = await client.from('site_content').select('value').eq('key', 'about').maybeSingle();
        if (error || !data) return DEFAULT_ABOUT;
        return { ...DEFAULT_ABOUT, ...(data.value as Partial<AboutContent>) };
      } catch {
        return DEFAULT_ABOUT;
      }
    },

    async saveAbout(about: AboutContent) {
      await run(client.from('site_content').upsert({ key: 'about', value: about }), 'No se pudo guardar la sección Nosotros.');
    },

    /** Para el panel: incluye integrantes ocultos (RLS los muestra solo a staff). */
    async listTeam(): Promise<TeamMember[]> {
      return run(client.from('team_members').select('*').order('sort_order').order('full_name'), 'No se pudo cargar el equipo.');
    },

    /** Para la landing: solo publicados; ante un error, lista vacía. */
    async listPublishedTeam(): Promise<TeamMember[]> {
      try {
        const { data, error } = await client.from('team_members').select('*').eq('published', true).order('sort_order').order('full_name');
        return error || !data ? [] : (data as TeamMember[]);
      } catch {
        return [];
      }
    },

    /**
     * Guarda un integrante y, si viene, su foto nueva. La foto anterior se
     * borra solo después de guardar bien; si el guardado falla, se borra la
     * nueva para no dejar archivos huérfanos.
     */
    async saveTeamMember(member: TeamMember, photo?: File | null) {
      const uploaded = photo ? await uploadPhoto(photo) : null;
      const row = {
        full_name: member.full_name.trim(),
        role: member.role.trim(),
        bio: member.bio?.trim() || null,
        sort_order: member.sort_order || 0,
        published: member.published,
        photo_url: uploaded ? uploaded.url : member.photo_url,
        photo_path: uploaded ? uploaded.path : member.photo_path,
      };
      try {
        const query = member.id ? client.from('team_members').update(row).eq('id', member.id) : client.from('team_members').insert(row);
        await run(query, 'No se pudo guardar el integrante.');
      } catch (error) {
        if (uploaded) await client.storage.from(MEDIA_BUCKET).remove([uploaded.path]);
        throw error;
      }
      if (uploaded && member.photo_path) await client.storage.from(MEDIA_BUCKET).remove([member.photo_path]);
    },

    async setTeamMemberPublished(id: string, published: boolean) {
      await run(client.from('team_members').update({ published }).eq('id', id), 'No se pudo actualizar el integrante.');
    },

    async deleteTeamMember(member: TeamMember) {
      await run(client.from('team_members').delete().eq('id', member.id as string), 'No se pudo eliminar el integrante.');
      if (member.photo_path) await client.storage.from(MEDIA_BUCKET).remove([member.photo_path]);
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
  site: ReturnType<typeof createSiteRepository>;
};

export function createRepositories(client: SupabaseClient): Repositories {
  return {
    content: createContentRepository(client),
    media: createMediaRepository(client),
    config: createConfigRepository(client),
    users: createUsersRepository(client),
    stats: createStatsRepository(client),
    site: createSiteRepository(client),
  };
}
