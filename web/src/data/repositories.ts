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
  LandingSections,
  Profile,
  Publication,
  PublicStats,
  Role,
  SectionItem,
  SectionKey,
  SiteIconKey,
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

// ── Contenido del sitio (secciones de la landing y «Nosotros») ──────
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

export const SITE_ICON_KEYS: SiteIconKey[] = [
  'layers',
  'camera',
  'book',
  'gamepad',
  'video',
  'sparkles',
  'vibrate',
  'accessibility',
  'hand',
  'heart',
  'users',
  'star',
  'smartphone',
  'megaphone',
  'graduation',
];

/**
 * Textos por defecto de cada sección de la landing. Se guardan en
 * site_content con una clave por sección; lo que falte en la base se completa
 * con estos valores, así la landing nunca queda vacía ni se rompe si alguien
 * guardó una versión antigua de la sección.
 */
export const DEFAULT_SECTIONS: LandingSections = {
  hero: {
    badge: 'Lengua de Señas Chilena',
    title: 'Entrena la Lengua de Señas Chilena, jugando.',
    text: 'SeñaPlay es un espacio de práctica: niveles cortos, juegos y una cámara con inteligencia artificial para ejercitar la LSCh todos los días y fomentar su uso, a tu ritmo.',
    primaryLabel: 'Descargar para Android',
    secondaryLabel: 'Conocer más',
  },
  metrics: { visible: true, title: 'SeñaPlay en números' },
  features: {
    visible: true,
    title: 'Todo lo que necesitas para practicar LSCh',
    items: [
      { icon: 'layers', title: 'Niveles progresivos', text: 'Del alfabeto dactilológico a vocabulario real, con desbloqueo por logros.' },
      { icon: 'camera', title: 'Práctica con IA', text: 'La cámara reconoce tu mano y te da retroalimentación sobre la seña en tiempo real.' },
      { icon: 'book', title: 'Diccionario LSCh', text: 'Señas con fotos, parámetros y referencias al diccionario del MINEDUC.' },
      { icon: 'gamepad', title: 'Juegos', text: 'Memoria, quiz contrarreloj y deletreo para entrenar y mantener activa la LSCh.' },
      { icon: 'video', title: 'Videos con subtítulos', text: 'Contenido audiovisual accesible para personas oyentes y no oyentes.' },
      { icon: 'sparkles', title: 'Motivación diaria', text: 'Rachas, estrellas y celebraciones que hacen del hábito un juego.' },
    ],
  },
  accessibility: {
    visible: true,
    title: 'Accesible para personas oyentes y no oyentes',
    items: [
      { icon: 'vibrate', title: 'Feedback multimodal', text: 'Cada acierto o error combina color, icono, texto y vibración: nunca depende del audio.' },
      { icon: 'accessibility', title: 'WCAG 2.1 AA', text: 'Contraste verificado automáticamente, lector de pantalla y tamaño táctil mínimo de 44px.' },
      { icon: 'hand', title: 'Hecha para la comunidad Sorda', text: 'La seña es la protagonista: grande, clara y bajo tu control, sin nada que se mueva solo.' },
    ],
  },
  publications: {
    visible: true,
    title: 'Publicaciones',
    intro: 'Congresos, actividades con la comunidad Sorda, pruebas con usuarios y novedades del proyecto.',
  },
  download: {
    visible: true,
    title: '¡Empieza hoy!',
    text: 'Disponible para Android. Crea tu cuenta y completa tu primer entrenamiento en 5 minutos.',
  },
  footer: { text: 'Hecho con la comunidad Sorda de Chile' },
};

export const SECTION_KEYS = Object.keys(DEFAULT_SECTIONS) as SectionKey[];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function sanitizeItems(value: unknown, fallback: SectionItem[]): SectionItem[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter(isRecord).map((item) => ({
    icon: SITE_ICON_KEYS.includes(item.icon as SiteIconKey) ? (item.icon as SiteIconKey) : 'sparkles',
    title: typeof item.title === 'string' ? item.title : '',
    text: typeof item.text === 'string' ? item.text : '',
  }));
}

/**
 * Combina lo guardado con los valores por defecto, campo por campo y solo si
 * el tipo coincide con el del defecto (un booleano guardado como texto, por
 * ejemplo, se descarta). Pura: se prueba sin Supabase.
 */
export function mergeSections(rows: { key: string; value: unknown }[]): LandingSections {
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  const merged = {} as Record<SectionKey, unknown>;
  SECTION_KEYS.forEach((key) => {
    const defaults = DEFAULT_SECTIONS[key] as Record<string, unknown>;
    const value = stored.get(key);
    const section: Record<string, unknown> = { ...defaults };
    if (isRecord(value)) {
      Object.keys(defaults).forEach((field) => {
        if (field === 'items') section.items = sanitizeItems(value.items, defaults.items as SectionItem[]);
        else if (typeof value[field] === typeof defaults[field]) section[field] = value[field];
      });
    }
    merged[key] = section;
  });
  return merged as LandingSections;
}

async function uploadImage(client: SupabaseClient, folder: string, file: File) {
  if (!file.type.startsWith('image/')) throw new RepositoryError('La imagen debe ser PNG, JPG o WebP.');
  if (file.size > MAX_PHOTO_BYTES) throw new RepositoryError('La imagen supera el máximo de 5 MB.');
  const path = `${folder}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error } = await client.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new RepositoryError(toUserMessage(error, 'No se pudo subir la imagen.'));
  return { path, url: client.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl };
}

export function createSiteRepository(client: SupabaseClient) {
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

    /** Todas las secciones de la landing en una consulta. Nunca falla: ante un error, textos por defecto. */
    async getSections(): Promise<LandingSections> {
      try {
        const { data, error } = await client.from('site_content').select('key, value').in('key', SECTION_KEYS);
        return mergeSections(error || !data ? [] : data);
      } catch {
        return DEFAULT_SECTIONS;
      }
    },

    async saveSection<K extends SectionKey>(key: K, value: LandingSections[K]) {
      await run(client.from('site_content').upsert({ key, value }), 'No se pudo guardar la sección.');
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
      const uploaded = photo ? await uploadImage(client, 'team', photo) : null;
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

// ── Publicaciones (congresos, actividades, pruebas…) ─────────────────
const PUBLICATION_COLUMNS = 'id, title, summary, body, category, event_date, location, link_url, cover_url, cover_path, published, created_at';

/** Acepta solo enlaces http(s); agrega https:// si el editor lo omitió. */
export function normalizeUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes('.') ? url.toString() : null;
  } catch {
    return null;
  }
}

export function createPublicationsRepository(client: SupabaseClient) {
  // Lo más reciente primero; las publicaciones sin fecha van al final.
  const feed = (published: boolean) => {
    const query = client.from('publications').select(PUBLICATION_COLUMNS);
    return (published ? query.eq('published', true) : query)
      .order('event_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
  };

  return {
    /** Para el panel: incluye borradores (RLS los muestra solo a staff). */
    async list(): Promise<Publication[]> {
      return run(feed(false), 'No se pudieron cargar las publicaciones.');
    },

    /** Para la landing: solo publicadas; ante un error, lista vacía. */
    async listPublished(): Promise<Publication[]> {
      try {
        const { data, error } = await feed(true);
        return error || !data ? [] : (data as Publication[]);
      } catch {
        return [];
      }
    },

    /**
     * Guarda la publicación y, si viene, su portada nueva (`removeCover`
     * quita la actual). Igual que las fotos del equipo: la imagen anterior se
     * borra solo si el guardado resultó, y la nueva si falló.
     */
    async save(publication: Publication, cover?: File | null, removeCover = false) {
      if (publication.link_url?.trim() && !normalizeUrl(publication.link_url)) {
        throw new RepositoryError('El enlace no es una dirección web válida.');
      }
      const uploaded = cover ? await uploadImage(client, 'publications', cover) : null;
      const keepCover = !uploaded && !removeCover;
      const row = {
        title: publication.title.trim(),
        summary: publication.summary.trim(),
        body: publication.body?.trim() || null,
        category: publication.category,
        event_date: publication.event_date || null,
        location: publication.location?.trim() || null,
        link_url: normalizeUrl(publication.link_url),
        published: publication.published,
        cover_url: uploaded ? uploaded.url : keepCover ? publication.cover_url : null,
        cover_path: uploaded ? uploaded.path : keepCover ? publication.cover_path : null,
      };
      try {
        const query = publication.id ? client.from('publications').update(row).eq('id', publication.id) : client.from('publications').insert(row);
        await run(query, 'No se pudo guardar la publicación.');
      } catch (error) {
        if (uploaded) await client.storage.from(MEDIA_BUCKET).remove([uploaded.path]);
        throw error;
      }
      if (!keepCover && publication.cover_path) await client.storage.from(MEDIA_BUCKET).remove([publication.cover_path]);
    },

    async setPublished(id: string, published: boolean) {
      await run(client.from('publications').update({ published }).eq('id', id), 'No se pudo actualizar la publicación.');
    },

    async remove(publication: Publication) {
      await run(client.from('publications').delete().eq('id', publication.id as string), 'No se pudo eliminar la publicación.');
      if (publication.cover_path) await client.storage.from(MEDIA_BUCKET).remove([publication.cover_path]);
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
  publications: ReturnType<typeof createPublicationsRepository>;
};

export function createRepositories(client: SupabaseClient): Repositories {
  return {
    content: createContentRepository(client),
    media: createMediaRepository(client),
    config: createConfigRepository(client),
    users: createUsersRepository(client),
    stats: createStatsRepository(client),
    site: createSiteRepository(client),
    publications: createPublicationsRepository(client),
  };
}
