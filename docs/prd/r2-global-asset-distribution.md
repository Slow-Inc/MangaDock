# PRD: Global Asset Distribution via Cloudflare R2 + Worker

**Component:** `Infra` · **Owner:** akkanop-x  
**Labels:** `ready-for-agent` · `Infra` · `Feature`  
**Status:** Ready for implementation

---

## Problem Statement

The NestJS Backend currently acts as a reverse proxy for all chapter images and MIT patch PNGs. Every asset request — even from users on the other side of the globe — round-trips through the Backend server, consuming bandwidth, CPU, and adding latency that degrades the reading experience. There is no CDN edge layer. As the platform scales, this single-server bottleneck becomes a cost and performance liability.

**สิ่งที่เป็นปัญหา:** NestJS Backend เป็น reverse proxy สำหรับ chapter images และ patch PNGs ทุก request ต้องวิ่งผ่าน Backend server เสมอ ไม่มี CDN edge layer ทำให้ bandwidth cost สูง latency สูงสำหรับผู้ใช้ที่อยู่ไกล และ Backend เป็น single point of bottleneck เมื่อ traffic เพิ่มขึ้น

---

## Solution

Migrate all asset storage from local disk to Cloudflare R2, and place a Cloudflare Worker at the edge as the sole public-facing asset proxy. The Backend issues short-lived HMAC-signed tokens to authenticated clients at chapter-page-fetch time; the Worker verifies the signature at the edge without any DB round-trip and serves directly from R2 with long-lived `Cache-Control` headers.

**แนวทางแก้ไข:** ย้าย asset ทั้งหมดไปเก็บที่ Cloudflare R2 และใช้ Cloudflare Worker เป็น edge proxy แทน Backend Backend ออก HMAC signed token ให้ client ตอน fetch chapter pages Worker verify signature ที่ edge โดยไม่ต้องติดต่อ DB แล้ว serve ตรงจาก R2 พร้อม long-lived cache headers

---

## User Stories

1. As a reader, I want chapter images to load faster regardless of my geographic location, so that I can enjoy a smooth reading experience without waiting for images to appear.
2. As a reader, I want patch PNGs (translated text overlays) to appear quickly after the translation completes, so that I can read translated manga without additional delay.
3. As a reader, I want my asset access to be seamlessly re-authorized in the background when a session token expires, so that images never suddenly stop loading mid-chapter.
4. As a translator/creator, I want my uploaded chapter images to be stored reliably in the cloud, so that they are available globally without depending on a single server's disk.
5. As a translator/creator, I want the upload experience to remain identical whether I am in local development or production, so that I can test my uploads without a Cloudflare account.
6. As an operator (akkanop-x), I want all asset requests to be authenticated at the edge, so that unauthorized users cannot access chapter images even if they guess the R2 object key pattern.
7. As an operator, I want chapter images cached indefinitely at Cloudflare's edge, so that repeated requests for popular chapters cost near-zero bandwidth.
8. As an operator, I want a one-shot migration script to move existing disk assets to R2, so that the cutover can happen without service interruption and with checksum verification.
9. As an operator, I want the Worker to return a structured error code (`ASSET_TOKEN_EXPIRED`) on token expiry, so that the Frontend can silently re-fetch a fresh token and retry without user-visible errors.
10. As an operator, I want asset URL routing to be changed in a single configuration file (`next.config.ts`), so that Frontend component code requires no changes during the migration.
11. As an operator, I want patch PNGs produced by MIT to be streamed to R2 immediately after the webhook is verified, so that the translated content is available at the edge as soon as the AI pipeline completes.
12. As an operator, I want Supabase to eventually receive R2 key references via the existing write-behind queue, so that the long-term authority record is consistent with what is served from the edge.
13. As a developer, I want a `STORAGE_BACKEND=local|r2` environment variable to switch between `DiskStorageProvider` and `R2StorageProvider`, so that local development and CI work without a Cloudflare account.

---

## Implementation Decisions

### Modules to build or modify

**New: `R2StorageProvider`**  
A new implementation of the existing `StorageProvider` interface that streams objects to/from Cloudflare R2 via the S3-compatible API. Selected by `STORAGE_BACKEND=r2` at module init time. No changes to `upload`, `books`, or `MIT` webhook modules — they depend on the `StorageProvider` token and remain unaware of the underlying backend.

**New: Cloudflare Worker (`Cloudflare-Worker/`)**  
An edge Worker that:
1. Extracts `?token=<hmac>` from the incoming asset URL.
2. Verifies the HMAC signature using `WORKER_SIGNING_SECRET` (Wrangler secret — never exposed to client).
3. On valid token: fetches the R2 object and streams it to the client with `Cache-Control: public, max-age=31536000, immutable`.
4. On invalid/expired token: returns `403 { "code": "ASSET_TOKEN_EXPIRED" }`.

**Modified: `unlock` / `books` module (Backend)**  
The `GET /books/:id/chapters/:ch/pages` endpoint must include an `assetToken` field in its response — a short-lived HMAC token signed with `ASSET_SIGNING_SECRET` (Backend env var, same value as `WORKER_SIGNING_SECRET`). Token payload: `{ hwid, chapterId, exp: now + 3600s }`.

**Modified: `next.config.ts` rewrites**  
The `/uploads/*` and `/img-cache/*` rewrite destinations change from the Backend URL to the Worker URL (`WORKER_ASSET_URL` env var). No other Frontend file changes.

**New: Migration script (`scripts/migrate-assets-to-r2.ts`)**  
A one-shot Node.js script that:
1. Reads all files from the current disk storage path.
2. Streams each file to R2 using the S3-compatible API.
3. Verifies upload integrity via ETag / content-length.
4. Updates the Supabase record URL references to point to the new R2 key pattern.
5. Logs a structured JSON report: `{ key, status, durationMs }` for every file.

### R2 Object Key Convention

| Asset type | Key pattern |
|---|---|
| Chapter page | `chapters/{chapterId}/pages/{pageIndex}.jpg` |
| MIT patch PNG | `patches/{taskId}/{regionIndex}.png` |

Direct R2 URLs are never exposed to the client — the Worker is the only public entry point.

### Patch PNG write path

`MIT webhook → Backend (HMAC verify) → R2StorageProvider.put(stream) → Redis (store R2 key) → pub/sub → SSE → Frontend`

The R2 key is stored in Redis in place of the binary data that was previously cached. The existing write-behind queue flushes the key reference to Supabase asynchronously — Supabase remains the long-term authority per T4 Pillar 3.

### Asset token flow

```
GET /chapters/:ch/pages
  → Backend validates HWID + unlock record
  → returns { pages: [...], assetToken: "<hmac(hwid|chapterId|exp)>" }

Frontend appends ?token=<assetToken> to every image src URL.

Worker receives request:
  → verify HMAC with WORKER_SIGNING_SECRET
  → valid: stream R2 object, Cache-Control: immutable
  → invalid: 403 { code: "ASSET_TOKEN_EXPIRED" }

Frontend on 403:
  → re-fetch GET /chapters/:ch/pages (gets fresh token)
  → retry image load
```

### Cache-Control

All R2 objects served by the Worker carry `Cache-Control: public, max-age=31536000, immutable`. Content never mutates at a given key; invalidation is achieved by changing the key (e.g. appending `_v2`), not by cache purge.

### T4-Standard compliance

- **Pillar 4 (Worker Memory Contract):** Worker uses R2 streaming `.put()` only — never buffers the full image in Worker memory.
- **Pillar 5 (Zero-Trust Assets):** Worker verifies HWID-bound signed token on every request; direct R2 URLs are never exposed.
- **Pillar 3 (Multi-Layer Cache):** R2 key written to Redis (L2) immediately; Supabase receives it via write-behind batch (L4 authority). Unchanged.

---

## Testing Decisions

**What makes a good test here:** test the external contract of each deep module — what goes in, what comes out — not the internal implementation. Do not mock `StorageProvider` itself in `R2StorageProvider` unit tests; test against a real R2 bucket in a staging environment or a local R2-compatible emulator (Miniflare).

**Modules to test:**

| Module | What to test |
|---|---|
| `R2StorageProvider` | `put()` streams correctly; `get()` returns same bytes; `delete()` removes object; `exists()` returns accurate result before/after put |
| Asset token signing (Backend) | Given same `hwid + chapterId + exp`, produces same token; expired token fails verification; tampered token fails |
| Cloudflare Worker | Valid token → 200 + correct body; expired token → 403 + `ASSET_TOKEN_EXPIRED`; missing token → 403; wrong secret → 403 |
| Migration script | All files transferred with matching ETag; Supabase URL references updated; structured log emitted per file |

**Prior art:** `Backend/src/books/books.service.spec.ts` for the Backend token signing unit tests (same HMAC pattern as existing webhook verification in `server/webhook.py`).

---

## Out of Scope

- Payment gateway integration (Phase 2.2 — separate PRD)
- MIT GPU cloud migration (Phase 2.4 — separate PRD)
- 2FA / Device Session Pinning (Phase 2.5 — separate PRD)
- Cloudflare KV-based HWID whitelist (rejected in design: adds sync complexity with no benefit over signed tokens)
- Service Worker intercept on the Frontend (rejected: unnecessary complexity)
- Presigned URL per object (rejected: requires N URLs per chapter, not 1 token)

---

## Further Notes

- `STORAGE_BACKEND=local` must be the default so existing local dev and CI environments require zero configuration changes.
- The migration script must be idempotent: re-running it on already-migrated files should be a no-op (check `exists()` before `put()`).
- Cloudflare Worker deployment is owned by akkanop-x; Backend and Frontend changes are owned by xeno.
- The docs interactive simulator at `hayateotsu.space/docs` already models the "☁ R2 HIT" translate scenario — implementation must match that flow exactly.

---

## สรุปภาษาไทย

**ปัญหา:** Backend เป็น bottleneck สำหรับ asset ทุกชิ้น ไม่มี CDN edge ทำให้ช้าและแพง

**แนวทาง:** ย้าย asset ทั้งหมดไป Cloudflare R2 + Cloudflare Worker เป็น edge proxy ตรวจ HMAC signed token ก่อน serve

**จุดเด่นของ design:**
- `StorageProvider` interface เดิมรองรับ swap local ↔ R2 ด้วย env var เดียว
- Token ออกจาก Backend ตอน fetch chapter pages อัตโนมัติ — ไม่มี refresh endpoint แยก
- `next.config.ts` rewrites จุดเดียว Frontend code ไม่ต้องแตะ
- Migration script one-shot พร้อม checksum verify
- MIT patch PNG ไหลผ่าน Backend webhook เดิม เพียงแต่ stream ขึ้น R2 แทน disk
- Supabase รับ R2 key reference ผ่าน write-behind queue ตามปกติ (L4 authority ไม่เปลี่ยน)
