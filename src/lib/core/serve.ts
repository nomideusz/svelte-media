import type { StorageAdapter } from './types.js';

// Media keys are `prefix/entityId/(sizePrefix)filename.ext` — reject anything
// else (especially `..` traversal) before it reaches the adapter. Both source
// apps had written this route by hand; the copy without the guard had a path
// traversal, which is why the validation lives here now.
const MEDIA_KEY = /^[a-zA-Z0-9_/.-]+\.(webp|jpe?g|png)$/;

/**
 * Same-origin media serving: the whole body of a
 * `/photos/[...key]`-style route. Key validation, 404 on missing, immutable
 * cache headers (keys are content-addressed and never change in place).
 * Returns a standard `Response` — return it directly from a SvelteKit handler.
 */
export async function serveMedia(adapter: StorageAdapter, key: string): Promise<Response> {
  if (!MEDIA_KEY.test(key) || key.includes('..')) {
    return new Response('Not found', { status: 404 });
  }
  const obj = await adapter.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.contentType,
      ...(obj.contentLength != null ? { 'Content-Length': String(obj.contentLength) } : {}),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
