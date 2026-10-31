# Changelog

## 1.0.1

### Patch Changes

- Dependencies: `sharp` 0.34 → 0.35 (no removed API is used), `@paralleldrive/cuid2` 2 → 3 (same `createId`), `@aws-sdk/*` 3.1079 → 3.1161. No API change.

## 1.0.0

### Major Changes

- 1.0.0 — the promise, sized to the proven surface. Two production apps
  consume the validation, media store, env adapters, storage keys,
  remote-image fetching and serving daily; 53 tests cover them; that API is
  now stable, and anything that breaks a consumer costs a major.
  
  **Breaking: `ImageUpload` and `ImageGallery` leave the public API.** In two
  consuming apps neither was ever rendered, and this package's own changelog
  records that surface shipping broken twice precisely because nothing
  consumed it (a `config` prop that was never read; a build failure nobody
  hit). A 1.0 must not promise stability on components without a single real
  consumer. The files remain in-repo for the demo; if an app one day wants
  them, re-exporting is an additive minor made against a component that
  consumer actually exercises.

## 0.6.0 — 2026-08-14

Second pass of the same job 0.5.0 started: the parts of "handling images" both
apps still owned move here, so an app keeps only what is actually its own —
bucket names, copy, and (for yoga) what a Google Places reference costs.

### Added
- **`adapterFromEnv(env, options?)`** — the S3_*/`MEDIA_ROOT` wiring both apps
  had hand-written, including the lazy singleton each carried. Reads
  `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` /
  `S3_SECRET_ACCESS_KEY`, falls back to a local adapter on `MEDIA_ROOT`, and
  otherwise throws naming what is missing — a media surface that silently
  no-ops is worse than a boot failure. Memoized per resolved config, so
  per-request calls reuse one client and its signed-URL cache. Takes any
  `Record<string, string | undefined>`, so no `$env` import enters the package.
- **`cachedImage(adapter, key, produce, options?)`** and
  **`store.cached(...)`** — bucket-as-cache in front of a remote image source.
  Stored copy first (the producer is never called on a hit), one producer call
  per stampede, immutable headers, `onStoreError` for the write that would
  otherwise silently make you pay twice. Extracted from yoga's Google Places
  hero proxy, which had grown all of it inline.
- **`fetchImage(url, options?)`** — GET an image from a remote URL, rejecting
  failed and non-image responses (an error page's HTML must never land in the
  cache as a photo), transcoded to WebP by default.
- **`toWebp(bytes, quality?)`** — the transcode on its own; returns the input
  untouched when sharp cannot read it, because an optimisation must never lose
  an image you already hold.
- **`store.resolveUrl(key, size?, expiresIn?)`** + `basePath` on
  `MediaStoreConfig` — presigned when the adapter can sign, else
  `basePath/<variant key>` for the same-origin route. thebest had this fallback
  written by hand across two modules.
- **`DeriveSource` gains `prefix` and `entityId`** (additive), so a `derive`
  hook and its `onDeriveError` can name the entity they failed on. yoga was
  closing over the id to log it.

### Fixed
- **`getStorageKey` rejects filenames containing `/`, `\\` or `..`.** Filenames
  are generated, but they round-trip through DB rows and form fields before
  coming back to be deleted — thebest's delete action passes one straight from
  `formData`, so a crafted value reached outside the entity's own folder.
  `serveMedia` already guarded the read path; this is the write/delete one.

### Changed
- `ImageBytes.body` is `Uint8Array<ArrayBuffer>` — the concrete view `Response`
  and `Blob` accept.
- README caught up with 0.5.0: `get()` on the adapter interface, `serveMedia`,
  `createMediaStore`, `getSignedUrl`.

### Adopted by the apps
- yoga: `photo-storage.ts` is now bucket names + Polish copy + the placeholder
  hook (−40 lines); `/api/photo` keeps the Google policy (budget guard, ref
  self-heal, negative caches) and nothing else (−60 lines, no more sharp, no
  more hand-rolled in-flight map).
- thebest: `media.ts` + `image-urls.ts` lost the adapter singleton, the
  presign-or-fallback branch and the split-brain addressing; the tour upload
  action no longer re-states the 15 MB limit it shares with `MEDIA_CONFIG`.

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
