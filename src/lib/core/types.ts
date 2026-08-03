// packages/svelte-media/src/lib/core/types.ts

export type ImageSize = 'original' | 'thumbnail' | 'medium' | 'large';

export interface StorageAdapter {
  put(key: string, buffer: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}

export interface S3Config {
  /** Full endpoint URL, e.g. https://xxx.r2.cloudflarestorage.com */
  endpoint: string;
  /** Region string, e.g. 'auto' for R2 or 'us-east-1' for AWS */
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Base public URL for getUrl(), e.g. https://pub-xxx.r2.dev */
  publicUrl: string;
  /** Use path-style access (default: true for MinIO/R2, set false for Railway/AWS) */
  forcePathStyle?: boolean;
}

export interface StoredMedia<TDerived = never> {
  filename: string;
  originalName: string;
  /** Storage prefix, e.g. 'tours' or 'avatars' */
  prefix: string;
  /** Entity that owns this media, e.g. tourId or guideId */
  entityId: string;
  /** Storage keys for each size */
  sizes: Record<ImageSize, string>;
  /**
   * Result of `config.derive`, when supplied. Undefined if no hook was given,
   * or if it threw — see `MediaConfig.onDeriveError`.
   */
  derived?: TDerived;
}

export interface MediaValidationError {
  isValid: false;
  error: string;
}
export interface MediaValidationOk {
  isValid: true;
}
export type MediaValidation = MediaValidationOk | MediaValidationError;

export const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5 MB
export const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** What a `derive` hook receives — the image as uploaded, before any resizing. */
export interface DeriveSource {
  /** Original bytes, pre-resize, EXIF intact. */
  buffer: Buffer;
  /** The generated storage filename, e.g. `k7x2m9.webp`. */
  filename: string;
  /** The uploaded file's MIME type. */
  mimeType: string;
}

/** The validation half of MediaConfig — all `validateImageFile` needs. */
export interface ValidationConfig {
  maxFileSize?: number;
  allowedTypes?: string[];
}

export interface MediaConfig<TDerived = never> extends ValidationConfig {
  /**
   * Optional side-computation over the image, run once during processing while
   * the bytes are already in hand — a placeholder, a blurhash, a dominant
   * colour, EXIF. Whatever it returns is attached to the result as `derived`.
   *
   * Runs after every size has been stored, so a failure cannot orphan a
   * half-written upload. Failures do not propagate: the upload has already
   * succeeded and a derived extra must never invalidate it. `derived` is left
   * undefined and `onDeriveError` is called.
   */
  derive?(source: DeriveSource): Promise<TDerived>;
  /**
   * Called when `derive` throws. The upload still succeeds. Without this the
   * failure is silent, so wire it to your logger.
   */
  onDeriveError?(error: unknown, source: DeriveSource): void;
}
