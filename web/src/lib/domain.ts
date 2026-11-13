// Puente tipado hacia el dominio compartido con la app móvil (JS puro).
// Web y móvil usan el MISMO código para validar ejercicios y evaluar la
// configuración remota: una regla nueva no puede divergir entre plataformas.
import * as exerciseTypes from '@domain/levels/domain/exerciseTypes.js';
import * as exerciseFactory from '@domain/levels/domain/ExerciseFactory.js';
import * as levelBuilder from '@domain/levels/domain/LevelBuilder.js';
import * as remoteConfig from '@domain/remoteConfig/domain/remoteConfig.js';
import * as clipCatalog from '@domain/signs/domain/clipCatalog.js';
import * as clipEdit from '@domain/signs/domain/clipEdit.js';
import * as signMedia from '@domain/signs/domain/signMedia.js';
import * as result from '@core/result.js';

export type FieldSpec = {
  type: 'sign' | 'signs' | 'letters' | 'options' | 'text' | 'boolean' | 'choice' | 'subset';
  required: boolean;
  min?: number;
  max?: number;
  of?: string;
};
export type ExerciseTypeDefinition = { label: string; fields: Record<string, FieldSpec> };
export type RawExercise = { type: string; title?: string; hint?: string; [field: string]: unknown };
export type ExerciseRow = { position: number; type: string; title: string; hint: string | null; payload: Record<string, unknown> };

export const EXERCISE_TYPES = exerciseTypes.EXERCISE_TYPES as Record<string, ExerciseTypeDefinition>;
export const EXERCISE_TYPE_KEYS = exerciseTypes.EXERCISE_TYPE_KEYS as string[];
export const LEVEL_CATEGORIES = levelBuilder.LEVEL_CATEGORIES as string[];

type Factory = {
  create(raw: RawExercise): RawExercise;
  validate(raw: RawExercise): { valid: boolean; error: string | null };
  toRow(exercise: RawExercise, position: number): ExerciseRow;
  fromRow(row: Omit<ExerciseRow, 'position'> & { position?: number }): RawExercise;
};
export const ExerciseFactory = exerciseFactory.ExerciseFactory as unknown as Factory;

export type Announcement = {
  id: string;
  title?: string;
  message?: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  startsAt?: string;
  endsAt?: string;
  dismissible?: boolean;
};
// Contrato de la configuración remota (ver supabase/migrations/…_remote_config.sql).
export type RemoteConfigShape = {
  maintenance: { enabled: boolean; title: string; message: string };
  announcements: Announcement[];
  lives: { mode: 'session' | 'pool'; maxLives: number; refillMinutes: number };
  scoring: { hitPoints: number; failPenalty: number; lifeBonus: number; hintPenalty: number; starThresholds: number[] };
  difficulty: {
    quizSecondsPerQuestion: number;
    aiConfidenceThreshold: number;
    spellingConfidenceThreshold: number;
    hintsEnabled: boolean;
  };
  appVersion: { minimum: string; recommended: string; storeUrl: string };
};

export const DEFAULT_REMOTE_CONFIG = remoteConfig.DEFAULT_REMOTE_CONFIG as unknown as RemoteConfigShape;
export const DEFAULT_FLAGS = remoteConfig.DEFAULT_FLAGS as Record<string, boolean>;
export const mergeRemoteConfig = remoteConfig.mergeRemoteConfig as unknown as (rows: { key: string; value: unknown }[]) => RemoteConfigShape;
export const compareVersions = remoteConfig.compareVersions as (a: string, b: string) => number;

export const toUserMessage = result.toUserMessage as (error: unknown, fallback?: string) => string;

// ── Señas en video (docs/10-senas-en-video.md) ───────────────────────
export type CropSquare = { left: number; top: number; size: number };
export type ClipSource = { width: number; height: number; durationMs: number };
export type ClipTrim = { startMs: number; endMs: number };
/** Lo que decide quien edita; se guarda tal cual en sign_clips.edit_params. */
export type ClipEdit = { source: ClipSource; crop: CropSquare; trim: ClipTrim; keyFrameMs: number };
export type ClipEditValidation = {
  valid: boolean;
  errors: Partial<Record<'source' | 'crop' | 'trim' | 'keyFrame', string>>;
  warnings: Partial<Record<'crop', string>>;
};
export type SignClipLimits = {
  minDurationMs: number;
  maxDurationMs: number;
  exportSize: number;
  minCropSize: number;
  frameRate: number;
  maxVideoBytes: number;
};

export const SIGN_CLIP_LIMITS = signMedia.SIGN_CLIP_LIMITS as SignClipLimits;
export const toSignKey = signMedia.toSignKey as (gloss: string) => string;
export const toStorageFolder = signMedia.toStorageFolder as (signKey: string) => string;
export const isValidSignKey = signMedia.isValidSignKey as (value: unknown) => boolean;
export const MVP_CLIP_CATALOG = clipCatalog.MVP_CLIP_CATALOG as readonly { gloss: string; level: 1 | 2 | 3 }[];
export const MVP_CLIP_LEVEL_LABELS = clipCatalog.MVP_CLIP_LEVEL_LABELS as Record<1 | 2 | 3, string>;
export const createClipEdit = clipEdit.createClipEdit as (source: ClipSource) => ClipEdit;
export const clampCrop = clipEdit.clampCrop as (crop: CropSquare, source: ClipSource) => CropSquare;
export const moveCrop = clipEdit.moveCrop as (crop: CropSquare, dx: number, dy: number, source: ClipSource) => CropSquare;
export const resizeCrop = clipEdit.resizeCrop as (crop: CropSquare, delta: number, source: ClipSource) => CropSquare;
export const snapToFrame = clipEdit.snapToFrame as (ms: number, frameRate?: number) => number;
export const validateClipEdit = clipEdit.validateClipEdit as (edit: ClipEdit) => ClipEditValidation;
export const missingSignMedia = signMedia.missingSignMedia as (signKeys: unknown, options?: { clipKeys?: string[] }) => string[];
