import sharp from 'sharp';
import { createId } from '@paralleldrive/cuid2';
import type {
  StorageAdapter,
  StoredMedia,
  ImageSize,
  MediaConfig,
  ValidationResult,
} from './types.js';

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024;
const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export const IMAGE_SIZES = {
  thumbnail: { width: 300, height: 300, fit: 'cover' as const },
  medium:    { width: 800, height: 600, fit: 'inside' as const },
  large:     { width: 1200, height: 900, fit: 'inside' as const },
};

const SIZE_PREFIXES: Record<ImageSize, string> = {
  original:  '',
  thumbnail: 'thumb_',
  medium:    'med_',
  large:     'large_',
};

const SIZE_QUALITY: Record<ImageSize, number> = {
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

export async function processAndStore(
  adapter: StorageAdapter,
  file: File,
  prefix: string,
  entityId: string,
  config?: MediaConfig
): Promise<StoredMedia> {
  const validation = validateImageFile(file, config);
  if (!validation.valid) throw new Error(validation.error);

  const filename = generateMediaKey(file.name);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const sizes: Record<ImageSize, string> = {
    original:  getStorageKey(prefix, entityId, filename, 'original'),
    thumbnail: getStorageKey(prefix, entityId, filename, 'thumbnail'),
    medium:    getStorageKey(prefix, entityId, filename, 'medium'),
    large:     getStorageKey(prefix, entityId, filename, 'large'),
  };

  const originalBuf = await sharp(buffer).rotate().webp({ quality: SIZE_QUALITY.original }).toBuffer();
  await adapter.put(sizes.original, originalBuf, 'image/webp');

  for (const size of ['thumbnail', 'medium', 'large'] as const) {
    const { width, height, fit } = IMAGE_SIZES[size];
    const resized = await sharp(buffer)
      .rotate()
      .resize(width, height, { fit, withoutEnlargement: true })
      .webp({ quality: SIZE_QUALITY[size] })
      .toBuffer();
    await adapter.put(sizes[size], resized, 'image/webp');
  }
  // ponytail: existing objects stay JPEG under their old keys — URLs derive
  // from the stored filename, so old rows keep working without migration.

  return { filename, originalName: file.name, prefix, entityId, sizes };
}

export async function deleteMedia(
  adapter: StorageAdapter,
  prefix: string,
  entityId: string,
  filename: string
): Promise<void> {
  const keys = (['original', 'thumbnail', 'medium', 'large'] as ImageSize[]).map((size) =>
    getStorageKey(prefix, entityId, filename, size)
  );
  await Promise.all(keys.map((key) => adapter.delete(key).catch(() => {})));
}

export function getMediaUrl(
  adapter: StorageAdapter,
  prefix: string,
  entityId: string,
  filename: string,
  size: ImageSize = 'medium'
): string {
  return adapter.getUrl(getStorageKey(prefix, entityId, filename, size));
}
