import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import { processAndStore } from './process.js';
import type { StorageAdapter } from './types.js';

/** In-memory adapter: records what was written, never touches the network. */
function memoryAdapter() {
  const written = new Map<string, Buffer>();
  const adapter: StorageAdapter = {
    async put(key, buffer) {
      written.set(key, buffer);
    },
    async delete(key) {
      written.delete(key);
    },
    getUrl: (key) => `memory://${key}`,
  };
  return { adapter, written };
}

async function pngFile(name = 'photo.png'): Promise<File> {
  const buf = await sharp({
    create: { width: 64, height: 48, channels: 3, background: { r: 120, g: 90, b: 60 } },
  })
    .png()
    .toBuffer();
  return new File([new Uint8Array(buf)], name, { type: 'image/png' });
}

describe('processAndStore — derive hook', () => {
  it('attaches the hook result as `derived`', async () => {
    const { adapter } = memoryAdapter();
    const stored = await processAndStore(adapter, await pngFile(), 'tours', 't1', {
      derive: async ({ buffer, filename, mimeType }) => ({
        bytes: buffer.length,
        filename,
        mimeType,
      }),
    });

    expect(stored.derived).toMatchObject({ mimeType: 'image/png' });
    expect(stored.derived!.bytes).toBeGreaterThan(0);
    // Given the original bytes, not a resized variant
    expect(stored.derived!.filename).toBe(stored.filename);
  });

  it('leaves `derived` undefined when no hook is given', async () => {
    const { adapter } = memoryAdapter();
    const stored = await processAndStore(adapter, await pngFile(), 'tours', 't1');
    expect(stored.derived).toBeUndefined();
  });

  it('still stores every size when the hook throws', async () => {
    // The point of catching: the upload has already succeeded by then, and
    // rejecting would make the caller retry a completed upload.
    const { adapter, written } = memoryAdapter();
    const onDeriveError = vi.fn();

    const stored = await processAndStore(adapter, await pngFile(), 'tours', 't1', {
      derive: async () => {
        throw new Error('shape fitting failed');
      },
      onDeriveError,
    });

    expect(stored.derived).toBeUndefined();
    expect(written.size).toBe(4);
    for (const key of Object.values(stored.sizes)) {
      expect(written.has(key)).toBe(true);
    }
  });

  it('reports the failure through onDeriveError rather than silently', async () => {
    const { adapter } = memoryAdapter();
    const onDeriveError = vi.fn();
    const boom = new Error('shape fitting failed');

    await processAndStore(adapter, await pngFile(), 'tours', 't1', {
      derive: async () => {
        throw boom;
      },
      onDeriveError,
    });

    expect(onDeriveError).toHaveBeenCalledOnce();
    const [error, source] = onDeriveError.mock.calls[0];
    expect(error).toBe(boom);
    expect(source).toMatchObject({ mimeType: 'image/png' });
  });

  it('swallows a throwing hook even without onDeriveError', async () => {
    const { adapter } = memoryAdapter();
    await expect(
      processAndStore(adapter, await pngFile(), 'tours', 't1', {
        derive: async () => {
          throw new Error('boom');
        },
      }),
    ).resolves.toMatchObject({ derived: undefined });
  });

  it('runs the hook after the uploads, so it sees a completed store', async () => {
    const { adapter, written } = memoryAdapter();
    let sizesAtDeriveTime = -1;

    await processAndStore(adapter, await pngFile(), 'tours', 't1', {
      derive: async () => {
        sizesAtDeriveTime = written.size;
        return null;
      },
    });

    expect(sizesAtDeriveTime).toBe(4);
  });

  it('rejects an invalid file before the hook runs', async () => {
    const { adapter } = memoryAdapter();
    const derive = vi.fn();
    const bad = new File([new Uint8Array([1, 2, 3])], 'x.txt', { type: 'text/plain' });

    await expect(processAndStore(adapter, bad, 'tours', 't1', { derive })).rejects.toThrow();
    expect(derive).not.toHaveBeenCalled();
  });
});
