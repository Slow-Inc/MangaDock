# ADR 016 — Upload path validates MIME by magic bytes, not the client Content-Type

- **Status:** Accepted (2026-06-17) — implemented. Live in `Backend/src/upload/upload.service.ts`
  (`addPage`) with `upload.controller.ts` keeping the client-mime `fileFilter` as a cheap first gate.
- **Context:** #303 (bug, surfaced by #296 while writing the magic-byte tests) · parent #292 ·
  complements [[012-mit-integration-security-boundary]] (the upload route is HWID-gated) and mirrors
  the forum upload control.
- **Scope:** chapter-page uploads (`POST /upload/versions/:versionId/pages`). Forum
  banner/avatar/post uploads already validate by magic bytes (`forum.service.ts`); this aligns the
  upload module with that posture.

## Context

`CLAUDE.md` documents the `upload` module as *"Image uploads — MIME validated with `file-type`
(magic bytes, not extension)."* In reality the chapter-page upload path validated **only the
client-supplied Content-Type**, on two layers that both trust attacker-controlled input:

1. `upload.controller.ts` — Multer's `fileFilter` checks `file.mimetype` against an allowlist. With
   `diskStorage`, Multer sets `file.mimetype` from the multipart part's `Content-Type` header, which
   the client controls.
2. `upload.service.ts:addPage` — re-checked the same client `mimeType` argument against
   `ALLOWED_MIME_TYPES` and never read the file bytes.

**Impact:** a disguised payload (e.g. `<script>…</script>`) sent with `Content-Type: image/png`
passed both gates and was stored with a `.png` extension and `contentType: image/png`. Direct-nav
HTML execution is partially mitigated because assets are later served with a forced `image/*`
content-type, but the defense-in-depth control the docs promised was absent. The correct pattern
already existed and was tested in `forum.service.ts` (`fileTypeFromFile`), so this was a divergence,
not a missing capability.

## Decision

Make the **authoritative** MIME decision magic-byte based, inside the service, and derive the stored
extension from the **detected** type — mirroring `forum.service.uploadImage`/`uploadBanner`.

- `addPage` runs `await fileTypeFromFile(tempFilePath)` and rejects (`BadRequestException`) when the
  detector returns nothing (empty / truncated / undetectable) or a mime outside
  `ALLOWED_MIME_TYPES` (`image/jpeg|png|webp|gif`) — **even when the filename/extension/client mime
  says image**. The temp file is unlinked on every reject path (the existing unlink).
- The stored filename extension comes from `MIME_TO_EXT[detected.mime]`, not the client value, so a
  client lying `image/png` over WebP bytes is stored `.webp`.
- The client `mimeType` argument is **removed** from `addPage` (it was load-bearing for nothing once
  the gate is magic-byte based); the controller no longer threads `file.mimetype` into the service.
- The controller `fileFilter` is **kept** as a cheap, early rejection on the client Content-Type, but
  it is explicitly not the security boundary.

## Alternatives considered

- **Trust the client Content-Type (status quo)** — rejected; that is the bug. The multipart
  `Content-Type` is attacker-controlled.
- **Validate magic bytes in the controller `fileFilter`** — rejected. `fileFilter` runs as the file
  streams in and only sees the declared mimetype, not the written bytes; reading magic bytes belongs
  after the temp file exists on disk, which is where `addPage` already operates.
- **Keep `_clientMime` as a documented-unused param (as forum does)** — rejected for the upload path;
  the repo lint flags unused args, and a cleaner 3-arg signature is unambiguous. The controller
  comment records that `fileFilter` is the cheap gate and `addPage` is authoritative.
- **A shared upload-validation helper across forum + upload** — deferred. Worth doing (DRY across the
  two magic-byte sites) but out of scope for a security bugfix; tracked as a follow-up, not blocking.

## Consequences

- **Positive:** a disguised file is rejected before it reaches storage on the chapter-page path;
  the stored extension/contentType reflect the real bytes; `CLAUDE.md`'s documented control is now
  true for this module; the upload and forum paths share one validation posture.
- **Negative / limits:** `fileTypeFromFile` reads the file from disk (one extra read per upload —
  negligible vs the network upload itself). `file-type` is ESM-only, so tests rely on the existing
  manual mock (`src/__mocks__/file-type.js` via `moduleNameMapper`) — the same mechanism forum tests
  already use.
- **Follow-up:** factor a single magic-byte upload-guard helper shared by `forum.service` and
  `upload.service` so the allowlist + extension map live in one place.
