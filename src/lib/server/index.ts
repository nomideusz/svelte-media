// Server-only entry: sharp, node:fs and Buffer live behind here.

export type { LocalConfig } from '../core/local-adapter.js';
export { createS3Adapter } from '../core/adapter.js';
export { createLocalAdapter } from '../core/local-adapter.js';
export { processAndStore, deleteMedia, getMediaUrl } from '../core/process.js';

// Re-exported so server code needs only one import.
export {
  validateImageFile,
  generateMediaKey,
  getStorageKey,
  IMAGE_SIZES,
} from '../core/media.js';
export type * from '../core/types.js';
