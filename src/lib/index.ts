// Client-safe entry. The image pipeline and storage adapters need sharp,
// node:fs and Buffer, so they live behind '@nomideusz/svelte-media/server' —
// importing them here would break any browser bundle that touches a component.

export type {
  StorageAdapter,
  S3Adapter,
  S3Config,
  StorageObject,
  StoredMedia,
  ImageSize,
  MediaConfig,
  ValidationResult,
  ValidationConfig,
  ValidationErrorCode,
  DeriveSource,
} from './core/types.js';

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
  DEFAULT_MAX_SIZE,
  DEFAULT_ALLOWED_TYPES,
} from './core/media.js';

export { default as ImageUpload } from './components/ImageUpload.svelte';
export { default as ImageGallery } from './components/ImageGallery.svelte';
