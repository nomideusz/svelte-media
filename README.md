# @nomideusz/svelte-media

Image upload, resizing and multi-size storage for Svelte 5 apps. One call takes
a `File`, validates it, renders four sizes with sharp, and writes them through a
pluggable storage adapter — S3-compatible or local disk.

## Install

```bash
pnpm add @nomideusz/svelte-media
```

> Requires Svelte 5 (`^5.0.0`). The processing path is server-only: it uses
> `sharp` and Node `Buffer`. Import `processAndStore` from server code
> (`+page.server.ts`, a route handler, a script) — never from a component.

## Why

Every app that accepts images rewrites the same four steps: validate, resize to
a set of named sizes, upload each one, and hand back the keys. The variable part
is only *where* the bytes go. This package fixes the pipeline and makes storage
the seam.

## Quick Start

```ts
import { createS3Adapter, processAndStore, getMediaUrl } from '@nomideusz/svelte-media';

const storage = createS3Adapter({
  endpoint:        process.env.S3_ENDPOINT!,     // https://xxx.r2.cloudflarestorage.com
  region:          'auto',                        // 'auto' for R2, 'us-east-1' for AWS
  bucket:          process.env.S3_BUCKET!,
  accessKeyId:     process.env.S3_KEY!,
  secretAccessKey: process.env.S3_SECRET!,
  publicUrl:       process.env.S3_PUBLIC_URL!,   // https://pub-xxx.r2.dev
  forcePathStyle:  true,                          // true for MinIO/R2, false for Railway/AWS
});

const stored = await processAndStore(storage, file, 'tours', tourId);
// { filename, originalName, prefix, entityId, sizes: { original, thumbnail, medium, large } }

const src = getMediaUrl(storage, stored.prefix, stored.entityId, stored.filename, 'medium');
```

Store `stored` on your row — the helpers below all take
`(prefix, entityId, filename)`, so keep those three. Nothing in the package
touches a database.

**Output is always WebP**, whatever was uploaded; `generateMediaKey` names every
file `<cuid2>.webp` and ignores the original extension.

## Sizes

`processAndStore` always writes four variants:

| Size | Dimensions | Fit | Key prefix |
|---|---|---|---|
| `original` | unchanged | — | *(none)* |
| `thumbnail` | 300×300 | `cover` | `thumb_` |
| `medium` | 800×600 | `inside` | `med_` |
| `large` | 1200×900 | `inside` | `lg_` |

`cover` crops to fill; `inside` fits within the box and preserves aspect ratio,
so `medium` and `large` are upper bounds rather than exact dimensions. The table
is exported as `IMAGE_SIZES`.

## Storage adapters

The seam is three methods:

```ts
interface StorageAdapter {
  put(key: string, buffer: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}
```

Two ship with the package:

```ts
import { createS3Adapter, createLocalAdapter } from '@nomideusz/svelte-media';

createS3Adapter({ /* S3Config, above */ });   // R2, MinIO, Tigris, AWS
createLocalAdapter({ root: '/data/images' }); // writes under root, mkdir -p
```

Anything satisfying the interface works — write your own for a CDN or a test
double.

`createLocalAdapter`'s `getUrl` returns the storage key unchanged, so it is a
path relative to `root`, not a URL. Serve `root` yourself (a static route, or
`/uploads/[...key]`) and prefix as needed.

## Validation

```ts
import { validateImageFile } from '@nomideusz/svelte-media';

const { valid, error } = validateImageFile(file, {
  maxFileSize: 5 * 1024 * 1024,                   // default: 5 MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
});
```

`processAndStore` runs this first and throws on failure, so calling it yourself
is only needed to reject early and report a friendlier message.

## Deleting

```ts
import { deleteMedia } from '@nomideusz/svelte-media';

// Removes all four sizes; individual failures are swallowed
await deleteMedia(storage, stored.prefix, stored.entityId, stored.filename);
```

## Components

```svelte
<script lang="ts">
  import { ImageUpload, ImageGallery } from '@nomideusz/svelte-media';

  // Your endpoint calls processAndStore and returns the StoredMedia
  async function upload(file: File) {
    const body = new FormData();
    body.set('file', file);
    return await (await fetch('/api/images', { method: 'POST', body })).json();
  }
</script>

<ImageUpload onUpload={upload} maxFiles={5} onError={(m) => toast(m)} />

<ImageGallery
  images={stored}
  getUrl={(prefix, entityId, filename, size) => `/uploads/${prefix}/${entityId}/${filename}?s=${size}`}
  size="thumbnail"
  onDelete={(filename) => remove(filename)}
/>
```

`ImageUpload` handles drag-and-drop, selection and the uploading state, but the
bytes go to *your* endpoint — it never talks to storage, so credentials stay on
the server. `ImageGallery` takes a `getUrl` callback rather than an adapter for
the same reason: it renders on the client, where the adapter cannot go.

`ImageUpload` props: `onUpload` (required), `onError?`, `maxFiles = 1`,
`accept = 'image/jpeg,image/png,image/webp'`, `config?`.
`ImageGallery` props: `images`, `getUrl` (both required), `onDelete?`,
`size = 'thumbnail'`.

## API

```ts
// Adapters
createS3Adapter(config: S3Config): StorageAdapter
createLocalAdapter(config: LocalConfig): StorageAdapter

// Pipeline
processAndStore(adapter, file, prefix, entityId, config?): Promise<StoredMedia>
deleteMedia(adapter, prefix, entityId, filename): Promise<void>
getMediaUrl(adapter, prefix, entityId, filename, size = 'medium'): string
getStorageKey(prefix, entityId, filename, size): string   // `${prefix}/${entityId}/${sizePrefix}${filename}`
validateImageFile(file, config?): ValidationResult
generateMediaKey(): string                                 // `<cuid2>.webp`
IMAGE_SIZES

// Components
ImageUpload, ImageGallery
```

Types: `StorageAdapter`, `S3Config`, `LocalConfig`, `StoredMedia`, `ImageSize`,
`MediaConfig`, `ValidationResult`.

## Development

```bash
pnpm install
pnpm check           # Typecheck
pnpm test            # Vitest
pnpm run package     # Build the library
```

## License

MIT
