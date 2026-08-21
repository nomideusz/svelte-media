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

// ImageUpload / ImageGallery left the public API at 1.0: in two consuming
// apps neither was ever rendered, and this package's own changelog records
// the surface shipping broken twice precisely because nothing consumed it.
// The files remain for the demo; re-exporting later is an additive minor.
