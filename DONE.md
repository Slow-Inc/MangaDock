# DONE — Claude Code Review Fix Session (2026-05-27)

---

## 🐛 Batch Translation End-to-End Fix Session (2026-06-04)

อาการ: แปลทีละหน้าได้ปกติ แต่ "แปลทุกหน้า" (Batch Translation) frontend ไม่แสดง patch — สุดท้าย frontend ได้ HTTP **524** (Cloudflare timeout)

พบและแก้ bug 4 ตัวตามลำดับ (debug จาก log ไฟล์ backend/MIT):

| # | Root Cause | Fix | Files |
|---|---|---|---|
| 1 | MIT Webhook ส่งไป Backend Public Origin (Cloudflare) ที่ MIT บน localhost reach ไม่ได้ | เพิ่ม `MIT_CALLBACK_ORIGIN` env + `mitCallbackOrigin` getter (`http://localhost:4001`) | `books.service.ts`, `.env`, `.env.example` |
| 2 | Webhook controller reject ทุก request เมื่อ `MIT_WEBHOOK_SECRET` ไม่ได้ตั้ง | ทำ HMAC เป็น optional — ไม่มี secret → accept unauthenticated | `mit-webhook.controller.ts` |
| 3 | ส่ง `signal` เข้า `fetch(mitUrl)` → user cancel → kill TCP กลางคัน → MIT BLAS crash (`forrtl error 200`) | ถอด `signal` ออกจาก MIT POST + เพิ่ม pre-check `signal.aborted` ก่อน submit | `books.service.ts` |
| 4a | MIT webhook body (base64 PNG ~1-3MB) เกิน body-parser default 100KB → `PayloadTooLargeError` | ตั้ง `json({ limit: '50mb' })` + `bodyParser: false` ตอน create app | `main.ts` |
| 4b | **Contract mismatch**: MIT ส่ง flat payload `{taskId,pageIndex,imgWidth,imgHeight,patches,error}` แต่ controller คาด `body.result` → `result.imgWidth` crash (undefined) | controller อ่าน flat fields แล้วประกอบ `result` object เอง (anti-corruption layer) — ตรงกับ NDJSON path ที่อ่าน flat อยู่แล้ว | `mit-webhook.controller.ts` |
| 5 | SSE endpoint ไม่มี heartbeat → ระหว่างรอ MIT แปลหน้าแรก (~62s, ใกล้ 100s) ไม่มี byte ไหล → Cloudflare 524 | เพิ่ม initial `: connected` byte (บังคับ proxy เข้า streaming mode) + periodic `: ping` ทุก 15s, clear บน close/end | `books.controller.ts` |

**Verified:** `npx nest build` EXIT 0 (production build สะอาด; spec files มี error เดิมที่ไม่เกี่ยว)

### 🔍 MIT Scrutiny → GitHub Issues (2026-06-04)

scrutinize ทั้ง server/orchestration layer ของ MIT แล้วเปิด 6 issues:

| Issue | Severity | สรุป |
|---|---|---|
| [#100](https://github.com/Slow-Inc/MangaDock/issues/100) | 🔴 critical | `send_webhook` ไม่ retry + กลืน error → Patch Set ที่คำนวณเสร็จหายถาวร (สาเหตุแท้จริงของ "0/20") |
| [#101](https://github.com/Slow-Inc/MangaDock/issues/101) | 🔴 critical | ยกเลิก batch ไม่ propagate ไป MIT (`DummyRequest.is_disconnected→False`) → zombie job เผา GPU |
| [#102](https://github.com/Slow-Inc/MangaDock/issues/102) | 🟠 security | path traversal + unauth บน `/result(s)/...` → read/delete นอก RESULT_ROOT |
| [#103](https://github.com/Slow-Inc/MangaDock/issues/103) | 🟠 security | worker รับ pickle ผ่าน HTTP + bind 0.0.0.0 → RCE risk; ต้อง bind 127.0.0.1 |
| [#104](https://github.com/Slow-Inc/MangaDock/issues/104) | 🟡 major | batch endpoints พัง (sent_batch arity + stub execute_batch) — dead/broken |
| [#105](https://github.com/Slow-Inc/MangaDock/issues/105) | 🟢 cleanup | dead code: duplicate imports, `String(e)` JS leftover, `start_instance=True` override, no-op if/else, dead `__del__`, `==‘cancel’` |

**เฟส 3 — สแกน logic layer เพิ่ม (ข้ามไฟล์ model AI):**
- [#106](https://github.com/Slow-Inc/MangaDock/issues/106) 🟡 — event-loop blocking (`requests.get` ใน async), lock-across-await, streaming ไม่มี timeout
- [#107](https://github.com/Slow-Inc/MangaDock/issues/107) 🟡 **bug จริงใน gemini.py (default translator!)** — `server_error_attempt` UnboundLocalError ทำ retry path พังเมื่อ Gemini error + bare raise + `lstrip` prefix misuse + JSON sample IndexError
- `#105` comment — dead code เพิ่มใน translator dispatch (langid ทิ้ง, branch redundant, shared mutable cache)
- `translators/__init__.py dispatch`, `TranslatorChain`, `_run_text_translation` — ตรวจแล้ว ไม่มี critical (แค่ dead code)

**เฟส 4 — สแกน GPT shared layer + validation (ข้าม model AI):**
- [#108](https://github.com/Slow-Inc/MangaDock/issues/108) 🟡 — `config_gpt.py` few-shot sample cache (`langSamples`) ไม่ key ตามภาษา/ชนิด → แปลภาษาแรกค้าง sample กระทบ multi-lang gemini + common_gpt JSON-mode helpers พัง (text2json ขาด self, chat_sample int-index)
- [#109](https://github.com/Slow-Inc/MangaDock/issues/109) 🟡 — `_check_target_language_ratio` ใช้ langid reject ทั้งหน้า (เปราะกับ SFX/credits ที่ไม่แปล) + dead `min_ratio` param + threshold region ไม่ตรงกัน (5 vs 10)
- `#105` comment เพิ่ม — dead code: `OfflineTranslator._load` ประกาศซ้ำ, `reload` param ไม่ parse, dead `_json_sample` local
- `common.py CommonTranslator.translate`, `_validate_translation`/retry, `_check_repetition_hallucination` — ตรวจแล้ว logic ถูกต้อง

**เฟส 5 — rendering + orchestration glue:**
- [#110](https://github.com/Slow-Inc/MangaDock/issues/110) 🟡 — `render()` ใช้ `region.horizontal` (raw) ทำ box padding แต่วาดด้วย `render_horizontally` (forced) → เพี้ยนเมื่อ force direction (MangaDock ใช้ auto เลย dormant) + homography None ไม่ guard
- `_translate_until_translation` (detect→ocr glue ที่ patch path เรียก) — try/except + ignore_errors ทุก stage, early-return ปลอดภัย **ไม่มีบั๊ก**

**✅ สถานะ: ตรวจ MangaDock-relevant logic ครบ end-to-end แล้ว** — patch path traced ตั้งแต่ entry (server endpoints) → queue/executor → worker → translate_patches → detect/ocr glue → translator dispatch → gemini/qwen3 → GPT shared layer → post-translation validation → rendering → webhook → SSE

**Issues ทั้งหมด: #100-#110 (11 issues) + #105 (2 comments)**

**เฟส 6 — สแกน logic ที่เหลือทั้งหมด (ยกเว้น model AI):**
- [#111](https://github.com/Slow-Inc/MangaDock/issues/111) 🟡 — `textline_merge` prob normalize หารผิด denominator (`textlines` แทน `txtlns`) + `TextBlock` `texts[0]` default พัง + mutable default
- `#110` comment — `generic.py` `findHomography` ไม่ guard (อีก site)
- `#106` comment — `gemini_2stage.py` ใช้ sync OpenAI block event loop
- dispatch glue ทั้ง 6 (detection/ocr/inpainting/mask_refinement/upscaling/colorization) — สะอาด
- retry-pattern check: gemini.py เป็นไฟล์**เดียว**ที่ไม่ init `server_error_attempt` (chatgpt/deepseek/custom_openai/sakura init ถูกต้อง) → ยืนยัน #107

**วิธีครอบคลุม:**
- **Deep-read (ทีละบรรทัด):** server/ ทั้งหมด · MangaDock patch path ใน manga_translator.py · translators/__init__+common+common_gpt+config_gpt+gemini+qwen3+gemini_2stage · textblock+textline_merge · rendering · dispatch glue ทั้ง 6
- **Pattern-swept (grep crash-class: undefined-var-in-except, bare except, mutable default, lstrip-misuse, findHomography unguarded, sync-in-async):** ไฟล์ที่เหลือทั้งหมด รวม chatgpt/chatgpt_2stage/sakura/nllb/sugoi/m2m100/etc + mode/local+ws + utils ที่เหลือ → bug ทั้งหมด isolate อยู่ในไฟล์ที่ deep-read แล้ว
- **ไม่ได้ line-read แบบเต็ม (pattern-swept เท่านั้น):** body ของ translator ที่ MangaDock ไม่ใช้ (chatgpt_2stage, sakura, nllb ฯลฯ ~5,000 บรรทัด), CLI mode (local.py, ws.py), geometry helpers (generic.py ที่เหลือ, sort.py, inference.py)
- **ข้ามถาวร:** OCR/detection/inpainting/diffusion **model AI** (~7,500 บรรทัด)

**Issues ทั้งหมด: #100-#111 (12 issues) + comments บน #105(×2), #106, #110**

---

## ✅ #100 IMPLEMENTED — Webhook retry + dead-letter (2026-06-05, TDD)

**Design (grill-locked, user approved ทั้งหมด):** retry เฉพาะ transient (5xx/429/conn) ไม่ retry 4xx · 4 attempts (max_retries=3) · exp backoff 0.5→1→2s · timeout 20s/attempt · sequential await + cap · dead-letter = structured JSON log · env-configurable

**Approach:** แยก `send_webhook` → **`server/webhook.py`** (deps: httpx/json/hmac/hashlib เท่านั้น → test import 0.26s vs main.py 22s) เพื่อ testability/maintainability ระยะยาว

**ไฟล์ที่แก้:**
- `MIT/server/webhook.py` (ใหม่) — `send_webhook` + `_sign` + `_is_retryable_status` + `_dead_letter`
- `MIT/server/main.py` — import จาก webhook.py + ลบ def เดิม + ลบ orphan imports (hmac/hashlib/httpx ×2 — รวม duplicate ของ #105 ที่ change นี้ทำให้ orphan)
- `MIT/test/test_send_webhook.py` (ใหม่) — **10 tests, fake httpx, asyncio.run (ไม่ต้อง pytest-asyncio)**
- `MIT/.env.example` — section 5: `MIT_WEBHOOK_MAX_RETRIES`, `MIT_WEBHOOK_RETRY_BACKOFF_MS`

**Verify (ทุกขั้นผ่าน):** TDD RED→GREEN · `pytest test/test_send_webhook.py` = **10 passed 0.21s** · py_compile OK · main.py ยัง import ได้ (send_webhook re-exported)

**ติดตั้ง:** `pytest 9.0.3` ลงใน MIT `.venv` แล้ว

**สำหรับ Gemini re-review:** dead-letter ปัจจุบันเป็น log อย่างเดียว (ไม่ persist/replay) — ตาม scope #100; การ persist เพื่อ reconciliation เป็นงานแยก (เกิน #100) · ยังไม่ commit (รอ user สั่ง)

### 📘 MIT documentation (blueprint สำหรับ team + agent) — 2026-06-05
- `MIT/ARCHITECTURE.md` — พิมพ์เขียว 12 sections (2-process model, directory map, patch path, translator subsystem, webhook, known issues #100–111). frame model folders เป็น black box หลัง `dispatch()` (codebase ใหญ่เพราะ model upstream — ไม่ต้อง doc ต่อโมดูล)
- `MIT/SETUP.md` — runbook: install/run/test + troubleshoot จริง (forrtl 200, model load 150s, CUDA OOM, port, webhook unreachable)
- `MIT/CONTRACT.md` — wire format MIT↔Backend; เด่นที่ **casing footgun** (single=snake_case `img_width` vs batch/webhook=camelCase `imgWidth`) + HMAC raw-bytes hazard (#95 S1) + size limits — กันบั๊กคลาส contract-drift
- **ตั้งใจไม่ทำ:** ADR log เต็ม, per-module model docs, Swagger (FastAPI มี `/docs` อยู่แล้ว) — กัน doc bloat

---

**เฟส 2 — สแกนส่วนที่เหลือ** (`mode/share.py`, `streaming.py`, `qwen3.py`, patch helpers, `config.py`):
- `translate_patches` + patch helpers (union-find grouping, mask crop/scale) — สะอาด ไม่มีบั๊ก
- `qwen3.py` (โค้ดใหม่ commit e1979cd) — แข็งแรง; default `Qwen/Qwen3.5-4B` ตรงกับ `.env.example`; ยืนยันทำงานจาก MIT log จริง
- **ข้อสังเกตเล็กน้อย (ยังไม่ filed):** `streaming.py stream()` รอ `messages.get()` ไม่มี timeout — ถ้า worker ไม่ส่ง terminal frame (code 0/2) SSE generator ค้าง (กระทบเฉพาะ streaming path ไม่ใช่ webhook path)
- **ขอบเขต:** ไม่ได้ line-audit deep ML pipeline (detection/OCR/inpaint/render/diffusion models) — เป็นโค้ด upstream และไม่ใช่จุดที่ reliability bug ของฟีเจอร์นี้อยู่

**ทดสอบ end-to-end:** ยังไม่ได้รัน — ต้อง **restart MIT** (run-server.bat) แล้วลองแปลทุกหน้าใหม่ Backend hot-reload เอง

**สำหรับ Gemini re-review (ทิ้งไว้ตั้งใจ ไม่แก้ในรอบนี้):**
- **#95 S1**: HMAC ยังคำนวณบน `JSON.stringify(body)` (parsed) ไม่ใช่ raw request bytes — MIT คำนวณบน `json.dumps(separators=(',',':'))` → ถ้าเปิด secret จะ mismatch ต้องเก็บ raw body buffer (เช่น `rawBody` express verify)
- **Latent**: ใน `handleMitCallback` ถ้า throw หลัง `processingPages.add(pageIndex)` (เช่น storage fail) page จะ lock ถาวร retry ไม่ได้ — ควรห่อ try/finally เพื่อ delete จาก processingPages เมื่อ error

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
