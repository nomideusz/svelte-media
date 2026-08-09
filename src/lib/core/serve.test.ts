import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveMedia } from './serve.js';
import { createMediaStore } from './store.js';
import { createLocalAdapter } from './local-adapter.js';
import { createS3Adapter } from './adapter.js';
import type { StorageAdapter, StorageObject } from './types.js';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async () => `https://signed.example/${Math.random()}`),
}));
import { getSignedUrl as mockedPresign } from '@aws-sdk/s3-request-presigner';

function fakeAdapter(objects: Record<string, string> = {}): StorageAdapter & {
  deleted: string[];
} {
  const deleted: string[] = [];
  return {
    deleted,
    async put() {},
    async get(key): Promise<StorageObject | null> {
      const content = objects[key];
      if (content === undefined) return null;
      return {
        body: new Blob([content]).stream(),
        contentType: 'image/webp',
        contentLength: content.length,
      };
    },
    async delete(key) {
      deleted.push(key);
    },
    getUrl(key) {
      return `https://cdn.example/${key}`;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('serveMedia', () => {
  it('rejects traversal and malformed keys without touching the adapter', async () => {
    const adapter = fakeAdapter();
    const get = vi.spyOn(adapter, 'get');
    for (const key of ['../etc/passwd.png', 'a/%00.webp', 'no-extension', 'x/y/z.exe']) {
      const res = await serveMedia(adapter, key);
      expect(res.status, key).toBe(404);
    }
    expect(get).not.toHaveBeenCalled();
  });

  it('404s a missing object, 200s an existing one with immutable cache headers', async () => {
    const adapter = fakeAdapter({ 'schools/id/abc.webp': 'bytes' });
    expect((await serveMedia(adapter, 'schools/id/missing.webp')).status).toBe(404);

    const res = await serveMedia(adapter, 'schools/id/abc.webp');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/webp');
    expect(res.headers.get('Content-Length')).toBe('5');
    expect(res.headers.get('Cache-Control')).toContain('immutable');
    expect(await res.text()).toBe('bytes');
  });
});

describe('local adapter get()', () => {
  it('round-trips put → get and nulls a missing key', async () => {
    const root = await mkdtemp(join(tmpdir(), 'svelte-media-test-'));
    try {
      const adapter = createLocalAdapter({ root });
      await adapter.put('tours/t1/x.webp', Buffer.from('img-bytes'), 'image/webp');

      const obj = await adapter.get('tours/t1/x.webp');
      expect(obj).not.toBeNull();
      expect(obj!.contentType).toBe('image/webp');
      expect(obj!.contentLength).toBe(9);
      expect(await new Response(obj!.body).text()).toBe('img-bytes');

      expect(await adapter.get('tours/t1/missing.webp')).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('S3 adapter getSignedUrl cache', () => {
  const CONFIG = {
    endpoint: 'https://s3.test',
    region: 'auto',
    bucket: 'b',
    accessKeyId: 'k',
    secretAccessKey: 's',
  };

  it('caches within the TTL, dedupes concurrent calls, re-signs after expiry', async () => {
    vi.useFakeTimers();
    const adapter = createS3Adapter(CONFIG);

    const [a, b] = await Promise.all([
      adapter.getSignedUrl('x.webp', 600),
      adapter.getSignedUrl('x.webp', 600),
    ]);
    expect(a).toBe(b);
    expect(mockedPresign).toHaveBeenCalledTimes(1); // inflight dedupe

    expect(await adapter.getSignedUrl('x.webp', 600)).toBe(a);
    expect(mockedPresign).toHaveBeenCalledTimes(1); // cached

    await vi.advanceTimersByTimeAsync(600_000); // past 600s - 60s buffer
    await adapter.getSignedUrl('x.webp', 600);
    expect(mockedPresign).toHaveBeenCalledTimes(2); // expired → re-signed
  });

  it('getUrl throws without publicUrl and works with it', () => {
    expect(() => createS3Adapter(CONFIG).getUrl('x.webp')).toThrow(/publicUrl/);
    const withPublic = createS3Adapter({ ...CONFIG, publicUrl: 'https://pub.test/' });
    expect(withPublic.getUrl('x.webp')).toBe('https://pub.test/x.webp');
  });
});

describe('createMediaStore', () => {
  it('binds adapter + limits: url() uses variant keys, validate() uses config, remove() parses joined keys', async () => {
    const adapter = fakeAdapter();
    const store = createMediaStore({ adapter, maxFileSize: 1024 });

    expect(store.url('schools/id/a.webp', 'thumbnail')).toBe(
      'https://cdn.example/schools/id/thumb_a.webp'
    );
    expect(store.url('schools/id/a.webp')).toBe('https://cdn.example/schools/id/a.webp');

    const big = store.validate(
      new File(['x'.repeat(2048)], 'b.jpg', { type: 'image/jpeg' })
    );
    expect(big.valid).toBe(false);
    expect(big.code).toBe('file-too-large');

    await store.remove('schools/id/a.webp');
    expect(adapter.deleted.sort()).toEqual([
      'schools/id/a.webp',
      'schools/id/large_a.webp',
      'schools/id/med_a.webp',
      'schools/id/thumb_a.webp',
    ]);

    await store.remove('legacy-appwrite-id'); // no-op, not an error
    expect(adapter.deleted).toHaveLength(4);

    await expect(store.signedUrl('schools/id/a.webp')).rejects.toThrow(/S3 adapter/);
  });
});
