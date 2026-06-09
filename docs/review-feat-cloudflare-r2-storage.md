# Review — feat/cloudflare-r2-storage

**Branch:** `feat/cloudflare-r2-storage`  
**Commit:** `0e91bb4`  
**Date:** 2026-06-09  
**Author:** akkanop-x + Claude Sonnet 4.6

---

## สรุปภาพรวม

Branch นี้ implement การย้าย image storage จาก disk บน server ไปยัง **Cloudflare R2** ผ่าน **Cloudflare Worker** รวมถึงการ refactor ฝั่ง Frontend สำหรับ forum categories และ browser actions ให้เป็น module แยกพร้อม unit tests

---

## สิ่งที่ทำใน commit นี้

### 1. Cloudflare R2 Storage — Phase A+B+C-B

**ปัญหาเดิม:** รูปภาพทั้งหมดเก็บบน disk (NestJS `DiskStorageProvider`) — ไม่มี CDN, latency สูง, disk โตไม่จำกัด, single point of failure

**สิ่งที่ทำ:**

#### Phase A — Worker deploy
- `Cloudflare-Worker/wrangler.toml` — fix `bucket_name = "mangadock-assets"`, `name = "mangadock-worker"`
- Worker deploy ที่ `https://mangadock-worker.akkanop2549.workers.dev`
- Secrets: `BACKEND_SHARED_SECRET`, `MIT_PROCESS_URL`, `IMAGE_QUALITY_PROFILE`
- Endpoints verified: `/health`, `/v1/exists`, `/v1/object`, `/v1/translate`

#### Phase B — CloudflareR2StorageProvider
- `Cloudflare-Worker/src/index.ts` — เพิ่ม `handleList()` + route `GET /v1/list` (prefix/recursive, delimiter="/" mirror `readdir` semantics)
- `Backend/src/common/env.validation.ts` — เพิ่ม `WORKER_URL`, `WORKER_SECRET` (optional)
- `Backend/src/common/storage/cloudflare-r2.provider.ts` (**ใหม่**) — `CloudflareR2StorageProvider` implements `StorageProvider` (put/get/delete/deleteDir/exists/list → Worker API)
- `Backend/src/common/storage/storage.module.ts` — factory switch: ถ้า `WORKER_URL`+`WORKER_SECRET` set → R2 provider, ไม่งั้น = disk (feature flag)

#### Phase C-B — Worker translate-patches + Backend routing
- `Cloudflare-Worker/src/index.ts` — เพิ่ม `handleTranslatePatches()` (R2 cache check → MIT → store PNGs + metadata JSON → return patches), route `POST /v1/translate-patches`
- `Backend/src/books/patches.controller.ts` (**ใหม่**) — `GET /r2-patches/*` → stream PNG จาก storage
- `Backend/src/books/books.module.ts` — register `PatchesController`
- `Backend/src/books/books.service.ts` — `translateMangaPagePatches()`: Worker branch (ถ้า `WORKER_URL` set → POST `/v1/translate-patches` → map r2Key → URL → Redis cache); fallback = MIT direct

---

### 2. Frontend — Forum Categories Module

**ไฟล์ใหม่:**
- `Frontend/app/lib/forumCategories.ts` — `availableCategories(role)` + `isRestrictedCategory(cat)` แยกเป็น module เดี่ยว
- `Frontend/app/lib/forumCategories.test.ts` — unit tests 50+ cases ครอบ role permission

**เหตุผล:** logic เดิมกระจายอยู่ใน component — ย้ายออกมาเพื่อ testability และ reuse

---

### 3. Frontend — Browser Actions Module

**ไฟล์ใหม่:**
- `Frontend/app/lib/browserActions.ts` — helper actions ฝั่ง browser (window events, scroll, etc.)
- `Frontend/app/lib/browserActions.test.ts` — unit tests

---

### 4. Frontend — Community Page + AuthContext

- `Frontend/app/community/page.tsx` — ใช้ `availableCategories()` / `isRestrictedCategory()` จาก module ใหม่แทน inline logic
- `Frontend/app/contexts/AuthContext.tsx` — minor updates

---

### 5. Backend — Package + Config

- `Backend/package.json` + `Backend/bun.lock` — เพิ่ม dependency ใหม่
- `Backend/src/common/storage/uploads.controller.ts` (**ใหม่**) — upload controller สำหรับ R2 path

---

### 6. Cloudflare Worker — `.dev.vars.example`

- เพิ่ม `MIT_PATCH_URL` — URL ของ MIT server สำหรับ translate patches

---

## Architecture Decision (ADR 001)

ดูรายละเอียดเต็มที่ `docs/adr/001-cloudflare-r2-storage.md`

```
Upload path:
  Browser → Next.js proxy → NestJS (validate + auth) → CloudflareR2Provider → R2 bucket

Serve path:
  Browser → Cloudflare Worker → R2 bucket

Translate patches path:
  Backend → POST /v1/translate-patches → Worker → R2 (cache check) → MIT → store → return
```

---

## สิ่งที่ยังไม่ทำ (Pending)

| รายการ | หมายเหตุ |
|--------|---------|
| Unit test Worker handler | `handleTranslatePatches()` ยังไม่มี test |
| Integration test Backend→Worker | ต้องการ Worker dev server |
| Deploy checklist | `npx wrangler deploy` + secret `MIT_PATCH_URL` |
| `.env` update | เพิ่ม `WORKER_URL` + `WORKER_SECRET` บน production |

---

## จุดที่ควร Review พิเศษ

1. **`cloudflare-r2.provider.ts`** — `list()` ใช้ `delimiter="/"` เพื่อ mirror `DiskStorageProvider.list()` ที่ทำ `readdir` (1 level, basename) — ถ้า semantics เพี้ยนจะกระทบ `PatchStore.sweepLegacy()` ใน #137

2. **`patches.controller.ts`** — ใช้ `GET /r2-patches/*` แทน `/uploads/patches/` เพราะ `express.static` register ก่อน NestJS routes → controller จะไม่ได้รับ request ถ้าใช้ path เดิม

3. **`storage.module.ts` factory** — switch ทำที่ module init time (ไม่ใช่ runtime) — ถ้าเปลี่ยน env ต้อง restart server

4. **`translateMangaPagePatches()` fallback** — Worker branch และ disk branch ใช้ Redis cache key เดิมกัน — ถ้าสลับ provider กลางคันอาจมี stale cache ชั่วคราว (TTL จัดการเอง)

---

## ไฟล์ที่เปลี่ยนทั้งหมด (25 ไฟล์)

| ไฟล์ | การเปลี่ยน |
|------|-----------|
| `.gitignore` | เพิ่ม entries |
| `Backend/.env.example` | **ลบออก** (sensitive) |
| `Backend/bun.lock` | dependency update |
| `Backend/package.json` | เพิ่ม packages |
| `Backend/src/books/books.module.ts` | register PatchesController |
| `Backend/src/books/books.service.ts` | Worker branch ใน translateMangaPagePatches |
| `Backend/src/books/patches.controller.ts` | **ใหม่** |
| `Backend/src/common/env.validation.ts` | WORKER_URL, WORKER_SECRET |
| `Backend/src/common/storage/cloudflare-r2.provider.ts` | **ใหม่** |
| `Backend/src/common/storage/storage.module.ts` | factory switch |
| `Backend/src/common/storage/uploads.controller.ts` | **ใหม่** |
| `Backend/src/main.ts` | minor config |
| `Cloudflare-Worker/.dev.vars.example` | MIT_PATCH_URL |
| `Cloudflare-Worker/src/index.ts` | handleList, handleTranslatePatches |
| `Cloudflare-Worker/wrangler.toml` | bucket_name, name fix |
| `DONE.md` | session log อัปเดต |
| `Frontend/.env.example` | **ลบออก** (sensitive) |
| `Frontend/app/community/page.tsx` | ใช้ forumCategories module |
| `Frontend/app/contexts/AuthContext.tsx` | minor update |
| `Frontend/app/lib/browserActions.ts` | **ใหม่** |
| `Frontend/app/lib/browserActions.test.ts` | **ใหม่** |
| `Frontend/app/lib/forumCategories.ts` | **ใหม่** |
| `Frontend/app/lib/forumCategories.test.ts` | **ใหม่** |
| `docs/adr/001-cloudflare-r2-storage.md` | **ใหม่** |
| `docs/cloudflare-r2.md` | **ใหม่** |
