// Storage wiring from environment variables — server-only.
//
// Both source apps had hand-written this: read S3_*, build one lazy adapter,
// fall back (or throw) when the vars are absent. They drifted — one defaulted
// to path-style addressing for uploads while signing reads virtual-hosted, and
// each carried its own singleton. The env NAMES are the shared part; the
// defaults that differ per deployment (bucket, region, addressing) stay
// arguments.

import { createS3Adapter } from './adapter.js';
import { createLocalAdapter } from './local-adapter.js';
import type { StorageAdapter } from './types.js';

/** Anything with string values — `process.env`, or SvelteKit's `$env/dynamic/private`. */
export type EnvSource = Record<string, string | undefined>;

export interface EnvAdapterOptions {
  /** Fallback when `S3_BUCKET` is unset. */
  bucket?: string;
  /** Fallback when `S3_REGION` is unset. Default `'auto'`. */
  region?: string;
  /** Base public URL for `getUrl()` — omit for private buckets. */
  publicUrl?: string;
  /** Default true (MinIO/Garage/R2); false for Railway/AWS virtual-hosted. */
  forcePathStyle?: boolean;
}

// One adapter per distinct config, so repeated calls (every request) reuse the
// S3 client and its signed-URL cache. Keyed by the resolved config, so a
// changed env var in dev builds a new one instead of serving a stale client.
const adapters = new Map<string, StorageAdapter>();

/**
 * The storage adapter this deployment is configured for:
 *
 *   - S3 when `S3_ENDPOINT` + `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY` and a
 *     bucket (`S3_BUCKET` or `options.bucket`) are all present
 *   - local files when `MEDIA_ROOT` is set (dev machines, no bucket)
 *   - otherwise it throws, naming what is missing — a media surface that
 *     silently no-ops is worse than a boot failure.
 */
export function adapterFromEnv(env: EnvSource, options: EnvAdapterOptions = {}): StorageAdapter {
  const endpoint = env.S3_ENDPOINT;
  const accessKeyId = env.S3_ACCESS_KEY_ID;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
  const bucket = env.S3_BUCKET ?? options.bucket;

  if (endpoint && accessKeyId && secretAccessKey && bucket) {
    const config = {
      endpoint,
      region: env.S3_REGION ?? options.region ?? 'auto',
      bucket,
      accessKeyId,
      secretAccessKey,
      publicUrl: options.publicUrl,
      forcePathStyle: options.forcePathStyle,
    };
    return memo(`s3:${JSON.stringify(config)}`, () => createS3Adapter(config));
  }

  const root = env.MEDIA_ROOT;
  if (root) return memo(`local:${root}`, () => createLocalAdapter({ root }));

  const missing = [
    !endpoint && 'S3_ENDPOINT',
    !accessKeyId && 'S3_ACCESS_KEY_ID',
    !secretAccessKey && 'S3_SECRET_ACCESS_KEY',
    !bucket && 'S3_BUCKET',
  ].filter(Boolean);
  throw new Error(
    `svelte-media: no storage configured — missing ${missing.join(', ')} (or set MEDIA_ROOT for local files)`
  );
}

function memo(key: string, build: () => StorageAdapter): StorageAdapter {
  let adapter = adapters.get(key);
  if (!adapter) {
    adapter = build();
    adapters.set(key, adapter);
  }
  return adapter;
}
