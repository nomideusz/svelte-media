import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import type { StorageAdapter } from './types.js';

export interface LocalConfig {
  /** Absolute path to the storage root directory, e.g. '/data/images' */
  root: string;
}

const MIME_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export function createLocalAdapter(config: LocalConfig): StorageAdapter {
  return {
    async put(key, buffer, contentType) {
      const filePath = join(config.root, key);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, buffer);
    },

    async get(key) {
      let buffer: Buffer;
      try {
        buffer = await readFile(join(config.root, key));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw e;
      }
      return {
        body: new Blob([new Uint8Array(buffer)]).stream(),
        contentType: MIME_BY_EXT[extname(key).toLowerCase()] ?? 'application/octet-stream',
        contentLength: buffer.length,
      };
    },

    async delete(key) {
      await unlink(join(config.root, key)).catch(() => {});
    },

    getUrl(key) {
      return key;
    },
  };
}
