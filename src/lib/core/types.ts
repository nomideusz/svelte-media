// packages/svelte-media/src/lib/core/types.ts
/// <reference types="node" preserve="true" />

export type ImageSize = 'original' | 'thumbnail' | 'medium' | 'large';

/** What `StorageAdapter.get` resolves for an existing object. */
export interface StorageObject {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength: number | null;
}

export interface StorageAdapter {
  put(key: string, buffer: Buffer, contentType: string): Promise<void>;
  /** null when the object doesn't exist; rejects on real failures (network, auth). */
  get(key: string): Promise<StorageObject | null>;
  delete(key: string): Promise<void>;
  /** Public-URL serving only — throws when the adapter has no public base URL. */
  getUrl(key: string): string;
}

/** What `createS3Adapter` actually returns — a StorageAdapter that can presign. */
export interface S3Adapter extends StorageAdapter {
  /**
   * Presigned GET URL for a private bucket. Cached until shortly before
   * expiry and deduped in flight, so page loads with many images cost one
   * signing pass per key.
   */
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}

export interface S3Config {
  /** Full endpoint URL, e.g. https://xxx.r2.cloudflarestorage.com */
  endpoint: string;
  /** Region string, e.g. 'auto' for R2 or 'us-east-1' for AWS */
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /**
   * Base public URL for getUrl(), e.g. https://pub-xxx.r2.dev. Optional —
   * private buckets serve via `get()` (same-origin proxy) or `getSignedUrl()`
   * instead, and `getUrl()` throws without it.
   */
  publicUrl?: string;
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

/** Machine-readable validation failure — map it to your own copy/i18n. */
export type ValidationErrorCode = 'empty' | 'file-too-large' | 'invalid-type';

export interface ValidationResult {
  valid: boolean;
  /** Set when `valid` is false. */
  code?: ValidationErrorCode;
  /** The limit that produced a 'file-too-large', for message interpolation. */
  maxBytes?: number;
  /** The allow-list that produced an 'invalid-type'. */
  allowedTypes?: string[];
  /** Human-readable English fallback; apps with i18n should map `code` instead. */
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
  /** Storage prefix this upload went to, e.g. 'schools'. */
  prefix: string;
  /** The owning entity — what a failing hook needs to name in a log line. */
  entityId: string;
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
