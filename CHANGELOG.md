# Changelog

Backfilled 2026-08-02 from git history. Entries before that date are
reconstructed from commits, so they record what changed rather than a release
that was tagged at the time. The package has not been published to npm yet.

## Unreleased

### Added
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
