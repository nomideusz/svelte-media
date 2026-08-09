import type {
  ImageSize,
  MediaConfig,
  S3Adapter,
  StorageAdapter,
  StorageObject,
  StoredMedia,
  ValidationResult,
} from './types.js';
import { validateImageFile, variantKey } from './media.js';
import { processAndStore, deleteMediaByKey } from './process.js';
import { serveMedia } from './serve.js';

export interface MediaStoreConfig<TDerived = never> extends MediaConfig<TDerived> {
  adapter: StorageAdapter;
}

/**
 * The per-app binding — adapter, limits and derive hook bound once, so call
 * sites pass only what varies per upload. Both source apps had hand-built this
 * module (and one ended up configuring the same bucket two different ways);
 * app #3 starts here instead.
 *
 * Env reading stays in the app: build the adapter from your own env names and
 * hand it in.
 */
export interface MediaStore<TDerived = never> {
  adapter: StorageAdapter;
  /** `processAndStore` with the bound adapter + config. */
  store(file: File, prefix: string, entityId: string): Promise<StoredMedia<TDerived>>;
  /** Deletes all variants by the joined original key; unparseable keys are a no-op. */
  remove(key: string): Promise<void>;
  get(key: string): Promise<StorageObject | null>;
  /** `serveMedia` with the bound adapter — a complete same-origin route body. */
  serve(key: string): Promise<Response>;
  /** Public URL for a size variant (adapters with a publicUrl only). */
  url(key: string, size?: ImageSize): string;
  /** Presigned URL for a size variant — rejects unless the adapter is S3. */
  signedUrl(key: string, size?: ImageSize, expiresIn?: number): Promise<string>;
  /** `validateImageFile` with the bound limits. */
  validate(file: File): ValidationResult;
}

export function createMediaStore<TDerived = never>(
  config: MediaStoreConfig<TDerived>
): MediaStore<TDerived> {
  const { adapter, ...media } = config;
  return {
    adapter,
    store: (file, prefix, entityId) => processAndStore(adapter, file, prefix, entityId, media),
    remove: (key) => deleteMediaByKey(adapter, key),
    get: (key) => adapter.get(key),
    serve: (key) => serveMedia(adapter, key),
    url: (key, size = 'original') => adapter.getUrl(variantKey(key, size)),
    signedUrl: (key, size = 'original', expiresIn) => {
      const s3 = adapter as Partial<S3Adapter>;
      if (!s3.getSignedUrl) {
        return Promise.reject(new Error('signedUrl needs an S3 adapter (getSignedUrl)'));
      }
      return s3.getSignedUrl(variantKey(key, size), expiresIn);
    },
    validate: (file) => validateImageFile(file, media),
  };
}
