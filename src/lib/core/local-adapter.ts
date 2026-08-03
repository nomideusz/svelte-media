import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { StorageAdapter } from './types.js';

export interface LocalConfig {
  /** Absolute path to the storage root directory, e.g. '/data/images' */
  root: string;
}

export function createLocalAdapter(config: LocalConfig): StorageAdapter {
  return {
    async put(key, buffer, contentType) {
      const filePath = join(config.root, key);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, buffer);
    },

    async delete(key) {
      await unlink(join(config.root, key)).catch(() => {});
    },

    getUrl(key) {
      return key;
    },
  };
}
