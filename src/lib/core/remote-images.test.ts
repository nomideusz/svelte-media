import { describe, it, expect, vi, afterEach } from 'vitest';
import sharp from 'sharp';
import { cachedImage, fetchImage, toWebp, type ImageBytes } from './remote-images.js';
import type { StorageAdapter, StorageObject } from './types.js';

function memoryAdapter(failWrites = false) {
  const objects = new Map<string, ImageBytes>();
  const adapter: StorageAdapter & { objects: typeof objects } = {
    objects,
    async put(key, buffer, contentType) {
      if (failWrites) throw new Error('bucket down');
      objects.set(key, { body: new Uint8Array(buffer), contentType });
    },
    async get(key): Promise<StorageObject | null> {
      const hit = objects.get(key);
      if (!hit) return null;
      return {
        body: new Blob([hit.body]).stream(),
        contentType: hit.contentType,
        contentLength: hit.body.byteLength,
      };
    },
    async delete(key) {
      objects.delete(key);
    },
    getUrl: (key) => key,
  };
  return adapter;
}

const red = () =>
  sharp({ create: { width: 4, height: 4, channels: 3, background: '#f00' } }).png().toBuffer();

afterEach(() => vi.unstubAllGlobals());

describe('toWebp', () => {
  it('re-encodes a real image', async () => {
    const out = await toWebp(new Uint8Array(await red()));
    expect(out.contentType).toBe('image/webp');
  });

  it('returns the bytes untouched when sharp cannot read them', async () => {
    const junk = new Uint8Array([1, 2, 3]);
    const out = await toWebp(junk);
    expect(out.body).toBe(junk);
  });
});

describe('fetchImage', () => {
  it('rejects a non-image response instead of caching an error page', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html>rate limited</html>', {
      headers: { 'content-type': 'text/html' },
    }));
    expect(await fetchImage('https://example.test/photo')).toBeNull();
  });

  it('rejects a failed response', async () => {
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 500 }));
    expect(await fetchImage('https://example.test/photo')).toBeNull();
  });

  it('transcodes an upstream JPEG to WebP', async () => {
    const jpeg = await sharp(await red()).jpeg().toBuffer();
    vi.stubGlobal('fetch', async () => new Response(new Uint8Array(jpeg), {
      headers: { 'content-type': 'image/jpeg' },
    }));
    const out = await fetchImage('https://example.test/photo');
    expect(out?.contentType).toBe('image/webp');
  });

  it('keeps the upstream encoding when webp is off', async () => {
    vi.stubGlobal('fetch', async () => new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-type': 'image/gif' },
    }));
    const out = await fetchImage('https://example.test/photo', { webp: false });
    expect(out?.contentType).toBe('image/gif');
  });
});

describe('cachedImage', () => {
  const bytes: ImageBytes = { body: new Uint8Array([7, 7, 7]), contentType: 'image/webp' };

  it('produces once, then serves the stored copy', async () => {
    const adapter = memoryAdapter();
    const produce = vi.fn(async () => bytes);

    const first = await cachedImage(adapter, 'a/b/c.webp', produce);
    expect(first?.status).toBe(200);
    expect(adapter.objects.has('a/b/c.webp')).toBe(true);

    const second = await cachedImage(adapter, 'a/b/c.webp', produce);
    expect(await second!.arrayBuffer()).toEqual(bytes.body.buffer);
    expect(produce).toHaveBeenCalledTimes(1);
    expect(second!.headers.get('Cache-Control')).toContain('immutable');
  });

  it('coalesces a stampede into one produce call', async () => {
    const adapter = memoryAdapter();
    const produce = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return bytes;
    });
    const all = await Promise.all(
      Array.from({ length: 8 }, () => cachedImage(adapter, 'a/b/c.webp', produce))
    );
    expect(all.every((r) => r?.status === 200)).toBe(true);
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it('returns null when there is nothing to produce', async () => {
    expect(await cachedImage(memoryAdapter(), 'a/b/c.webp', async () => null)).toBeNull();
  });

  it('still serves when the write fails, and reports it', async () => {
    const onStoreError = vi.fn();
    const res = await cachedImage(memoryAdapter(true), 'a/b/c.webp', async () => bytes, {
      onStoreError,
    });
    expect(res?.status).toBe(200);
    expect(onStoreError).toHaveBeenCalled();
  });

  it('treats an unreachable bucket as a miss rather than a blank image', async () => {
    const adapter = memoryAdapter();
    adapter.get = async () => {
      throw new Error('bucket down');
    };
    const res = await cachedImage(adapter, 'a/b/c.webp', async () => bytes);
    expect(res?.status).toBe(200);
  });
});
