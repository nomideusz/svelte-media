// Client-safe half of the package: validation, naming and key layout.
// Deliberately free of sharp, node:fs and Buffer so components and browser code
// can import it — see core/process.ts for the server pipeline.

import { createId } from '@paralleldrive/cuid2';
import type { ImageSize, MediaConfig, ValidationResult } from './types.js';

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

export function validateImageFile(file: File, config?: MediaConfig): ValidationResult {
  const maxSize  = config?.maxFileSize  ?? DEFAULT_MAX_SIZE;
  const allowed  = config?.allowedTypes ?? DEFAULT_ALLOWED_TYPES;

  if (file.size > maxSize) {
    const mb = Math.round(maxSize / 1024 / 1024);
    return { valid: false, error: `File too large (max ${mb}MB)` };
  }
  if (!allowed.includes(file.type)) {
    return { valid: false, error: `Invalid file type. Allowed: JPEG, PNG, WebP` };
  }
  return { valid: true };
}

export function generateMediaKey(_originalName?: string): string {
  // All processed output is WebP regardless of the uploaded format.
  return `${createId()}.webp`;
}

export function getStorageKey(
  prefix: string,
  entityId: string,
  filename: string,
  size: ImageSize
): string {
  const sizePrefix = SIZE_PREFIXES[size];
  return `${prefix}/${entityId}/${sizePrefix}${filename}`;
}
