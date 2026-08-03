// Server-only pipeline: needs sharp and Node's Buffer. Importing this from a
// browser bundle will fail — the client-safe helpers live in core/media.ts and
// are re-exported from the package root.

import sharp from 'sharp';
import type { StorageAdapter, StoredMedia, ImageSize, MediaConfig } from './types.js';
import {
  IMAGE_SIZES,
  SIZE_QUALITY,
  generateMediaKey,
  getStorageKey,
  validateImageFile,
} from './media.js';

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
