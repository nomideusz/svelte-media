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
import { cachedImage, type CachedImageOptions, type ImageBytes } from './remote-images.js';

export interface MediaStoreConfig<TDerived = never> extends MediaConfig<TDerived> {
  adapter: StorageAdapter;
  /**
   * Where the same-origin serving route lives, e.g. `'/photos'` or
   * `'/api/images'` — what `resolveUrl` falls back to when the adapter cannot
   * presign (local dev, public buckets).
   */
  basePath?: string;
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
  /**
   * The URL to hand a browser: presigned when the adapter can sign (a private
   * bucket in production), else `basePath/key` for the same-origin route.
   * Both apps had written that fallback by hand.
   */
  resolveUrl(key: string, size?: ImageSize, expiresIn?: number): Promise<string>;
  /**
   * `cachedImage` with the bound adapter — serve a key from storage, buying it
   * from `produce` once on the first miss.
   */
  cached(
    key: string,
    produce: () => Promise<ImageBytes | null>,
    options?: CachedImageOptions
  ): Promise<Response | null>;
  /** `validateImageFile` with the bound limits. */
  validate(file: File): ValidationResult;
}

export function createMediaStore<TDerived = never>(
  config: MediaStoreConfig<TDerived>
): MediaStore<TDerived> {
  const { adapter, basePath, ...media } = config;
  const signer = (adapter as Partial<S3Adapter>).getSignedUrl?.bind(adapter);
  return {
    adapter,
    store: (file, prefix, entityId) => processAndStore(adapter, file, prefix, entityId, media),
    remove: (key) => deleteMediaByKey(adapter, key),
    get: (key) => adapter.get(key),
    serve: (key) => serveMedia(adapter, key),
    url: (key, size = 'original') => adapter.getUrl(variantKey(key, size)),
    signedUrl: (key, size = 'original', expiresIn) => {
      if (!signer) {
        return Promise.reject(new Error('signedUrl needs an S3 adapter (getSignedUrl)'));
      }
      return signer(variantKey(key, size), expiresIn);
    },
    resolveUrl: async (key, size = 'original', expiresIn) => {
      const variant = variantKey(key, size);
      if (signer) return signer(variant, expiresIn);
      if (!basePath) {
        throw new Error('resolveUrl needs an S3 adapter or a basePath for the serving route');
      }
      return `${basePath.replace(/\/$/, '')}/${variant}`;
    },
    cached: (key, produce, options) => cachedImage(adapter, key, produce, options),
    validate: (file) => validateImageFile(file, media),
  };
}
