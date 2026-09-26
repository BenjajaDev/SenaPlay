// Modelos de datos del portal (espejo de las tablas de Supabase).

export type Level = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  available: boolean;
  sort_order: number;
  updated_at?: string;
  exercise_count?: number;
};

export type ExerciseDraft = {
  type: string;
  title: string;
  hint: string;
  payload: Record<string, unknown>;
};

export type LevelWithExercises = Level & { exercises: ExerciseDraft[] };

export type DictionaryEntry = {
  id?: number;
  letter: string;
  sign: string;
  description: string | null;
  category: string;
  difficulty: string | null;
  sort_order: number;
};

export type VocabularySign = {
  id?: number;
  word: string;
  type: string | null;
  meaning: string | null;
  how_to: string | null;
  theme: string | null;
  page: number | null;
};

export type MediaKind = 'video' | 'image' | 'document';

export type MediaItem = {
  id: string;
  kind: MediaKind;
  title: string;
  description: string | null;
  category: string;
  tags: string[];
  storage_path: string;
  public_url: string;
  thumbnail_url: string | null;
  captions_url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  duration_seconds: number | null;
  sign_key: string | null;
  published: boolean;
  sort_order: number;
  created_at: string;
};

export type ConfigRow = { key: string; value: unknown; description: string | null; updated_at: string };

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  rollout_percentage: number;
  starts_at: string | null;
  ends_at: string | null;
  description: string | null;
  updated_at?: string;
};

export type AuditEntry = {
  id: number;
  table_name: string;
  record_key: string;
  action: string;
  old_value: unknown;
  new_value: unknown;
  changed_by: string | null;
  changed_at: string;
};

export type Role = 'user' | 'editor' | 'admin';

export type Profile = { id: string; email: string | null; full_name: string | null; role: Role; created_at: string };

/** Textos de la sección «Nosotros» (site_content, clave `about`). */
export type AboutContent = {
  title: string;
  intro: string;
  mission: string;
  vision: string;
};

export type TeamMember = {
  id?: string;
  full_name: string;
  role: string;
  bio: string | null;
  photo_url: string | null;
  photo_path: string | null;
  sort_order: number;
  published: boolean;
};

// ── Secciones de la landing (site_content, una clave por sección) ──────

/** Íconos que el panel ofrece para las tarjetas de la landing (ver lib/siteIcons.ts). */
export type SiteIconKey =
  | 'layers'
  | 'camera'
  | 'book'
  | 'gamepad'
  | 'video'
  | 'sparkles'
  | 'vibrate'
  | 'accessibility'
  | 'hand'
  | 'heart'
  | 'users'
  | 'star'
  | 'smartphone'
  | 'megaphone'
  | 'graduation';

export type SectionItem = { icon: SiteIconKey; title: string; text: string };

export type LandingSections = {
  hero: { badge: string; title: string; text: string; primaryLabel: string; secondaryLabel: string };
  metrics: { visible: boolean; title: string };
  features: { visible: boolean; title: string; items: SectionItem[] };
  accessibility: { visible: boolean; title: string; items: SectionItem[] };
  publications: { visible: boolean; title: string; intro: string };
  download: { visible: boolean; title: string; text: string };
  footer: { text: string };
};

export type SectionKey = keyof LandingSections;

// ── Publicaciones ──────────────────────────────────────────────────────

export type PublicationCategory = 'congreso' | 'actividad' | 'prueba' | 'noticia' | 'otro';

export type Publication = {
  id?: string;
  title: string;
  summary: string;
  body: string | null;
  category: PublicationCategory;
  /** Fecha del evento en formato AAAA-MM-DD. */
  event_date: string | null;
  location: string | null;
  link_url: string | null;
  cover_url: string | null;
  cover_path: string | null;
  published: boolean;
  created_at?: string;
};

/** Fila de mistake_stats(): ejercicios con más errores en la app (solo staff). */
export type MistakeStat = {
  level_id: number;
  exercise_key: string;
  exercise_type: string;
  exercise_title: string | null;
  sign: string | null;
  mistakes: number;
  people: number;
  game_overs: number;
  top_answer: string | null;
};

export type PublicStats = {
  levels: number;
  exercises: number;
  dictionary: number;
  vocabulary: number;
  videos: number;
  learners: number;
};
