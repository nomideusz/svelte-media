import { describe, it, expect } from 'vitest';
import { adapterFromEnv } from './env.js';

const S3_ENV = {
  S3_ENDPOINT: 'https://s3.example',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
  S3_BUCKET: 'photos',
};

describe('adapterFromEnv', () => {
  it('reuses one adapter per config, so the signed-URL cache survives requests', () => {
    expect(adapterFromEnv(S3_ENV)).toBe(adapterFromEnv(S3_ENV));
    expect(adapterFromEnv(S3_ENV)).not.toBe(adapterFromEnv({ ...S3_ENV, S3_BUCKET: 'other' }));
  });

  it('takes the bucket and region from env over the defaults', () => {
    const adapter = adapterFromEnv({ ...S3_ENV, S3_REGION: 'garage' }, { bucket: 'fallback' });
    expect(adapter.getUrl).toBeTypeOf('function');
    // publicUrl unset → getUrl must refuse rather than invent a host.
    expect(() => adapter.getUrl('a/b/c.webp')).toThrow();
  });

  it('serves from disk when only MEDIA_ROOT is set', () => {
    expect(adapterFromEnv({ MEDIA_ROOT: '/tmp/media' }).getUrl('a/b/c.webp')).toBe('a/b/c.webp');
  });

  it('names what is missing instead of silently no-opping', () => {
    expect(() => adapterFromEnv({ S3_ENDPOINT: 'https://s3.example' })).toThrow(
      /S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET/
    );
  });
});
