# Changelog

## 0.5.0 — 2026-08-09

### Added
- **The read half of the pipeline.** `StorageAdapter` gains
  `get(key): Promise<StorageObject | null>` (null = not found; real failures
  reject), implemented by both adapters. Every deployment of this package was
  serving from a private bucket, and both source apps had built parallel raw
  S3 clients — three across the two apps — to work around the adapter being
  write-only.
- **`getSignedUrl(key, expiresIn?)` on the S3 adapter** (the `S3Adapter`
  type), with expiry-buffered caching and in-flight dedupe — absorbed from
  thebest's hand-rolled presign layer. This is what the previously-dead
  `@aws-sdk/s3-request-presigner` dependency is now for.
- **`serveMedia(adapter, key): Promise<Response>`** — the whole body of a
  same-origin `/photos/[...key]`-style route: key validation (incl. `..`
  traversal — one app's hand-written copy lacked the check), 404 on missing,
  immutable cache headers.
- **`createMediaStore({ adapter, ...limits, derive? })`** — the per-app
  binding factory both apps had hand-built (`photo-storage.ts`, `media.ts`),
  returning bound `store/remove/get/serve/url/signedUrl/validate`. Env reading
  stays in the app; the adapter is the seam.

### Changed
- **Breaking for external adapter implementations:** `get` is now a required
  `StorageAdapter` method. (Both in-repo apps consume the built-in adapters.)
- `S3Config.publicUrl` is now optional — both real deployments serve private
  buckets and were passing dummy values to satisfy the field. `getUrl()`
  throws without it.

## 0.4.0 — 2026-08-09

### Added
- **`SIZE_PREFIXES` and `SIZE_QUALITY` are now exported** (root and `/server`).
  Both source apps had re-copied the prefix table by hand (one script copied the
  quality values too) because the package kept them private — and the README had
  already drifted from the code once (`lg_` vs `large_`). The variant naming is a
  cross-app contract; now it has one home.
- **Joined-key helpers** for apps that persist the single original key rather
  than the (prefix, entityId, filename) triple: `variantKey(key, size)`,
  `parseStorageKey(key)` (null for keys that don't fit the layout, e.g. legacy
  ids), and `deleteMediaByKey(adapter, key)` on `/server`. Also
  `sizeForWidth(width?)` — the smallest pre-generated variant that still fills a
  display width (moved in from yoga's hand-rolled copy).
- **Machine-readable validation.** `ValidationResult` gains
  `code: 'empty' | 'file-too-large' | 'invalid-type'` plus `maxBytes` /
  `allowedTypes`, and `processAndStore` now throws a typed
  `MediaValidationError` carrying them — so a PL/EN/UK app maps `code` to its
  own copy instead of surfacing the English `message`. Both apps had
  re-implemented validation in 4 places purely to localize the strings.
  The `empty` code also covers the zero-byte file every form action was
  checking by hand.

### Fixed
- `ImageUpload`'s declared `config` prop was never read, so the client-side
  pre-validation it implied never ran. It now validates each file before
  `onUpload` and routes failures to `onError`.
- README documented the large-variant prefix as `lg_`; the code writes
  `large_`.

### Changed
- `generateMediaKey()` no longer takes the ignored `originalName` parameter.
- The dead duplicate `DEFAULT_MAX_SIZE`/`DEFAULT_ALLOWED_TYPES` constants and
  the unused `MediaValidation`/`MediaValidationOk` types in `core/types.ts` are
  gone. (`MediaValidationError` is now the thrown error class instead of an
  unused interface — technically a change to `/server`'s type surface.)

## 0.3.0 — 2026-08-03

### Added
- **`derive` / `onDeriveError` on `MediaConfig`, and `derived` on `StoredMedia`.**
  A hook over the decoded bytes during processing, so anything computed from the
  image — placeholder, blurhash, dominant colour, EXIF — happens while the bytes
  are in memory rather than fetching them back later. `TDerived` is inferred from
  the callback, so the package takes no dependency on what you derive.

  The hook runs after every size is stored, and failures deliberately do not
  propagate: by then the upload has succeeded, and rejecting would make the
  caller retry a completed upload and orphan the objects already written.
  `derived` is left undefined and `onDeriveError` is called.


## 0.2.0 — 2026-08-03

### Changed
- **Breaking: the package is split into two entry points.** Storage adapters,
  `processAndStore`, `deleteMedia` and `getMediaUrl` move to
  `@nomideusz/svelte-media/server`; components, `validateImageFile`, the key
  helpers, `IMAGE_SIZES` and the types stay on the root import.

  Everything was previously behind one entry, and `core/process.ts` imported
  `sharp` while `core/local-adapter.ts` imported `node:fs` and `node:path` at
  module level. Any browser bundle that touched the package pulled those in and
  failed to build — which means `ImageUpload` and `ImageGallery`, the two
  exports that exist to be used from a component, could not be. The bug went
  unnoticed because both apps in the source monorepo import only from server
  files.

  Migration: append `/server` to imports of the adapters or the pipeline. Key
  helpers are re-exported from `/server` too, so a server file still needs one
  import.

### Added
- A real demo at https://svelte-media-gamma.vercel.app/ — the components running
  live, `validateImageFile` against files you choose, and the storage-key layout
  for a prefix and entity you type. The server pipeline is shown as code, since
  it cannot run in a browser.


Backfilled 2026-08-02 from git history. Entries before that date are
reconstructed from commits, so they record what changed rather than a release
that was tagged at the time. 0.1.0 was published manually — trusted publishing
cannot bootstrap a package that does not exist yet — and releases from 0.1.1 on
go through the repo's Release & Publish workflow.

## 0.1.1 — 2026-08-03

### Added
- Demo site at https://svelte-media-gamma.vercel.app/; `homepage` points at it.
- README — the package's first, documenting the adapter seam, the four sizes,
  the `(prefix, entityId, filename)` key shape the helpers take, and the fact
  that all output is WebP regardless of what was uploaded.
- `sideEffects: false`, so consumers can tree-shake.

## 0.1.1 — 2026-07-07

### Fixed
- Ship TypeScript-free `.svelte` files (vitePreprocess script pass), so
  consumers without a TS setup can use the components.

## 0.1.0 — 2026-04-01

### Added
- S3-compatible storage adapter (`createS3Adapter`) — R2, MinIO, Tigris, AWS —
  replacing an earlier imgproxy + local-filesystem arrangement.
- Local disk adapter (`createLocalAdapter`).
- `processAndStore`: validate, resize to thumbnail/medium/large with sharp, and
  write every size through the adapter.
- `ImageUpload` and `ImageGallery` components.

### Note
Presigned URLs are used for S3 reads, since Railway/Tigris buckets are
private-only.
