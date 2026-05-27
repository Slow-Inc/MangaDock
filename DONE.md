# DONE — Claude Code Review Fix Session (2026-05-27)

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

## 🛠️ V5 Final Hardening (Commit 69712f9)
- **Error Handling:** เปลี่ยน `throw new Error()` เป็น `InternalServerErrorException` ทั้งหมดใน `UnlockService` เพื่อมาตรฐานความปลอดภัย
- **Runtime Validation:** ติดตั้ง `forum.dto.ts` และเปิดใช้งาน `ValidationPipe` (class-validator) แบบ Global ใน `main.ts` ป้องกัน Payload ที่ผิดโครงสร้าง
- **Test Integrity:** แก้ไข `forum.controller.spec.ts` ให้ Mock ข้อมูลตรงตาม Contract จริง `{ items, total }`
