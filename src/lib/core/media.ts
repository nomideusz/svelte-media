// Client-safe half of the package: validation, naming and key layout.
// Deliberately free of sharp, node:fs and Buffer so components and browser code
// can import it — see core/process.ts for the server pipeline.

import { createId } from '@paralleldrive/cuid2';
import type { ImageSize, ValidationConfig, ValidationErrorCode, ValidationResult } from './types.js';

export const DEFAULT_MAX_SIZE = 5 * 1024 * 1024;
export const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export const IMAGE_SIZES = {
  thumbnail: { width: 300, height: 300, fit: 'cover' as const },
  medium:    { width: 800, height: 600, fit: 'inside' as const },
  large:     { width: 1200, height: 900, fit: 'inside' as const },
};

export const SIZE_PREFIXES: Record<ImageSize, string> = {
  original:  '',
  thumbnail: 'thumb_',
  medium:    'med_',
  large:     'large_',
};

export const SIZE_QUALITY: Record<ImageSize, number> = {
  original:  95,
  thumbnail: 80,
  medium:    85,
  large:     90,
};

export function validateImageFile(file: File, config?: ValidationConfig): ValidationResult {
  const maxSize  = config?.maxFileSize  ?? DEFAULT_MAX_SIZE;
  const allowed  = config?.allowedTypes ?? DEFAULT_ALLOWED_TYPES;

  if (file.size === 0) {
    return { valid: false, code: 'empty', error: 'No file provided' };
  }
  if (file.size > maxSize) {
    const mb = Math.round(maxSize / 1024 / 1024);
    return { valid: false, code: 'file-too-large', maxBytes: maxSize, error: `File too large (max ${mb}MB)` };
  }
  if (!allowed.includes(file.type)) {
    return { valid: false, code: 'invalid-type', allowedTypes: allowed, error: `Invalid file type. Allowed: JPEG, PNG, WebP` };
  }
  return { valid: true };
}

/**
 * What `processAndStore` throws on a failed validation. Carries the
 * machine-readable `code` (+ limits) so form actions can map it to their own
 * copy instead of surfacing the English `message`.
 */
export class MediaValidationError extends Error {
  readonly code: ValidationErrorCode;
  readonly maxBytes?: number;
  readonly allowedTypes?: string[];

  constructor(result: ValidationResult) {
    super(result.error ?? 'Invalid file');
    this.name = 'MediaValidationError';
    this.code = result.code ?? 'invalid-type';
    this.maxBytes = result.maxBytes;
    this.allowedTypes = result.allowedTypes;
  }
}

export function generateMediaKey(): string {
  // All processed output is WebP regardless of the uploaded format.
  return `${createId()}.webp`;
}

export function getStorageKey(
  prefix: string,
  entityId: string,
  filename: string,
  size: ImageSize
): string {
  // Filenames are generated (`<cuid2>.webp`), but they round-trip through rows
  // and form fields before they come back here to be deleted — a `..` segment
  // would reach outside the entity's own folder. serveMedia guards the read
  // path; this is the write/delete one.
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error(`Invalid media filename: ${filename}`);
  }
  const sizePrefix = SIZE_PREFIXES[size];
  return `${prefix}/${entityId}/${sizePrefix}${filename}`;
}

/**
 * The variant key for a stored ORIGINAL key (`prefix/entityId/filename`) —
 * for apps that persist the single joined key rather than the
 * (prefix, entityId, filename) triple.
 */
export function variantKey(key: string, size: ImageSize): string {
  const idx = key.lastIndexOf('/');
  return `${key.slice(0, idx + 1)}${SIZE_PREFIXES[size]}${key.slice(idx + 1)}`;
}

/** The smallest pre-generated variant that still fills `width` display pixels. */
export function sizeForWidth(width?: number): ImageSize {
  if (!width) return 'medium';
  if (width <= IMAGE_SIZES.thumbnail.width) return 'thumbnail';
  if (width <= IMAGE_SIZES.medium.width) return 'medium';
  return 'large';
}

/**
 * Inverse of `getStorageKey` for an original key. Returns null for keys that
 * don't fit the `prefix/entityId/filename` layout (e.g. legacy ids), so
 * callers can treat those as "nothing to do".
 */
export function parseStorageKey(
  key: string
): { prefix: string; entityId: string; filename: string } | null {
  const parts = key.split('/');
  if (parts.length < 3) return null;
  const filename = parts.pop()!;
  const entityId = parts.pop()!;
  return { prefix: parts.join('/'), entityId, filename };
}
