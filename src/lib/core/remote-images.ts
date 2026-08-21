// Caching images that come from somewhere else — a paid photo API, a partner
// CDN, a scraper. Server-only (sharp).
//
// kit 3 claims any file named `remote.*` as a remote-functions module
// (pattern /[/.]remote\.[^/]+$/) and rejects its plain exports — hence
// `remote-images`, not `remote`.
//
// Extracted from yoga's Google Places hero proxy, which was paying Google per
// origin miss until it grew a bucket cache, a stampede lock and a transcode
// step around it. All three are storage plumbing, not Places knowledge: what
// stays in the app is which URL to call, what it costs and when to give up.

import sharp from 'sharp';
import type { StorageAdapter } from './types.js';

export interface ImageBytes {
  /** Concrete ArrayBuffer view — `Response` and `Blob` reject the SharedArrayBuffer-wide type. */
  body: Uint8Array<ArrayBuffer>;
  contentType: string;
}

// Cached objects are keyed by content and never rewritten in place, so the
// bytes behind a URL never change — same header serveMedia sends.
const IMMUTABLE = 'public, max-age=31536000, immutable';

/**
 * Re-encode to WebP (~30-50% smaller than the JPEG most photo APIs serve).
 * Returns the input untouched when sharp cannot read it — a transcode is an
 * optimisation, never a reason to lose an image we already hold.
 */
export async function toWebp(bytes: Uint8Array<ArrayBuffer>, quality = 80): Promise<ImageBytes> {
  try {
    const webp = await sharp(Buffer.from(bytes)).webp({ quality }).toBuffer();
    return { body: new Uint8Array(webp), contentType: 'image/webp' };
  } catch {
    return { body: bytes, contentType: 'application/octet-stream' };
  }
}

export interface FetchImageOptions extends RequestInit {
  /** WebP quality, or `false` to keep the upstream encoding. Default 80. */
  webp?: number | false;
}

/**
 * GET an image from a remote URL, transcoded to WebP by default.
 * `null` when the response fails or isn't an image — an error page's HTML must
 * never reach the cache as if it were a photo.
 */
export async function fetchImage(
  url: string,
  options: FetchImageOptions = {}
): Promise<ImageBytes | null> {
  const { webp = 80, ...init } = options;
  const res = await fetch(url, { redirect: 'follow', ...init });
  if (!res.ok) return null;

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.startsWith('image/')) return null;

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (webp === false) return { body: bytes, contentType };

  const encoded = await toWebp(bytes, webp);
  // sharp failed — keep the upstream type rather than toWebp's octet-stream.
  return encoded.contentType === 'image/webp' ? encoded : { body: bytes, contentType };
}

export interface CachedImageOptions {
  /**
   * Called when the fetched bytes could not be stored. The response still goes
   * out; the next request will produce them again (i.e. pay again), so wire
   * this to your logger.
   */
  onStoreError?(error: unknown, key: string): void;
}

// Per-adapter, so two stores in one process cannot collide on a shared key.
const inflight = new WeakMap<StorageAdapter, Map<string, Promise<ImageBytes | null>>>();

/**
 * Serve `key` from storage, producing it once on the first miss.
 *
 * Cheapest path first: a stored copy is streamed without calling `produce` at
 * all. Concurrent misses for the same key share one `produce` call — a CDN
 * stampede across PoPs, or a crawler, otherwise buys one copy each.
 *
 * `null` means `produce` had nothing (the caller decides: 404, placeholder,
 * fall through). A storage read that throws is treated as a miss: an
 * unreachable bucket must not blank an image it could still fetch.
 */
export async function cachedImage(
  adapter: StorageAdapter,
  key: string,
  produce: () => Promise<ImageBytes | null>,
  options: CachedImageOptions = {}
): Promise<Response | null> {
  const stored = await adapter.get(key).catch(() => null);
  if (stored) {
    return new Response(stored.body, {
      headers: {
        'Content-Type': stored.contentType,
        ...(stored.contentLength != null
          ? { 'Content-Length': String(stored.contentLength) }
          : {}),
        'Cache-Control': IMMUTABLE,
      },
    });
  }

  let pending = inflight.get(adapter);
  if (!pending) {
    pending = new Map();
    inflight.set(adapter, pending);
  }

  let work = pending.get(key);
  if (!work) {
    work = (async () => {
      const image = await produce();
      if (!image) return null;
      // Awaited: a silent write failure means paying for these bytes again on
      // the next request, which is the whole point of the cache.
      try {
        await adapter.put(key, Buffer.from(image.body), image.contentType);
      } catch (error) {
        options.onStoreError?.(error, key);
      }
      return image;
    })().finally(() => pending!.delete(key));
    pending.set(key, work);
  }

  const image = await work;
  if (!image) return null;

  return new Response(image.body, {
    headers: {
      'Content-Type': image.contentType,
      'Content-Length': String(image.body.byteLength),
      'Cache-Control': IMMUTABLE,
    },
  });
}
