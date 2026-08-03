# Changelog

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
