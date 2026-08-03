// Client-safe entry. The image pipeline and storage adapters need sharp,
// node:fs and Buffer, so they live behind '@nomideusz/svelte-media/server' —
// importing them here would break any browser bundle that touches a component.

export type {
  StorageAdapter,
  S3Config,
  StoredMedia,
  ImageSize,
  MediaConfig,
  ValidationResult,
} from './core/types.js';

export {
  validateImageFile,
  generateMediaKey,
  getStorageKey,
  IMAGE_SIZES,
  DEFAULT_MAX_SIZE,
  DEFAULT_ALLOWED_TYPES,
} from './core/media.js';

export { default as ImageUpload } from './components/ImageUpload.svelte';
export { default as ImageGallery } from './components/ImageGallery.svelte';
