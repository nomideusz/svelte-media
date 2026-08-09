import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as presignGetObject } from '@aws-sdk/s3-request-presigner';
import type { S3Adapter, S3Config } from './types.js';

// Refresh signed URLs a minute before they actually expire, so a URL handed to
// a browser never dies mid-request.
const SIGNED_TTL_BUFFER_MS = 60_000;

export function createS3Adapter(config: S3Config): S3Adapter {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle ?? true,
  });

  // ponytail: unbounded caches — media keys are a finite catalog; add LRU if that changes.
  const signedCache = new Map<string, { url: string; expiresAt: number }>();
  const signedInflight = new Map<string, Promise<string>>();

  return {
    async put(key, buffer, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          // Keys are unique per upload, so objects never change in place.
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );
    },

    async get(key) {
      let res;
      try {
        res = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
      } catch (e) {
        const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
        if (err.name === 'NoSuchKey' || err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
          return null;
        }
        throw e;
      }
      const body = res.Body?.transformToWebStream();
      if (!body) return null;
      return {
        body,
        contentType: res.ContentType ?? 'application/octet-stream',
        contentLength: res.ContentLength ?? null,
      };
    },

    async delete(key) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: key,
        })
      );
    },

    getUrl(key) {
      if (!config.publicUrl) {
        throw new Error(
          'publicUrl not configured — serve private buckets via get() or getSignedUrl()'
        );
      }
      return `${config.publicUrl.replace(/\/$/, '')}/${key}`;
    },

    async getSignedUrl(key, expiresIn = 3600) {
      const cacheKey = `${expiresIn}:${key}`;
      const cached = signedCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.url;
      if (cached) signedCache.delete(cacheKey);

      const inflight = signedInflight.get(cacheKey);
      if (inflight) return inflight;

      const signing = presignGetObject(
        client,
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        { expiresIn }
      )
        .then((url) => {
          signedCache.set(cacheKey, {
            url,
            expiresAt: Date.now() + Math.max(expiresIn * 1000 - SIGNED_TTL_BUFFER_MS, 1_000),
          });
          return url;
        })
        .finally(() => {
          signedInflight.delete(cacheKey);
        });

      signedInflight.set(cacheKey, signing);
      return signing;
    },
  };
}
