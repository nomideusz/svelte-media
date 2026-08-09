// Server-only entry: sharp, node:fs and Buffer live behind here.

export type { LocalConfig } from '../core/local-adapter.js';
export { createS3Adapter } from '../core/adapter.js';
export { createLocalAdapter } from '../core/local-adapter.js';
export { processAndStore, deleteMedia, deleteMediaByKey, getMediaUrl } from '../core/process.js';
export { serveMedia } from '../core/serve.js';
export { createMediaStore } from '../core/store.js';
export type { MediaStore, MediaStoreConfig } from '../core/store.js';

// Re-exported so server code needs only one import.
export {
  validateImageFile,
  MediaValidationError,
  generateMediaKey,
  getStorageKey,
  variantKey,
  sizeForWidth,
  parseStorageKey,
  IMAGE_SIZES,
  SIZE_PREFIXES,
  SIZE_QUALITY,
} from '../core/media.js';
export type * from '../core/types.js';
