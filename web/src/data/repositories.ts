import type { SupabaseClient } from '@supabase/supabase-js';
import { ExerciseFactory, isValidSignKey, SIGN_CLIP_LIMITS, toSignKey, toStorageFolder, toUserMessage, validateClipEdit, type ClipEdit } from '@/lib/domain';
import { builtinSignSlide, isSafeImageUrl } from '@/lib/signs';
import { cleanSocials } from '@/lib/social';
import type {
  AboutContent,
  AuditEntry,
  ConfigRow,
  DictionaryEntry,
  ExerciseDraft,
  AudienceCard,
  FeatureFlag,
  FeatureItem,
  FooterLink,
  Highlight,
  Level,
  LevelWithExercises,
  MediaItem,
  MediaKind,
  LandingSections,
  MistakeStat,
  PhoneScreen,
  Profile,
  ProfileDraft,
  Publication,
  PublicStats,
  Role,
  SectionItem,
  SectionKey,
  SignClip,
  SignClipLicense,
  SignClipRow,
  SignClipStatus,
  SignSlide,
  SiteIconKey,
  Sponsor,
  TaggedItem,
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

// ── Señas en video ───────────────────────────────────────────────────
export const SIGN_CLIPS_BUCKET = 'sign-clips';

/** Archivos ya exportados por el editor (ver features/admin/content/signClips). */
export type ExportedClip = { video: Blob; poster: Blob; durationMs: number; size: number };

export type NewSignClip = ExportedClip & {
  gloss: string;
  variant: number;
  region: string;
  signerAlias: string;
  consentRef: string;
  license: SignClipLicense;
  edit: ClipEdit;
};

/** Siguiente variante libre de una seña (1 si no tiene clips). */
export function nextVariant(clips: Pick<SignClipRow, 'sign_key' | 'variant'>[], signKey: string) {
  const used = clips.filter((clip) => clip.sign_key === signKey).map((clip) => clip.variant);
  return used.length ? Math.max(...used) + 1 : 1;
}

/**
 * Revisa los archivos exportados antes de subirlos. La base de datos y el
 * bucket repiten estos límites; aquí se avisa antes y en español.
 */
export function checkExportedClip(clip: ExportedClip, edit: ClipEdit) {
  if (!validateClipEdit(edit).valid) throw new RepositoryError('El encuadre o el tramo no son válidos: revísalos en el editor.');
  if (clip.video.type !== 'video/mp4') throw new RepositoryError('El video exportado debe ser MP4.');
  if (clip.poster.type !== 'image/webp') throw new RepositoryError('La imagen fija debe ser WebP.');
  if (clip.video.size > SIGN_CLIP_LIMITS.maxVideoBytes) throw new RepositoryError('El video supera 1,5 MB: acorta el tramo.');
  if (clip.durationMs < SIGN_CLIP_LIMITS.minDurationMs || clip.durationMs > SIGN_CLIP_LIMITS.maxDurationMs) {
    throw new RepositoryError('El clip debe durar entre 0,5 y 10 segundos.');
  }
}

export function createSignClipsRepository(client: SupabaseClient) {
  const bucket = () => client.storage.from(SIGN_CLIPS_BUCKET);
  const withUrls = (row: SignClipRow): SignClip => ({
    ...row,
    video_url: bucket().getPublicUrl(row.video_path).data.publicUrl,
    poster_url: bucket().getPublicUrl(row.poster_path).data.publicUrl,
  });

  /** Sube video e imagen; si algo falla, borra lo que alcanzó a subir. */
  const uploadFiles = async (signKey: string, variant: number, clip: ExportedClip) => {
    const id = crypto.randomUUID();
    const folder = toStorageFolder(signKey);
    const paths = { video: `${folder}/${variant}-${id}.mp4`, poster: `${folder}/${variant}-${id}.webp` };
    const uploaded: string[] = [];
    try {
      for (const [path, file] of [
        [paths.video, clip.video],
        [paths.poster, clip.poster],
      ] as const) {
        const { error } = await bucket().upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw new RepositoryError(toUserMessage(error, 'No se pudo subir el clip.'));
        uploaded.push(path);
      }
      return paths;
    } catch (error) {
      if (uploaded.length) await bucket().remove(uploaded);
      throw error;
    }
  };

  return {
    async list(): Promise<SignClip[]> {
      const rows = await run<SignClipRow[]>(
        client.from('sign_clips').select('*').order('sign_key').order('variant'),
        'No se pudieron cargar los clips.',
      );
      return (rows || []).map(withUrls);
    },

    /** Sube un clip nuevo como borrador. */
    async create(input: NewSignClip): Promise<void> {
      const signKey = toSignKey(input.gloss);
      if (!isValidSignKey(signKey)) throw new RepositoryError('La glosa no tiene letras válidas.');
      if (!input.signerAlias.trim()) throw new RepositoryError('Indica quién seña (seudónimo).');
      if (!input.consentRef.trim()) throw new RepositoryError('Falta la referencia al consentimiento firmado.');
      checkExportedClip(input, input.edit);

      const paths = await uploadFiles(signKey, input.variant, input);
      try {
        await run(
          client.from('sign_clips').insert({
            sign_key: signKey,
            gloss: input.gloss.trim(),
            variant: input.variant,
            region: input.region.trim() || 'general',
            video_path: paths.video,
            poster_path: paths.poster,
            duration_ms: Math.round(input.durationMs),
            width: input.size,
            height: input.size,
            size_bytes: input.video.size,
            signer_alias: input.signerAlias.trim(),
            consent_ref: input.consentRef.trim(),
            license: input.license,
            edit_params: input.edit,
          }),
          'No se pudo registrar el clip.',
        );
      } catch (error) {
        await bucket().remove([paths.video, paths.poster]);
        throw error;
      }
    },

    /** Reemplaza video, imagen y encuadre. La base de datos lo devuelve a borrador. */
    async replaceMedia(clip: SignClipRow, exported: ExportedClip, edit: ClipEdit): Promise<void> {
      checkExportedClip(exported, edit);
      const paths = await uploadFiles(clip.sign_key, clip.variant, exported);
      try {
        await run(
          client
            .from('sign_clips')
            .update({
              video_path: paths.video,
              poster_path: paths.poster,
              duration_ms: Math.round(exported.durationMs),
              width: exported.size,
              height: exported.size,
              size_bytes: exported.video.size,
              edit_params: edit,
            })
            .eq('id', clip.id),
          'No se pudo reemplazar el clip.',
        );
      } catch (error) {
        await bucket().remove([paths.video, paths.poster]);
        throw error;
      }
      await bucket().remove([clip.video_path, clip.poster_path]);
    },

    async setStatus(id: string, status: SignClipStatus, notes?: string): Promise<void> {
      if (status === 'rejected' && !notes?.trim()) throw new RepositoryError('Explica por qué se rechaza el clip.');
      const patch: Partial<SignClipRow> = { validation_status: status };
      if (notes !== undefined) patch.validation_notes = notes.trim() || null;
      await run(client.from('sign_clips').update(patch).eq('id', id), 'No se pudo cambiar el estado del clip.');
    },

    async setPublished(id: string, published: boolean): Promise<void> {
      await run(client.from('sign_clips').update({ published }).eq('id', id), 'No se pudo cambiar la publicación del clip.');
    },

    async remove(clip: SignClipRow): Promise<void> {
      await run(client.from('sign_clips').delete().eq('id', clip.id), 'No se pudo eliminar el clip.');
      await bucket().remove([clip.video_path, clip.poster_path]);
    },
  };
}

// ── Configuración remota ─────────────────────────────────────────────
/** Canal y evento que escucha la app móvil (RemoteConfigRepository.subscribe). */
export const REMOTE_CONFIG_CHANNEL = 'remote-config';
export const REMOTE_CONFIG_EVENT = 'changed';

export function createConfigRepository(client: SupabaseClient) {
  /**
   * Avisa a las apps abiertas que la configuración cambió (Realtime
   * Broadcast por HTTP). No depende de que las tablas estén en la
   * publicación de Realtime ni de RLS: la app recibe el aviso y vuelve a
   * leer. Es «mejor esfuerzo»: si falla, lo guardado ya está guardado y la
   * app lo toma en su siguiente sondeo.
   */
  const notifyApps = async (what: string) => {
    try {
      const channel = client.channel(REMOTE_CONFIG_CHANNEL);
      await channel.httpSend(REMOTE_CONFIG_EVENT, { what, at: new Date().toISOString() });
      await client.removeChannel(channel);
    } catch {
      /* sin Realtime: la app lo recoge al sondear */
    }
  };

  return {
    async getConfig(): Promise<ConfigRow[]> {
      return run(client.from('app_config').select('*').order('key'), 'No se pudo cargar la configuración.');
    },
    async setConfig(key: string, value: unknown) {
      await run(client.from('app_config').upsert({ key, value }), 'No se pudo guardar la configuración.');
      await notifyApps(`config:${key}`);
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
      await notifyApps(`flag:${flag.key}`);
    },
    async deleteFlag(key: string) {
      await run(client.from('feature_flags').delete().eq('key', key), 'No se pudo eliminar el flag.');
      await notifyApps(`flag:${key}`);
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
  'landmark',
  'scale',
  'mapPin',
  'shield',
  'database',
  'target',
  'userCheck',
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
    signsInterval: 4,
    signDecks: [
      ['A', 'D', 'G'].map(builtinSignSlide),
      ['B', 'E', 'H'].map(builtinSignSlide),
      ['C', 'F', 'I'].map(builtinSignSlide),
    ],
  },
  metrics: { visible: true, title: 'SeñaPlay en números' },
  problem: {
    visible: true,
    badge: 'El problema',
    title: 'Una brecha comunicacional que vulnera derechos',
    paragraphs: [
      'En Chile persisten barreras que afectan la autonomía, la inclusión y el ejercicio de derechos de las personas sordas. La más crítica es la brecha comunicacional al acceder a servicios públicos y privados: lo que para una persona oyente es una gestión cotidiana, para una persona sorda es un desafío constante.',
      'La comunidad y estudios como el de Minte et al. (2025) advierten que esto es especialmente grave en salud, donde se dificulta comprender diagnósticos, tratamientos y trámites administrativos. La causa principal es la escasez de intérpretes de LSCh.',
    ],
    citation: 'Minte et al. (2025)',
    highlights: [
      {
        value: '488.511',
        label: 'personas con algún grado de discapacidad auditiva, de 17,91 millones de habitantes en Chile.',
        note: 'La cifra no incluye condiciones asociadas a la edad, como la presbiacusia.',
        source: 'Engloba, 2026',
        total: 17910000,
      },
      {
        value: '24/7',
        label: 'Es la cobertura de interpretación en LSCh que hoy no existe en Chile: no hay un servicio continuo.',
        note: '',
        source: '',
        total: null,
      },
    ],
    questions: [
      { icon: 'users', title: '¿A quién afecta?', text: 'A la comunidad sorda en todas las etapas de la vida: niños, niñas, jóvenes y personas adultas.' },
      {
        icon: 'landmark',
        title: '¿Dónde ocurre?',
        text: 'En todos los ámbitos de la vida cotidiana. Es más grave en instituciones públicas esenciales (centros de salud, juzgados, municipalidades y servicios asistenciales), pero también en el sector privado, la educación, el trabajo y los espacios sociales y culturales.',
      },
      {
        icon: 'scale',
        title: '¿Por qué importa?',
        text: 'No es solo un inconveniente logístico: es una vulneración sistemática de derechos fundamentales. Sin comunicación autónoma en salud, en un juzgado o en el trabajo se afectan la autodeterminación, la privacidad y la salud física y emocional.',
      },
    ],
  },
  features: {
    visible: true,
    badge: 'La solución',
    title: 'Practica LSCh como un juego',
    intro:
      'SeñaPlay convierte la práctica de la Lengua de Señas Chilena en una experiencia accesible, gratuita y disponible a cualquier hora, para complementar la escasa oferta de intérpretes y formación.',
    items: [
      { icon: 'layers', title: 'Niveles de juego', text: 'Avance progresivo desde señas básicas hacia frases de uso cotidiano.', highlight: true },
      { icon: 'book', title: 'Diccionario de LSCh', text: 'Consulta de señas cuando la persona la necesite.', highlight: true },
      { icon: 'camera', title: 'Práctica con inteligencia artificial', text: 'Retroalimentación para entrenar y corregir las señas.', highlight: true },
      { icon: 'gamepad', title: 'Juegos', text: 'Memoria, quiz contrarreloj y deletreo para entrenar y mantener activa la LSCh.', highlight: false },
      { icon: 'video', title: 'Videos con subtítulos', text: 'Contenido audiovisual accesible para personas oyentes y no oyentes.', highlight: false },
      { icon: 'sparkles', title: 'Motivación diaria', text: 'Rachas, estrellas y celebraciones que hacen del hábito un juego.', highlight: false },
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
  showcase: {
    visible: true,
    title: 'Así se ve SeñaPlay',
    text: 'Niveles cortos, juegos y práctica con la cámara, todo desde tu teléfono.',
    interval: 5,
    screens: [],
  },
  territory: {
    visible: true,
    badge: 'Territorio y comunidad',
    title: 'Territorio y comunidad beneficiaria',
    place: {
      label: 'Territorio situado',
      title: 'Universidad Autónoma de Chile, sede Talca · Región del Maule',
      text: 'El proyecto piloto se desarrolla desde Talca y su alcance digital está pensado en las variantes lingüísticas de la LSCh de Talca.',
      tags: ['Proyecto piloto 2026', 'Variante de Talca'],
    },
    direct: {
      label: 'Beneficiarios directos',
      title: 'Quienes aprenden y practican LSCh con la app',
      text: '',
      tags: ['Estudiantes', 'Familias', 'Funcionarios y funcionarias de atención a público', 'Equipos de salud', 'Público general'],
    },
    indirect: {
      label: 'Beneficiarios indirectos',
      title: 'La comunidad sorda',
      text: 'Cada persona que aprende LSCh amplía los espacios donde una persona sorda puede comunicarse sin depender de un intérprete.',
      tags: ['Salud', 'Trámites', 'Educación', 'Trabajo'],
    },
    bridge: 'Cada persona que aprende abre espacios',
  },
  publications: {
    visible: true,
    title: 'Avances del proyecto',
    intro: 'Congresos, actividades con la comunidad Sorda, pruebas con usuarios y novedades del proyecto.',
  },
  club: {
    visible: true,
    name: 'Club de Sordos de Talca',
    motto: 'Difundiendo la LSCh',
    paragraphs: [
      'El Club de Sordos de Talca es una organización comunitaria sin fines de lucro de la Región del Maule, orientada principalmente a personas sordas y con discapacidad auditiva, que promueve la Cultura Sorda, la Lengua de Señas Chilena (LSCh), la inclusión y la participación social.',
      'Su sede, en 5 Sur esquina 1 Oriente, Talca, permite centralizar sus reuniones, talleres y diversas actividades dirigidas a la comunidad sorda.',
    ],
    facts: [
      { icon: 'users', title: '35 miembros activos', text: 'Además de sus familias.' },
      { icon: 'mapPin', title: '5 Sur esquina 1 Oriente, Talca', text: 'Sede para reuniones, talleres y actividades.' },
      { icon: 'heart', title: 'Sin fines de lucro', text: 'Organización comunitaria de la Región del Maule.' },
    ],
    roleTitle: 'Actor clave y codiseñador de SeñaPlay',
    roleText: 'En el desarrollo de la aplicación cumple un rol fundamental como codiseñador y participa activamente en distintas tareas, entre ellas:',
    roles: [
      'Entrenamiento de la inteligencia artificial',
      'Entrega de variantes lingüísticas',
      'Difusión de la Cultura Sorda',
      'Validación de la tecnología',
      'Señas en video de los niveles',
    ],
  },
  funding: {
    visible: true,
    title: 'Financiamiento',
    lead: 'Fuente de financiamiento.',
    text: 'Este proyecto se obtuvo mediante el concurso «Iniciativas innovadoras piloto 2026», realizado por el Centro de Innovación Social y Políticas Públicas de la Universidad Autónoma de Chile, sede Talca, y financiado por la Agencia Nacional de Investigación y Desarrollo (ANID).',
    sponsors: [
      { name: 'Agencia Nacional de Investigación y Desarrollo (ANID)', url: 'https://anid.cl', image_url: '', image_path: null },
      { name: 'Universidad Autónoma de Chile, sede Talca', url: 'https://www.uautonoma.cl', image_url: '', image_path: null },
      { name: 'Centro de Innovación Social y Políticas Públicas', url: '', image_url: '', image_path: null },
    ],
  },
  download: {
    visible: true,
    title: '¡Empieza hoy!',
    text: 'Disponible para Android. Crea tu cuenta y completa tu primer entrenamiento en 5 minutos.',
  },
  privacy: {
    badge: 'Privacidad',
    title: 'Política de protección y privacidad de datos',
    intro:
      'SeñaPlay respeta la privacidad de quienes la usan y trata los datos personales conforme a la legislación chilena vigente sobre protección de la vida privada y datos personales.',
    laws: ['Ley N° 19.628', 'Ley N° 21.719'],
    items: [
      { icon: 'database', title: 'Qué datos recogemos', text: 'Solo los necesarios para que la aplicación funcione.', tags: ['Correo de registro', 'Nombre de usuario', 'Contraseña (cifrada)'] },
      {
        icon: 'camera',
        title: 'Uso de la cámara y de la IA',
        text: 'La app pide la cámara para practicar señas con la IA. No usamos imágenes de las personas para fines distintos de la práctica sin su consentimiento expreso.',
        tags: [],
      },
      {
        icon: 'target',
        title: 'Para qué los usamos',
        text: 'Para ofrecer y mejorar la experiencia de aprendizaje y generar estadísticas anónimas y agregadas del piloto. No vendemos ni cedemos datos personales a terceros con fines comerciales.',
        tags: [],
      },
      {
        icon: 'userCheck',
        title: 'Tus derechos',
        text: 'Puedes retirar tu consentimiento en cualquier momento y solicitar:',
        tags: ['Acceso', 'Rectificación', 'Supresión', 'Oposición', 'Portabilidad'],
      },
    ],
    body: [
      '## Responsable',
      'SeñaPlay es un proyecto piloto desarrollado desde la Universidad Autónoma de Chile, sede Talca. Trata los datos personales conforme a la Ley N° 19.628 sobre protección de la vida privada y a la Ley N° 21.719, que regula la protección y el tratamiento de los datos personales.',
      '## Qué datos recogemos',
      'Solo los datos necesarios para el funcionamiento de la aplicación: el correo de registro, el nombre de usuario y la contraseña. La contraseña se guarda cifrada y nadie del equipo puede verla.',
      '## Uso de la cámara y de la inteligencia artificial',
      'Dentro de las funciones de la aplicación se solicita el uso de la cámara, con el fin de ofrecer una mejor experiencia en la práctica de señas junto a la IA. No usamos imágenes de las personas para fines distintos de la práctica sin su consentimiento expreso.',
      '## Para qué usamos los datos',
      'Para ofrecer y mejorar la experiencia de aprendizaje y para generar estadísticas anónimas y agregadas del proyecto piloto. No vendemos ni cedemos datos personales a terceros con fines comerciales.',
      '## Tus derechos',
      'Puedes solicitar acceso, rectificación, supresión, oposición y portabilidad de tus datos, y retirar tu consentimiento en cualquier momento, a través de los canales de contacto de este sitio.',
    ].join('\n\n'),
  },
  footer: {
    text: 'Hecho con la comunidad Sorda de Chile',
    email: '',
    location: 'Chile',
    note: 'Proyecto piloto financiado por ANID · Universidad Autónoma de Chile, sede Talca.',
    socials: [{ network: 'instagram', url: 'https://www.instagram.com/senaplay.oficial', animation: 'pop' }],
    links: [],
  },
};

/** Límites de los carruseles y listas de la landing (también los usa el panel). */
export const LANDING_LIMITS = {
  signDecks: 3,
  slidesPerDeck: 8,
  screens: 8,
  footerLinks: 6,
  interval: { min: 2, max: 20 },
  items: 9,
  highlightedFeatures: 3,
  highlights: 4,
  paragraphs: 4,
  tags: 8,
  laws: 6,
  sponsors: 6,
};

export const SECTION_KEYS = Object.keys(DEFAULT_SECTIONS) as SectionKey[];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const imagePath = (value: unknown) => (typeof value === 'string' && value ? value : null);

function toItem(item: Record<string, unknown>): SectionItem {
  return {
    icon: SITE_ICON_KEYS.includes(item.icon as SiteIconKey) ? (item.icon as SiteIconKey) : 'sparkles',
    title: text(item.title),
    text: text(item.text),
  };
}

const records = (value: unknown[], max: number) => value.filter(isRecord).slice(0, max);

/** Lista de textos: descarta lo que no sea texto. */
function stringList(value: unknown, max: number): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string').slice(0, max) : [];
}

function sanitizeItems(value: unknown, fallback: SectionItem[]): SectionItem[] {
  return Array.isArray(value) ? records(value, LANDING_LIMITS.items).map(toItem) : fallback;
}

/** Tarjetas guardadas antes de existir «destacar» llegan sin el campo: quedan sin destacar. */
function sanitizeFeatureItems(value: unknown, fallback: FeatureItem[]): FeatureItem[] {
  if (!Array.isArray(value)) return fallback;
  return records(value, LANDING_LIMITS.items).map((item) => ({ ...toItem(item), highlight: item.highlight === true }));
}

function sanitizeTaggedItems(value: unknown, fallback: TaggedItem[]): TaggedItem[] {
  if (!Array.isArray(value)) return fallback;
  return records(value, LANDING_LIMITS.items).map((item) => ({ ...toItem(item), tags: stringList(item.tags, LANDING_LIMITS.tags) }));
}

function sanitizeHighlights(value: unknown, fallback: Highlight[]): Highlight[] {
  if (!Array.isArray(value)) return fallback;
  return records(value, LANDING_LIMITS.highlights).map((item) => ({
    value: text(item.value),
    label: text(item.label),
    note: text(item.note),
    source: text(item.source),
    total: typeof item.total === 'number' && Number.isFinite(item.total) && item.total > 0 ? item.total : null,
  }));
}

function sanitizeAudience(value: unknown, fallback: AudienceCard): AudienceCard {
  if (!isRecord(value)) return fallback;
  return { label: text(value.label), title: text(value.title), text: text(value.text), tags: stringList(value.tags, LANDING_LIMITS.tags) };
}

/** Un logo con URL insegura se descarta, pero la institución se conserva (se muestran sus iniciales). */
function sanitizeSponsors(value: unknown, fallback: Sponsor[]): Sponsor[] {
  if (!Array.isArray(value)) return fallback;
  return records(value, LANDING_LIMITS.sponsors).map((item) => {
    const safe = isSafeImageUrl(item.image_url);
    return { name: text(item.name), url: text(item.url), image_url: safe ? (item.image_url as string) : '', image_path: safe ? imagePath(item.image_path) : null };
  });
}

function sanitizeSlides(value: unknown): SignSlide[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((slide): slide is Record<string, unknown> => isRecord(slide) && isSafeImageUrl(slide.image_url))
    .slice(0, LANDING_LIMITS.slidesPerDeck)
    .map((slide) => ({ label: text(slide.label), image_url: slide.image_url as string, image_path: imagePath(slide.image_path) }));
}

/** Siempre tres tarjetas; una tarjeta vacía o dañada vuelve a su mazo por defecto. */
function sanitizeDecks(value: unknown, fallback: SignSlide[][]): SignSlide[][] {
  const decks = Array.isArray(value) ? value : [];
  return fallback.map((defaults, index) => {
    const deck = sanitizeSlides(decks[index]);
    return deck.length ? deck : defaults;
  });
}

function sanitizeScreens(value: unknown): PhoneScreen[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((screen): screen is Record<string, unknown> => isRecord(screen) && isSafeImageUrl(screen.image_url))
    .slice(0, LANDING_LIMITS.screens)
    .map((screen) => ({ caption: text(screen.caption), image_url: screen.image_url as string, image_path: imagePath(screen.image_path) }));
}

function sanitizeLinks(value: unknown): FooterLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((link) => ({ label: text(link.label), url: text(link.url) }))
    .filter((link) => link.label && link.url)
    .slice(0, LANDING_LIMITS.footerLinks);
}

type FieldSanitizer = (value: unknown, fallback: never) => unknown;

/**
 * Campos con estructura propia: se validan uno a uno en vez de solo por tipo.
 * Primero se busca «sección.campo» (mismo nombre, otra forma) y luego el campo.
 */
const FIELD_SANITIZERS: Record<string, FieldSanitizer> = {
  items: sanitizeItems,
  'features.items': sanitizeFeatureItems,
  'privacy.items': sanitizeTaggedItems,
  questions: sanitizeItems,
  highlights: sanitizeHighlights,
  paragraphs: (value, fallback: string[]) => (Array.isArray(value) ? stringList(value, LANDING_LIMITS.paragraphs) : fallback),
  laws: (value, fallback: string[]) => (Array.isArray(value) ? stringList(value, LANDING_LIMITS.laws) : fallback),
  place: sanitizeAudience,
  direct: sanitizeAudience,
  indirect: sanitizeAudience,
  sponsors: sanitizeSponsors,
  facts: sanitizeItems,
  roles: (value, fallback: string[]) => (Array.isArray(value) ? stringList(value, LANDING_LIMITS.tags) : fallback),
  signDecks: sanitizeDecks,
  screens: sanitizeScreens,
  socials: (value) => cleanSocials(value),
  links: sanitizeLinks,
};

const clampInterval = (value: number) => Math.min(LANDING_LIMITS.interval.max, Math.max(LANDING_LIMITS.interval.min, Math.round(value)));

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
        const sanitize = FIELD_SANITIZERS[`${key}.${field}`] ?? FIELD_SANITIZERS[field];
        if (sanitize) section[field] = sanitize(value[field], defaults[field] as never);
        else if (typeof defaults[field] === 'number') section[field] = Number.isFinite(value[field]) ? clampInterval(value[field] as number) : defaults[field];
        else if (typeof value[field] === typeof defaults[field]) section[field] = value[field];
      });
    }
    merged[key] = section;
  });
  return merged as LandingSections;
}

/** Rutas del bucket usadas por una sección (para borrar las que dejan de usarse). */
export function sectionImagePaths(section: unknown): string[] {
  const paths: string[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (isRecord(value)) {
      if (typeof value.image_path === 'string' && value.image_path) paths.push(value.image_path);
      Object.values(value).forEach(walk);
    }
  };
  walk(section);
  return paths;
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

    /** Sube una imagen para un carrusel de la landing (bucket `media`, carpeta landing/). */
    async uploadLandingImage(file: File): Promise<{ url: string; path: string }> {
      return uploadImage(client, 'landing', file);
    },

    /** Borra imágenes que ya no usa ninguna sección. Si falla, solo quedan archivos huérfanos. */
    async removeLandingImages(paths: string[]) {
      if (!paths.length) return;
      try {
        await client.storage.from(MEDIA_BUCKET).remove(paths);
      } catch {
        /* no bloquea la publicación */
      }
    },

    /** Para el panel: incluye integrantes ocultos (RLS los muestra solo a staff). */
    async listTeam(): Promise<TeamMember[]> {
      const rows = await run<TeamMember[]>(client.from('team_members').select('*').order('sort_order').order('full_name'), 'No se pudo cargar el equipo.');
      return (rows || []).map((member) => ({ ...member, socials: cleanSocials(member.socials) }));
    },

    /** Para la landing: solo publicados; ante un error, lista vacía. */
    async listPublishedTeam(): Promise<TeamMember[]> {
      try {
        const { data, error } = await client.from('team_members').select('*').eq('published', true).order('sort_order').order('full_name');
        return error || !data ? [] : (data as TeamMember[]).map((member) => ({ ...member, socials: cleanSocials(member.socials) }));
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
        socials: cleanSocials(member.socials),
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

// ── Cuenta propia (Panel → Mi perfil) ────────────────────────────────
export function createAccountRepository(client: SupabaseClient) {
  return {
    async getProfile(id: string): Promise<Profile | null> {
      const { data, error } = await client.from('profiles').select('id, email, full_name, role, created_at').eq('id', id).maybeSingle();
      if (error) throw new RepositoryError(toUserMessage(error, 'No se pudo cargar tu perfil.'));
      return (data as Profile) || null;
    },

    /**
     * Nombre en `profiles` (lo que ve el panel) y en user_metadata (lo que
     * usa la app móvil). El correo nuevo no se aplica hasta que la persona
     * confirma el enlace que Supabase envía; la migración de perfil
     * sincroniza profiles.email cuando eso ocurre.
     */
    async updateProfile(id: string, draft: ProfileDraft, currentEmail: string | null): Promise<{ emailPending: boolean }> {
      const fullName = draft.full_name.trim();
      await run(client.from('profiles').update({ full_name: fullName || null }).eq('id', id), 'No se pudo guardar tu perfil.');
      const email = draft.email.trim().toLowerCase();
      const emailChanged = Boolean(email) && email !== (currentEmail || '').toLowerCase();
      const { error } = await client.auth.updateUser({ data: { full_name: fullName }, ...(emailChanged ? { email } : {}) });
      if (error) throw new RepositoryError(toUserMessage(error, 'No se pudo actualizar tu cuenta.'));
      return { emailPending: emailChanged };
    },

    /**
     * Se valida la contraseña actual volviendo a iniciar sesión: evita que
     * alguien con el panel abierto en un equipo ajeno la cambie, y deja la
     * sesión «reciente» que Supabase exige para cambiar la contraseña.
     */
    async changePassword(email: string, current: string, next: string) {
      const check = await client.auth.signInWithPassword({ email, password: current });
      if (check.error) throw new RepositoryError('La contraseña actual no es correcta.');
      const { error } = await client.auth.updateUser({ password: next });
      if (error) throw new RepositoryError(toUserMessage(error, 'No se pudo cambiar la contraseña.'));
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

    /** Ejercicios que más fallan los usuarios en los últimos `days` días (RPC solo para staff). */
    async mistakeStats(limit = 10, days = 30): Promise<MistakeStat[]> {
      return run(client.rpc('mistake_stats', { p_limit: limit, p_days: days }), 'No se pudieron cargar los errores frecuentes.');
    },
  };
}

export type Repositories = {
  content: ReturnType<typeof createContentRepository>;
  media: ReturnType<typeof createMediaRepository>;
  signClips: ReturnType<typeof createSignClipsRepository>;
  config: ReturnType<typeof createConfigRepository>;
  users: ReturnType<typeof createUsersRepository>;
  account: ReturnType<typeof createAccountRepository>;
  stats: ReturnType<typeof createStatsRepository>;
  site: ReturnType<typeof createSiteRepository>;
  publications: ReturnType<typeof createPublicationsRepository>;
};

export function createRepositories(client: SupabaseClient): Repositories {
  return {
    content: createContentRepository(client),
    media: createMediaRepository(client),
    signClips: createSignClipsRepository(client),
    config: createConfigRepository(client),
    users: createUsersRepository(client),
    account: createAccountRepository(client),
    stats: createStatsRepository(client),
    site: createSiteRepository(client),
    publications: createPublicationsRepository(client),
  };
}
