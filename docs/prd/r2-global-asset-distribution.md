<!-- lang:en -->
# PRD: Global Asset Distribution via Cloudflare R2 + Worker

**Component:** `Infra` · **Owner:** akkanop-x  
**Labels:** `ready-for-agent` · `Infra` · `Feature`  
**Status:** Ready for implementation

---

## Problem Statement

The NestJS Backend currently acts as a reverse proxy for all chapter images and MIT patch PNGs. Every asset request — even from users on the other side of the globe — round-trips through the Backend server, consuming bandwidth, CPU, and adding latency that degrades the reading experience. There is no CDN edge layer. As the platform scales, this single-server bottleneck becomes a cost and performance liability.

---

## Solution

Migrate all asset storage from local disk to Cloudflare R2, and place a Cloudflare Worker at the edge as the sole public-facing asset proxy. The Backend issues short-lived HMAC-signed tokens to authenticated clients at chapter-page-fetch time; the Worker verifies the signature at the edge without any DB round-trip and serves directly from R2 with long-lived `Cache-Control` headers.

---

## User Stories

1. As a reader, I want chapter images to load faster regardless of my geographic location.
2. As a reader, I want patch PNGs (translated text overlays) to appear quickly after the translation completes.
3. As a reader, I want my asset access to be seamlessly re-authorized in the background when a session token expires.
4. As a translator/creator, I want my uploaded chapter images to be stored reliably in the cloud.
5. As a translator/creator, I want the upload experience to remain identical whether in local development or production.
6. As an operator (akkanop-x), I want all asset requests to be authenticated at the edge.
7. As an operator, I want chapter images cached indefinitely at Cloudflare's edge.
8. As an operator, I want a one-shot migration script to move existing disk assets to R2.
9. As an operator, I want the Worker to return a structured error code (`ASSET_TOKEN_EXPIRED`) on token expiry.
10. As an operator, I want asset URL routing to be changed in a single configuration file (`next.config.ts`).
11. As an operator, I want patch PNGs produced by MIT to be streamed to R2 immediately after the webhook is verified.
12. As an operator, I want Supabase to eventually receive R2 key references via the existing write-behind queue.
13. As a developer, I want a `STORAGE_BACKEND=local|r2` environment variable to switch between `DiskStorageProvider` and `R2StorageProvider`.

---

## Implementation Decisions

### Modules to build or modify

**New: `R2StorageProvider`**  
A new implementation of the existing `StorageProvider` interface that streams objects to/from Cloudflare R2 via the S3-compatible API. Selected by `STORAGE_BACKEND=r2` at module init time.

**New: Cloudflare Worker (`Cloudflare-Worker/`)**  
An edge Worker that:
1. Extracts `?token=<hmac>` from the incoming asset URL.
2. Verifies the HMAC signature using `WORKER_SIGNING_SECRET`.
3. On valid token: fetches the R2 object and streams it to the client with `Cache-Control: public, max-age=31536000, immutable`.
4. On invalid/expired token: returns `403 { "code": "ASSET_TOKEN_EXPIRED" }`.

**Modified: `unlock` / `books` module (Backend)**  
The `GET /books/:id/chapters/:ch/pages` endpoint must include an `assetToken` field — a short-lived HMAC token signed with `ASSET_SIGNING_SECRET`. Token payload: `{ hwid, chapterId, exp: now + 3600s }`.

**Modified: `next.config.ts` rewrites**  
The `/uploads/*` and `/img-cache/*` rewrite destinations change from the Backend URL to the Worker URL (`WORKER_ASSET_URL` env var).

**New: Migration script (`scripts/migrate-assets-to-r2.ts`)**  
A one-shot Node.js script that reads all files from disk, streams each to R2, verifies upload integrity via ETag, updates Supabase record URL references, and logs a structured JSON report.

### R2 Object Key Convention

| Asset type | Key pattern |
|---|---|
| Chapter page | `chapters/{chapterId}/pages/{pageIndex}.jpg` |
| MIT patch PNG | `patches/{taskId}/{regionIndex}.png` |

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

All R2 objects served by the Worker carry `Cache-Control: public, max-age=31536000, immutable`.

### T4-Standard compliance

- **Pillar 4 (Worker Memory Contract):** Worker uses R2 streaming `.put()` only — never buffers the full image in Worker memory.
- **Pillar 5 (Zero-Trust Assets):** Worker verifies HWID-bound signed token on every request; direct R2 URLs are never exposed.
- **Pillar 3 (Multi-Layer Cache):** R2 key written to Redis (L2) immediately; Supabase receives it via write-behind batch.

---

## Testing Decisions

| Module | What to test |
|---|---|
| `R2StorageProvider` | `put()` streams correctly; `get()` returns same bytes; `delete()` removes object |
| Asset token signing (Backend) | Same inputs → same token; expired token fails; tampered token fails |
| Cloudflare Worker | Valid token → 200; expired token → 403 + `ASSET_TOKEN_EXPIRED`; missing token → 403 |
| Migration script | All files transferred with matching ETag; Supabase URL references updated |

---

## Out of Scope

- Payment gateway integration (Phase 2.2)
- MIT GPU cloud migration (Phase 2.4)
- 2FA / Device Session Pinning (Phase 2.5)
- Cloudflare KV-based HWID whitelist (rejected: adds sync complexity with no benefit)
- Service Worker intercept on the Frontend (rejected: unnecessary complexity)
- Presigned URL per object (rejected: requires N URLs per chapter, not 1 token)

---

## Further Notes

- `STORAGE_BACKEND=local` must be the default so existing local dev and CI require zero configuration changes.
- The migration script must be idempotent: re-running it on already-migrated files should be a no-op.
- Cloudflare Worker deployment is owned by akkanop-x; Backend and Frontend changes are owned by xeno.
<!-- lang:end -->

<!-- lang:th -->
# PRD: Global Asset Distribution ผ่าน Cloudflare R2 + Worker

**Component:** `Infra` · **Owner:** akkanop-x  
**Labels:** `ready-for-agent` · `Infra` · `Feature`  
**Status:** พร้อม implement

---

## ปัญหา

NestJS Backend ทำหน้าที่เป็น reverse proxy สำหรับ chapter images และ patch PNG ทุกชิ้น ทุก asset request — แม้จากผู้ใช้ที่อยู่อีกซีกโลก — ต้องวิ่งผ่าน Backend server ทำให้ใช้ bandwidth, CPU และเพิ่ม latency จนประสบการณ์การอ่านแย่ลง ไม่มี CDN edge layer เลย เมื่อ platform ขยายตัว bottleneck นี้กลายเป็นภาระด้านต้นทุนและประสิทธิภาพ

---

## วิธีแก้

ย้าย asset ทั้งหมดจาก local disk ไปยัง Cloudflare R2 และใช้ Cloudflare Worker เป็น edge proxy ที่หันหน้าสู่สาธารณะ Backend ออก HMAC signed token อายุสั้นให้ client ที่ยืนยันตัวตนแล้วตอน fetch chapter pages; Worker ตรวจ signature ที่ edge โดยไม่ต้องติดต่อ DB แล้ว serve ตรงจาก R2 พร้อม Cache-Control headers อายุยาว

---

## User Stories

1. ผู้อ่าน — ต้องการ chapter image โหลดเร็วขึ้นไม่ว่าจะอยู่ที่ไหนในโลก
2. ผู้อ่าน — ต้องการ patch PNG ปรากฏเร็วหลัง translation เสร็จ
3. ผู้อ่าน — ต้องการ asset ถูก re-authorize ในเบื้องหลังอัตโนมัติเมื่อ token หมดอายุ
4. Translator/Creator — ต้องการ chapter image เก็บบน cloud อย่างน่าเชื่อถือ
5. Translator/Creator — ต้องการประสบการณ์ upload เหมือนกันทั้งใน local dev และ production
6. Operator (akkanop-x) — ต้องการ asset request ทุกคำขอผ่านการ authenticate ที่ edge
7. Operator — ต้องการ chapter image cache ไว้ที่ Cloudflare edge ไม่มีกำหนด
8. Operator — ต้องการ migration script แบบ one-shot สำหรับย้าย asset ที่มีอยู่ไป R2
9. Operator — ต้องการ Worker คืน error code โครงสร้าง (`ASSET_TOKEN_EXPIRED`) เมื่อ token หมดอายุ
10. Operator — ต้องการเปลี่ยน asset URL routing ในไฟล์ config เดียว (`next.config.ts`)
11. Operator — ต้องการ patch PNG ที่ MIT ผลิตถูก stream ขึ้น R2 ทันทีหลัง webhook ผ่านการ verify
12. Operator — ต้องการ Supabase รับ R2 key reference ผ่าน write-behind queue ที่มีอยู่
13. Developer — ต้องการ env var `STORAGE_BACKEND=local|r2` สลับระหว่าง `DiskStorageProvider` และ `R2StorageProvider`

---

## Convention สำหรับ R2 Object Key

| ประเภท Asset | รูปแบบ Key |
|---|---|
| Chapter page | `chapters/{chapterId}/pages/{pageIndex}.jpg` |
| MIT patch PNG | `patches/{taskId}/{regionIndex}.png` |

---

## จุดเด่นของ design

- `StorageProvider` interface เดิมรองรับ swap local ↔ R2 ด้วย env var เดียว
- Token ออกจาก Backend ตอน fetch chapter pages อัตโนมัติ — ไม่มี refresh endpoint แยก
- `next.config.ts` rewrites จุดเดียว Frontend code ไม่ต้องแตะ
- Migration script one-shot พร้อม checksum verify
- MIT patch PNG ไหลผ่าน Backend webhook เดิม เพียงแต่ stream ขึ้น R2 แทน disk
- Supabase รับ R2 key reference ผ่าน write-behind queue ตามปกติ (L4 authority ไม่เปลี่ยน)

---

## นอกขอบเขต

- Payment gateway integration (Phase 2.2 — PRD แยก)
- MIT GPU cloud migration (Phase 2.4 — PRD แยก)
- 2FA / Device Session Pinning (Phase 2.5 — PRD แยก)
- Cloudflare KV-based HWID whitelist (ปฏิเสธ: เพิ่มความซับซ้อนโดยไม่มีประโยชน์)
- Service Worker intercept บน Frontend (ปฏิเสธ: ซับซ้อนเกินความจำเป็น)
- Presigned URL ต่อ object (ปฏิเสธ: ต้องการ N URLs ต่อ chapter ไม่ใช่ 1 token)
<!-- lang:end -->
