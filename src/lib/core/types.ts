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

export interface StoredMedia {
  filename: string;
  originalName: string;
  /** Storage prefix, e.g. 'tours' or 'avatars' */
  prefix: string;
  /** Entity that owns this media, e.g. tourId or guideId */
  entityId: string;
  /** Storage keys for each size */
  sizes: Record<ImageSize, string>;
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

export interface MediaConfig {
  maxFileSize?: number;
  allowedTypes?: string[];
}
