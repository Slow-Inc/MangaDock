# DONE — Claude Code Review Fix Session (2026-05-27)

---

## 🔖 Pending Issues (GitHub MCP no access — publish manually when token updated)

| # | Title | Priority |
|---|---|---|
| #89 | fix(books): notify() ต้อง publish ไป Redis ใน NDJSON sync path | ✅ done |
| #90 | fix(webhook): security hardening — raw HMAC, enforce secret, img_b64 bound | ✅ done (S2+S3; S1 raw HMAC pending) |
| #91 | fix(misc): listener tracking, observability, fetch short-circuit | ✅ done |
| #92 | PRD: Qwen3 offline translator (see below) | 📋 PRD ready |

---

## 📋 PRD #92 — Qwen3 Offline Translator (2026-06-04)

### Problem Statement

ผู้ใช้ที่มี GPU (RTX 4070 Super 12GB) ต้องการรัน manga translation แบบ offline ไม่พึ่ง Gemini API แต่ MIT hardcode translator เป็น `gemini` และไม่มี Qwen3 translator class Qwen3 ยังมี thinking mode ที่ต้องปิดก่อนใช้งาน

### Solution

1. `MIT` — Qwen3Translator class ใหม่ที่ปิด thinking mode + config ผ่าน env vars
2. `MIT config.py` — เพิ่ม `qwen3`, `qwen3_big` ใน Translator enum + OFFLINE_TRANSLATORS
3. `Backend` — อ่าน `MIT_TRANSLATOR` env var แทน hardcode `gemini`

### Env Vars (MIT)

| Var | Default | Description |
|---|---|---|
| `QWEN3_MODEL` | `Qwen/Qwen3-4B-Instruct` | HuggingFace model ID |
| `QWEN3_4BIT` | `false` | INT4 quantization |
| `QWEN3_TORCH_DTYPE` | `auto` | auto/bfloat16/float16 |
| `QWEN3_MAX_NEW_TOKENS` | `4096` | Max output tokens |
| `QWEN3_BIG_MODEL` | `Qwen/Qwen3-8B-Instruct` | Model for qwen3_big key |
| `QWEN3_BIG_4BIT` | `false` | INT4 for big model |

**Backend:**
```
MIT_TRANSLATOR=gemini   # gemini | qwen3 | qwen3_big | nllb | sugoi
```

### Key Implementation Notes

- `apply_chat_template(..., enable_thinking=False)` — requires transformers >= 4.51.0; strip `<think>.*</think>` as fallback
- Qwen3-4B BF16 = ~8GB VRAM → fit ใน 12GB, ~4GB เหลือสำหรับ KV cache
- Cold start บน SN850X NVMe (~7GB/s): ~1 วินาที หลัง download ครั้งแรก

### Testing

- MIT (Python unittest): thinking tag stripping, env var reading, response parsing
- Backend (Jest): `MIT_TRANSLATOR` env → correct translator field ใน MIT config JSON; default = `gemini`
- Prior art: `books-pubsub-batch.spec.ts` สำหรับ mock `_runMitBatch`

### Out of Scope

- Frontend translator selector UI
- Qwen3 MoE 235B
- Automatic VRAM detection/quantization selection
| #91 | fix(misc): listener tracking log, observability, fetch short-circuit | 🟡 medium |

---

## Files Modified

### Frontend
- `app/lib/communityApi.ts` — Always append `limit` param (removed `!== 20` condition)
- `app/lib/apiCache.ts` — `cacheClearByTag`: collect keys before iterating (Map mutation bug fix)
- `app/components/VoteButtons.tsx` — Added resync `useEffect` on `targetId` change; moved auth check before loading guard
- `app/hooks/useForumStream.ts` — Changed SSE URLs to `/api/proxy/` prefix; added non-empty catch blocks with console.warn; fixed `esRef.current = null` in `useFeedStream` cleanup
- `app/community/page.tsx` — Added `if (!user) { showLoginPrompt(); return; }` to `handleCreatePost`; fixed SVG paths `l18 18` → `L18 18`
- `app/community/p/[id]/page.tsx` — XSS sanitization for imageUrls (`/^https?:\/\//` guard); added `mountedRef` to prevent setState after unmount in handlePostComment; removed redundant `fetchData(true)` after optimistic comment add

### Backend
- `src/auth/auth.guard.ts` — Removed duplicate `OptionalAuthGuard` class
- `src/auth/optional-auth.guard.ts` — Now the single source of truth for `OptionalAuthGuard`
- `src/forum/forum.controller.ts` — Updated import to use `optional-auth.guard`; added `Math.min(100, ...)` limit cap; fixed `getTrendingManga` parseInt; added `fs.unlink` temp file cleanup in both upload handlers; added `import * as fs`
- `src/forum/forum.service.ts` — Added `file-type` magic-byte validation for uploads (replaces client-header check); `listComments` `.limit(500)` cap; `createComment` parent check adds `.is('deleted_at', null)`; replaced all `throw new Error()` with `InternalServerErrorException`; fixed `String(err)` for unknown error types; `recalculateVotes` now uses `recalculate_votes_atomic` RPC
- `src/forum/forum-events.service.ts` — Wrapped `redis.publish` in try/catch; guarded `next()` with `!postSubject.closed`
- `src/wallet/wallet.service.ts` — Replaced `addCoins`/`spendCoins` with atomic Supabase RPC calls; removed TOCTOU `getOrCreateWallet` (upsert now handled inside RPC); all `throw new Error()` → `InternalServerErrorException`
- `src/wallet/wallet.controller.ts` — Added DEV ONLY comment to `/wallet/topup` endpoint
- `src/unlock/unlock.service.ts` — Restructured `purchaseUnlock` to insert unlock record BEFORE `processRevenueSplit`; rolls back unlock on payment failure
- `supabase-migration.sql` — Added Section 8: `add_coins_atomic`, `spend_coins_atomic`, `recalculate_votes_atomic` RPC functions

### Spec Files (fixed to compile)
- `src/forum/forum.controller.spec.ts` — Updated `OptionalAuthGuard` import to `optional-auth.guard`
- `src/forum/forum.service.spec.ts` — Added 3rd constructor arg + `rpc` mock to `makeService`
- `src/wallet/wallet.service.spec.ts` — Rewrote to test new RPC-based `addCoins`/`spendCoins`; removed `getOrCreateWallet` tests

### DB (Supabase MCP applied live)
- `atomic_wallet_and_vote_rpcs` migration — `add_coins_atomic`, `spend_coins_atomic`, `recalculate_votes_atomic` created
- `update_wallet_rpcs_with_balance_after` migration — Updated RPCs to include `balance_after` and `reference_id` in transaction insert

### Package
- `file-type` installed in Backend (`npm install file-type`)

### Verified & Hardened (Pre-Phase 2 Audit)
- **Soft Deletion:** Verified `deleted_at` implementation in `forum.service.ts` across 9 points (Update & Filter).
- **Spoiler Blur:** Verified `spoiler` category integration in `PostCard`, `PostDetail`, and `Community` page with blur filters and click-to-reveal logic.

## What Was NOT Changed
- Pre-existing spec errors in `hardware-id.middleware.spec.ts`, `unlock.controller.spec.ts`, `wallet.controller.spec.ts` (INestApplication import) — out of scope
- Storage-before-DB order in uploadBanner/uploadImage — was already correct

## Gemini Re-review Suggestions
- `file-type` magic-byte validation: verify CJS interop on deployed Node version
- `recalculate_votes_atomic` RPC: confirm `data[0]?.upvotes` always populated after UPDATE
- `unlock.service.ts` rollback: best-effort delete — consider logging if rollback also fails

---

## ✅ Phase 1.5 Completion Verification (2026-05-27)

### Phase 1.5 Status: COMPLETE

#### Community Forum (PR #9 — merged 2026-05-27)
- `Frontend/app/community/layout.tsx` — Shared layout + mobile drawer
- `Frontend/app/community/trending/page.tsx` — Trending manga grid
- `Frontend/app/community/manga/[mangaId]/page.tsx` — Manga community feed
- `Frontend/app/community/profile/[uid]/page.tsx` — User profile page
- `Frontend/app/components/ForumSideMenu.tsx` — Sidebar navigation
- `Frontend/app/components/PostCard.tsx` — Reddit compact view + spoiler transitions
- `Frontend/app/components/SmoothScrolling.tsx` — Scroll reset on pathname change
- `Frontend/app/community/page.tsx` — Bottom sheet modal animation
- `Frontend/app/community/p/[id]/page.tsx` — Sticky header, spoiler fade, XSS fix
- `Frontend/app/lib/communityApi.ts` — Round position before send
- `Backend/src/forum/forum.dto.ts` — @IsNumber replaces @IsInt

#### Task A — Creator Earnings API + UI (pre-existing, verified complete)
- `Backend/src/wallet/wallet.service.ts` — `getCreatorEarnings(uid)` queries `translator_earnings` VIEW; returns zero values when no row exists
- `Backend/src/wallet/wallet.controller.ts` — `GET /wallet/earnings` with AuthGuard
- `Frontend/app/lib/studioApi.ts` — `CreatorEarnings` type + `getCreatorEarnings(token)`
- `Frontend/app/studio/wallet/page.tsx` — Earnings section visible only for translator/creator roles

#### Task B — HWID Middleware Enforcement (pre-existing, verified active enforcer)
- `Backend/src/common/middleware/hardware-id.middleware.ts` — Active enforcer: rejects 401 `{ statusCode: 401, message: 'Missing hardware ID' }` for protected routes; warns at logger level; whitelist covers auth/forum/wallet/public browse

### What Was NOT Changed (Phase 1.5 close-out)
- `supabase-migration.sql` — translator_earnings VIEW already existed, no migration needed
- Any file in `Documents/`, `unlock.service.ts`, `books/*`

### Notes for Gemini
- Phase 1.5 is fully closed — all 4 pillars (Forum, HWID, Earnings, Zero-Trust) verified in codebase
- Ready to begin Phase 2 planning (Architectural Scaling & Cloud Readiness)

---

## ✅ Phase 2 — 2-Layer Cache Upgrade (Branch: feat/2-layer-cache-upgrade, Commit: ad72574)

### Phase 2 Cache Status: IMPLEMENTED — Pending PR

#### New Files
- `Backend/src/status/metrics.service.ts` — Node heartbeat: CPU sampling (500ms), freeMem, Supabase HEAD ping, publishes `cluster_metrics:{nodeId}` ทุก 10s (ยิงทันทีตอน startup ด้วย)
- `Backend/src/status/election.service.ts` — Redis NX Lock election: `SET cache:leader NX PX` สำหรับ acquisition, `SET XX PX` สำหรับ renewal ทุก 15s, LEADER_TTL = 37.5s (2.5× interval)
- `Backend/src/cache/batch-sync.worker.ts` — Reliable Queue: `RPOPLPUSH cache:dirty cache:processing` → sync → `LREM` ack; crash recovery ด้วย `LRANGE cache:processing` บน onModuleInit; leader-only guard ใน flush()
- `Backend/src/status/metrics.service.spec.ts` — 2 tests: startup publish, interval tick
- `Backend/src/status/election.service.spec.ts` — 7 tests: NX acquisition, contention, renewal, failover, logging
- `Backend/src/cache/batch-sync.worker.spec.ts` — 8 tests: rpoplpush, lrem ack, crash recovery, markDirty, corrupt data

#### Modified Files
- `Backend/src/cache/cache-orchestrator.service.ts` — write-behind set(): Redis write + markDirty; ลบ DEFAULT_TTL_SEC (dead code); ลบ markDirty จาก setMangaCacheWithTiers
- `Backend/src/cache/cache.module.ts` — import StatusModule, register BatchSyncWorker
- `Backend/src/status/status.module.ts` — register + export MetricsService, ElectionService

#### Key Architecture Decisions
- **Leader Election:** Redis NX Mutex แทน metric scoring — ป้องกัน split-brain และ leader thrashing
- **Reliable Queue:** RPOPLPUSH+LREM แทน LPOP — ป้องกัน data loss เมื่อ leader crash กลางคัน
- **MetricsService:** เก็บ CPU/mem/latency เพื่อ observability เท่านั้น ไม่ใช้ตัดสิน leadership
- **METRICS_STALE_MS:** 35,000ms (เพิ่ม 5s buffer จาก Redis TTL 30s)

#### What Was NOT Changed
- `books/*`, `forum/*`, `unlock.service.ts`, `wallet/*` — out of scope
- BullMQ / Supabase Edge Function — over-engineering สำหรับ stage นี้
- Pub/Sub cross-node L1 sync — scaffolding สำหรับ Phase 3

#### Bugs Found by TDD
- `flush()` เช็ค `isLeader` แค่ใน interval callback — แก้: ย้าย guard เข้าใน flush() เอง
- `onModuleInit()` ของ BatchSyncWorker ต้องเป็น `async` เพื่อให้ crash recovery เสร็จก่อน interval เริ่ม

#### Test Count: 134 passing (เพิ่มจาก 117 → 134)

#### Notes for Gemini
- Phase 2 Cache branch พร้อม review ก่อน merge — รอ PR
- `cache:processing` list ควร empty ตลอดในสภาวะปกติ; non-empty หลัง flush cycle = WARN signal
- Dirty queue consumer (syncKey → JsonCache) ยังเป็น scaffolding; Supabase RPC handlers จะเพิ่มทีละ feature ใน Phase 2 ถัดไป

---

## ✅ Phase 2b — Issue #13: L3DiskService Extraction (TDD, Branch: feat/2-layer-cache-upgrade)

### Status: COMPLETE — 147 tests passing

#### New Files
- `Backend/src/cache/l3-disk.service.ts` — Deep module สำหรับ disk I/O ทั้งหมด: `write(key, entry)` (sanitize filename + embed original key) + `readAll(): Map` (skip corrupt, swallow errors); รับ cacheDir ผ่าน `@Optional() @Inject('L3_CACHE_DIR')` เพื่อ testability
- `Backend/src/cache/l3-disk.service.spec.ts` — 5 tests: empty dir, round-trip, key sanitization, corrupt JSON skip, disk error swallow
- `Backend/src/cache/json-cache.service.spec.ts` — 3 tests: `set()` ไม่เขียน disk, `syncEntry()` ไม่เขียน disk, `onModuleInit()` warm L1 จาก L3

#### Modified Files
- `Backend/src/cache/json-cache.service.ts` — **แก้ bug หลัก**: ลบ `writeToDisk()` ออก + `set()` / `syncEntry()` เป็น in-memory เท่านั้น + `onModuleInit()` ใช้ `l3.readAll()` แทน direct `fs.readdirSync`; constructor รับ `L3DiskService` ผ่าน DI
- `Backend/src/cache/cache.module.ts` — เพิ่ม `L3DiskService` เป็น provider (ก่อน `JsonCacheService` เพราะ DI dependency)

#### Key Fix (from grill session 2026-05-28)
**Bug:** `JsonCacheService.set()` เรียก `writeToDisk()` ทุก L1 update — disk I/O overflow เพราะ L1 update บ่อยมาก
**Fix:** L3 (disk) เขียนโดย `L3DiskService.write()` เท่านั้น ซึ่งจะถูกเรียกโดย `L3BatchWriter` (Issue #14) ตาม Flush Frequency ต่อ data type — ไม่เคยเขียนใน `set()` path

#### Test Count: 147 passing (เพิ่มจาก 139 → 147)

#### What Was NOT Changed
- `CacheOrchestratorService` — interface `set()`/`syncEntry()` เหมือนเดิม
- `BatchSyncWorker` — `syncEntry()` ยังทำงานปกติ (ตอนนี้ update L1 in-memory เท่านั้น — correct)
- `batch-sync.worker.spec.ts` — mock `JsonCacheService` ไม่ได้รับผลกระทบ

---

## ✅ Phase 2b — Issues #14+#15: L3BatchWriter + Leader flush wire (TDD)

### Status: COMPLETE — 155 tests passing

#### New Files
- `Backend/src/cache/l3-batch-writer.ts` — periodic L2→L3 batch บนทุก node; FLUSH_CONFIG: wallet: 2s, stats: 5s, default: 60s; fires immediate flush on startup; skips L2-missing keys; skips when Redis unavailable
- `Backend/src/cache/l3-batch-writer.spec.ts` — 6 tests: startup flush, L2 miss skip, wallet 2s interval, manga only at 60s, destroy stops intervals, Redis unavailable

#### Modified Files (#15)
- `Backend/src/cache/batch-sync.worker.ts` — `syncKey()` ตอนนี้เรียก `l3.write(key, entry)` แทน `jsonCache.syncEntry()`; inject `L3DiskService` แทน `JsonCacheService`
- `Backend/src/cache/batch-sync.worker.spec.ts` — อัปเดต mock ใช้ `L3DiskService`; assertions เปลี่ยนจาก `jsonCache.syncEntry` เป็น `l3.write`
- `Backend/src/cache/cache.module.ts` — เพิ่ม `L3BatchWriter` provider

#### Final Write-behind Architecture
```
set(key)  →  L1 in-memory  →  L2 Redis  →  markDirty

L3BatchWriter (all nodes):   L2 → L3  (per Flush Frequency per type)
BatchSyncWorker (Leader):    L2 → L3  (re-sync before future Supabase write)
```

#### Design Note (per grill)
- `L3DiskService.write()` swallows disk errors — L3 = best-effort backup
- Ack (lrem) always happens after write attempt; JSON parse fail = no ack (retry)
- `L3BatchWriter` re-attempts on next cycle ถ้า disk ชั่วคราว unavailable

#### Test Count: 155 passing (เพิ่มจาก 147 → 155)

---

## ✅ Phase 2c — Issues #18–#21: Dirty Queue Bug Fixes (TDD, Branch: feat/2-layer-cache-upgrade)

### Status: COMPLETE — 161 tests passing (Commits: bba4a76, 6154a2d)

#### Context
PR #16 scrutiny (Issues #17 PRD) found 3 major bugs + 1 minor in the dirty-queue path. Broken into 4 issues (#18–#21) and fixed via TDD.

#### Fixes

**Issue #18 — Processing queue leak (bba4a76)**
- `recoverOrphans()` previously called `lrange` → `del` → individual `rpush` per key
- Missing: `del` was never called → orphans piled up in `cache:processing` across restarts
- Fix: Added `del(PROCESSING_QUEUE)` before `rpush` loop
- Tests: "clears cache:processing with DEL before re-queuing"; "does not call DEL when empty"

**Issue #19 — Expired key orphan (bba4a76)**
- `syncKey()` silently skipped when L2 key expired (`if (!raw) return;`)
- Expired key stayed in `cache:processing` forever → permanent orphan after crash
- Fix: `await client.lrem(PROCESSING_QUEUE, 1, key)` before early return
- Tests: "calls lrem to ack even when key is expired in L2 — prevents permanent orphan"

**Issue #20 — Shutdown durability (bba4a76)**
- `onApplicationShutdown()` was syncing L1↔L2 timestamps — useless (in-memory data lost on exit)
- Fix: replaced with `l3BatchWriter.flush()` — actually persists to disk before exit
- `CacheOrchestratorService` now takes `L3BatchWriter` as 4th constructor param
- `setMangaCacheWithTiers()` now calls `markDirty()` (was missing from write-behind path)
- New spec: `cache-orchestrator.service.spec.ts` (4 tests)
- Tests: "calls l3BatchWriter.flush() on graceful shutdown"; "does not call jsonCache.syncEntry() on shutdown"

**Issue #21 — Non-atomic crash recovery (6154a2d)**
- DEL → RPUSH sequence has a crash window where keys can be silently dropped
- Fix: single `RECOVER_SCRIPT` Lua EVAL — LRANGE + DEL + RPUSH atomically in one round-trip
- Follows RENEW_SCRIPT / DELETE_SCRIPT pattern from ElectionService
- Logs count only (not per-key) since keys not iterable client-side after Lua exec
- Tests: "uses EVAL to atomically move orphans"; "does not call DEL or RPUSH directly during recovery"

#### Architecture Decisions
- **Lua CAS pattern** for all atomic multi-step Redis operations: RENEW_SCRIPT (election renewal), DELETE_SCRIPT (lock release), RECOVER_SCRIPT (crash recovery)
- **R2 for translated manga images**, Supabase for structured metadata → `setMangaCacheWithTiers()` now participates in write-behind (markDirty)
- **L3BatchWriter.flush()** is the correct shutdown hook — L1 sync was a false guarantee

#### Test Count: 161 passing (เพิ่มจาก 155 → 161, -1 test cleanup)

#### Notes for Gemini
- All 4 issues (#18–#21) closed; PR #16 branch (`feat/2-layer-cache-upgrade`) ready for final review and merge
- `RECOVER_SCRIPT` Lua script named constant lives in `batch-sync.worker.ts` alongside the queues it uses
- `cache-orchestrator.service.spec.ts` is a new file added alongside the orchestrator source

---

## ✅ Phase 2.4–2.5 — Cache Hardening (2026-05-29, PRs #60 / #61 closed)

### Status: COMPLETE — 277 tests passing

---

### Phase 2.4 — CatastrophicRecoveryService (#38)

#### New Files
- `Backend/src/cache/catastrophic-recovery.service.ts` — `OnModuleInit`: เมื่อ Redis ไม่ขึ้นตอน boot → อ่าน L3 → เปรียบเทียบ timestamp ต่อ key กับ Supabase (batch 100) → buffer winners → register reconnect callback (fire-once); `pushToL2()`: jitter 0–5s + pipeline chunk 500
- `Backend/src/cache/catastrophic-recovery.service.spec.ts` — 18 tests: T1-T10 (core + fire-once), S1-S5 (Supabase comparison), D1-D3 (smart dirty queuing)

#### Modified Files
- `Backend/src/cache/batch-sync.worker.ts` — `syncKey()` RPC params เปลี่ยนจาก `{ p_key, p_entry }` → `{ p_key, p_data, p_updated_at, p_ttl_ms }` (conditional upsert)
- `Backend/src/cache/batch-sync.worker.spec.ts` — เพิ่ม U1-U2: verify correct RPC param shape; `p_entry` absent
- `Backend/src/cache/cache.module.ts` — register `CatastrophicRecoveryService`

#### Key Architecture Decisions
- **Smart Dirty Queuing:** `source: 'l3' | 'supabase'` tracking — skip RPUSH เมื่อ Supabase wins (data อยู่ DB แล้ว) → เฉพาะ L3 winners เท่านั้นที่ต้อง re-sync
- **Fire-once callback:** `onReconnect()` return `unregister fn` → เรียกหลัง push สำเร็จครั้งแรก → ป้องกัน stale L3 data ทับ L2 บน reconnect ครั้งที่ 2+
- **Thundering herd:** jitter `Math.random() * 5000ms` ก่อน pipeline push
- **Supabase fallback:** ถ้า Supabase unavailable → ใช้ L3-only winners (log WARN)

#### Scrutinize Finding Fixed (post-PR)
- **Blocker:** `onReconnect` callback ไม่ unregister → push stale boot-time L3 data ทับค่าใหม่กว่าใน L2 บน reconnect ครั้งที่ 2
- **Fix (commit bcfd68d):** `const unregister = this.redis.onReconnect(() => this.pushToL2(winners).then(() => unregister()).catch(...))`
- **T10 test:** verify `unregister()` ถูก call exactly once หลัง push สำเร็จ

---

### Phase 2.4+ Round 1 — BatchSyncWorker Retry Budget + Dead-letter (#64–#66)

#### Modified Files
- `Backend/src/cache/batch-sync.worker.ts`
  - Export: `MAX_RETRIES = 5`, `RETRY_COUNTS_KEY = 'cache:retry_counts'`, `DEAD_LETTER_SET = 'cache:dead_letter'`
  - On RPC fail: `HINCRBY cache:retry_counts <key> 1`; if count >= MAX_RETRIES → `SADD cache:dead_letter <key>` + `LREM` + `logger.error`
  - On RPC success: `HDEL cache:retry_counts <key>` ก่อน `LREM`
  - On L2 expiry: `HDEL cache:retry_counts <key>` ป้องกัน stale counter สะสม
- `Backend/src/cache/batch-sync.worker.spec.ts` — เพิ่ม 6 tests R1-R6

#### Key Architecture Decision
- Keys ที่ fail Supabase ซ้ำๆ วนลูป dirty→processing→dirty ไม่มีที่สิ้นสุด → ระบบ retry budget + dead-letter set ป้องกัน single bad key กิน flush budget ทั้งหมด
- Dead-lettered keys inspectable ด้วย `SMEMBERS cache:dead_letter`; re-queue ด้วย `SMOVE cache:dead_letter cache:dirty <key>`

---

### Phase 2.4+ Round 2 — mangaId Propagation in Stats Pipeline

#### Modified Files
- `Frontend/app/components/MangaReader.tsx` — สร้าง URL ด้วย `URLSearchParams` รวม `?mangaId=` param เมื่อ prop มีค่า

#### Context
- `StatsIncrementService.recordChapterView()` ตั้ง `stats:chapter:{id}:manga:{date}` key ถูกต้องอยู่แล้ว
- `BooksController.getMangaChapterPages()` รับ `@Query('mangaId')` อยู่แล้ว
- ปัญหา: `MangaReader.tsx` ไม่ส่ง `?mangaId=` ทำให้ `manga_id` ใน `chapter_daily_stats` เป็น `''` เสมอ
- ทุก component caller (`BookDetailModal`, `ContinueReadingRow`, `MangaGrid`, `BookRow`) ส่ง `mangaId={book.id}` ครบแล้ว

---

### Phase 2.4+ Round 3 — Timer Hygiene + Cache Health Endpoint (#67–#69)

#### New Files
- `Backend/src/cache/cache-health.service.ts` — `getHealth(): Promise<CacheHealthSnapshot>`: LLEN dirty/processing, SCARD dead_letter, L3 keyCount, isLeader; คืน 0 ทุกตัวเมื่อ Redis unavailable
- `Backend/src/cache/cache-health.service.spec.ts` — 6 tests H1-H6

#### Modified Files
- `Backend/src/cache/batch-sync.worker.ts` — `.unref()` บน `setInterval` timer
- `Backend/src/cache/stats-flush.worker.ts` — `.unref()` บน `setInterval` timer
- `Backend/src/cache/redis.service.ts` — เพิ่ม `llen(key)` + `scard(key)` methods
- `Backend/src/cache/l3-disk.service.ts` — เพิ่ม `keyCount()` → count `.json` files ไม่ parse JSON
- `Backend/src/cache/cache.module.ts` — register + export `CacheHealthService`
- `Backend/src/status/status.controller.ts` — `GET /status/cache` → `CacheHealthService.getHealth()`

#### Key Architecture Decisions
- **Timer `.unref()`:** ป้องกัน Jest process leak warning; production ไม่มีผลกระทบ
- **`GET /status/cache`:** เปิดเหมือน `/status/stream` (ไม่มี auth guard) — ข้อมูลไม่ sensitive
- **`CacheHealthService`:** deep module — dependency inject ได้, mock ได้ง่าย, interface ไม่เปลี่ยน

---

### Test Count: 277 passing (เพิ่มจาก 265 → 277)

| Batch | Tests Added |
|-------|------------|
| T1-T10 (CatastrophicRecovery core + fire-once) | +10 |
| S1-S5 (Supabase comparison) | +5 |
| D1-D3 (smart dirty queuing) | +3 |
| U1-U2 (RPC param shape) | +2 |
| R1-R6 (retry budget + dead-letter) | +6 |
| H1-H6 (cache health service) | +6 |

### Notes for Gemini
- PR #60 (feat/cache-phase-2-4) ปิดแล้ว — งานทั้งหมดรวมอยู่ใน PR ใหม่
- `cache:dead_letter` Redis Set ควร empty เสมอในสภาวะปกติ; non-empty = signal ว่ามี key ที่ต้องตรวจสอบ Supabase schema/constraint
- `GET /status/cache` endpoint: operator ใช้ตรวจสอบ queue depths; ไม่มี auth เหมือน `/status/stream`
- `L3DiskService.keyCount()` นับแค่ไฟล์ ไม่ parse JSON — ถูกใช้เฉพาะ health snapshot, ไม่กระทบ critical path
- `mangaId` ใน `chapter_daily_stats` จะมีค่าถูกต้องตั้งแต่ session นี้เป็นต้นไป; ข้อมูล historical ที่มี `''` ยังอยู่ใน DB แต่ไม่กระทบ future data

---

## ✅ Translation System Overhaul (2026-06-04, Session: Claude + Gemini multi-perspective)

### Status: COMPLETE (backend) — Batch refactor (Option A') pending

#### Bugs Fixed & Tested (issues #73–#78, all closed)
- **#73** `startOrAttachBatchJob`: `.finally()` deleted job before webhooks arrived → replaced with `try/finally` + 15-min timeout + abort-signal listener
- **#74** `handleMitCallback`: raw pixel coords stored as percentages → normalized with `imgWidth/imgHeight`; patch URL uses `backendOrigin`
- **#75** HMAC mismatch (Python spaces vs JS compact) → `json.dumps(separators=(',',':'), ensure_ascii=False)`; NestJS length-checks before `timingSafeEqual`
- **#76** Idempotency race in `handleMitCallback` → `processingPages: Set<number>` locks synchronously before any `await`
- **#77** Latecomer listener added after replay loop → add before iterating `completedPages`
- **#78** TOCTOU in `startOrAttachBatchJob` → register placeholder in `activeBatchJobs` before first `await cache.get()`

#### Dead Code Removed (#81, closed)
- `BooksService.translateMangaPage()` — full-image path (never called by frontend)
- `BooksController POST /chapters/:id/pages/:idx/translate` — endpoint removed
- `Frontend translateMangaPage()` — exported but never imported

#### Other Fixes (#82–#84, closed)
- **#82** `_retryMissingPagesIndividually` now accepts `AbortSignal`; passes `maxStartupRetries:3` to limit fallback wait from 150s → 15s per page
- **#83** `checkMitHealth` calls `/ready` (not root `/`); MIT server gains `/ready` endpoint returning 503 until first worker registered
- **#84** `fetchAvailableMangaModels()` fetches from `/api/proxy/books/models` with 5-min cache + hardcoded fallback

#### New Issues Created
- **#85** fix: `translateMangaEpisode` hardcodes Thai — add `targetLang` parameter
- **#86** feat: expand target language options to all 17 MIT-supported languages
- **#87** PRD: user-selectable Gemini model for MIT image translation

#### Architecture Decision: Option A' (Redis pub/sub batch translation)
After Gemini 10-perspective scrutiny + roadmap comparison:
- Option A (in-memory job registry) — compliant but 6 bugs stem from Map-based state
- Option B (sync NDJSON only) — simpler but violates Roadmap Fire-and-Forget + Pillar 4
- Option C (sequential+cache) — violates Pillar 4 and Phase 2 GPU cloud requirement
- **Option A' chosen**: replace `activeBatchJobs` Map with Redis pub/sub; `handleMitCallback` = `cache.set` + `redis.publish`; eliminates all 6 bug classes without losing fire-and-forget/webhook pattern

#### Test Count: 299 passing (was 295)

#### Notes for Gemini
- `books-batch-webhook.spec.ts` (13 tests) + `books-retry.spec.ts` (2) + `books-health.spec.ts` (2) + `mit-webhook-hmac.spec.ts` (3) added
- Option A' implementation issue pending — will replace `startOrAttachBatchJob` (~500 lines) with Redis pub/sub (~50 lines)
- `processingPages: Set<number>` added to `BatchJobState` interface (temporary, removed with Option A')

---

## 🛠️ V5 Final Hardening (Commit 69712f9)
- **Error Handling:** เปลี่ยน `throw new Error()` เป็น `InternalServerErrorException` ทั้งหมดใน `UnlockService` เพื่อมาตรฐานความปลอดภัย
- **Runtime Validation:** ติดตั้ง `forum.dto.ts` และเปิดใช้งาน `ValidationPipe` (class-validator) แบบ Global ใน `main.ts` ป้องกัน Payload ที่ผิดโครงสร้าง
- **Test Integrity:** แก้ไข `forum.controller.spec.ts` ให้ Mock ข้อมูลตรงตาม Contract จริง `{ items, total }`
