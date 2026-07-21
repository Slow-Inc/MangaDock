# Backend + Frontend Refactor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Groom two *healthy* codebases (NestJS Backend, Next.js Frontend) by removing the concrete debt found in the 2026-07-07 assessment: security-sensitive duplication, business logic sitting in HTTP controllers, over-long functions, and a handful of God components. This is **grooming, not a rewrite** — every task is behavior-preserving and leaves the app working.

**Architecture:** Follow the Engineering North Star — *simplest logic that works, surgical changes, no new dependencies.* The recurring move is **extract-for-testability**: lift fragile/duplicated logic out of large stateful files into small dependency-light modules or hooks that can be unit-tested in isolation, then delete the now-orphaned copies. We do **not** test React components directly — we test the extracted hooks/modules (matching the existing `useTopupCreate`/`useTopupStream`/`lib` test pattern).

**Tech Stack:** Next.js 16 / React 19 (Frontend, tests via `bun:test`, `*.test.ts` next to source), NestJS 11 (Backend, tests via Jest — `npx jest <path> --no-coverage`).

---

## Problem Statement

From the developer's perspective: *"Backend and Frontend have grown. I want to know whether they need refactoring, and if so, do it — full scope, both sides."*

The 2026-07-07 subagent assessment found **no structural rot** on either side (type safety tight, `@ts-ignore`=0, TODO/FIXME=0, no swallowed catches, strong `lib`/`hooks` test coverage). But it surfaced real, bounded debt:

**Backend**
- `B1` — Image-upload magic-byte validation + `MIME_TO_EXT`/`ALLOWED_IMAGE_MIME` is copy-pasted across 3 sites (`forum.service.ts` `uploadBanner`+`uploadImage`, `upload.service.ts`). Security-sensitive logic that drifts independently.
- `B2` — `books.controller.ts` `verifyCaptcha` (L32–77) performs the full Turnstile `siteverify` round-trip + token minting **inside the controller**, uses `@Req() req: any` (the only untyped request in the codebase), and logs via `console.error` (the codebase's only 4 stray `console.*`, all in this file).
- `B3` — `forum.service.ts` `getPublicProfile` (L215–367) is a 152-line function (the longest in the repo; next is ~53).
- `B4` — `forum.service.ts` (743 LOC) and `users.service.ts` (659 LOC) are the two broadest services (watch-item; peel off cohesive sub-services once B1/B3 land).
- `B5` — Complex logic without specs: `email-validation.service.ts` (332 LOC), `forum-events.service.ts` (SSE/Redis), `status.service.ts`.

**Frontend**
- `F1` — `MangaReader.tsx` — **1,749 lines**, 28 `useState`, 15 `useEffect`, carries the only `react-hooks/set-state-in-effect` suppressions. Owns captcha gating, chapter nav, zoom/pan gesture math, translation menu, language picker. The app's core reading surface, untested.
- `F2` — Modal enter/exit lifecycle (`mounted`/`visible` + double-`requestAnimationFrame` enter / `setTimeout` exit) is hand-rolled in **~13 files** with no shared hook — the exact CLAUDE.md gotcha, re-implemented each time. **Best effort-to-value ratio.**
- `F3` — `AccountModal.tsx` (1,383 LOC) — 4 tabs in one component, 3 `exhaustive-deps` suppressions.
- `F4` — `BookDetailModal.tsx` (1,279 LOC) — mixes coin-balance/unlock **payment** logic with presentation.
- `F5` — `studio/upload/page.tsx` (923 LOC) — largest page + the app's biggest `any` concentration (3).
- `F6` — Component/page test coverage is 0% (all 23 test files cover `lib`/`hooks` only).
- `F7` — Data-fetching inconsistency: 14 raw `fetch('/api/...')` vs 6 `apiFetch()`; standardize on `apiFetch` + `apiCache`.

## Solution

Ship in **four phases**, ordered *quick-wins → extraction → decomposition → coverage*, so value lands early and the highest-risk work (MangaReader) happens last, after the safe wins have built confidence. Each phase is independently mergeable; within a phase each task is a tiny commit leaving the app green.

- **Phase 1 — Backend quick wins (B1, B2):** small, high value, security-relevant.
- **Phase 2 — Frontend extraction (F2, then hook-extractions feeding F1/F3/F4):** the shared `useModalTransition` hook first (broad, low-risk), then extract testable logic out of the God components *before* splitting their JSX.
- **Phase 3 — Decomposition (B3, B4, F1, F3, F4, F5):** split the long function and God components, reusing the Phase-2 hooks.
- **Phase 4 — Coverage + consistency (B5, F6 via extracted hooks, F7):** fill the genuine test gaps and unify fetch usage.

---

## Commits

Each bullet is one tiny commit. **Run the relevant test suite + lint after every commit; do not proceed on red.** Benchmarks are not required here (no MIT/render change), but each behavior-preserving commit must show the existing suite still green.

### Phase 1 — Backend quick wins

**B1 · Extract shared image-storage validation (S)**
- [ ] Create `Backend/src/common/storage/image-mime.ts` exporting the single source of truth for `ALLOWED_IMAGE_MIME` + `MIME_TO_EXT` and a pure `extForMime(mime): string | null`. Unit-test it (`image-mime.spec.ts`). Commit.
- [ ] Create `saveValidatedImage(tempFilePath, keyPrefix): Promise<{ url; key }>` (a small `ImageStorageService`, or a helper in `common/storage`) encapsulating: magic-byte MIME check → `storage.put` → temp-file cleanup → typed error. Add a spec covering reject-on-bad-magic-bytes and cleanup-on-throw. Commit.
- [ ] Rewrite `forum.service.ts` `uploadImage` (L526) to call `saveValidatedImage`; delete its inline copy. Run `npx jest src/forum/forum.service.spec.ts --no-coverage`. Commit.
- [ ] Rewrite `forum.service.ts` `uploadBanner` (L481) to call `saveValidatedImage` (keeping the extra banner DB update at the call site). Commit.
- [ ] Rewrite `upload.service.ts` to consume the shared constants + helper; delete its duplicated `MIME_TO_EXT`/`ALLOWED_IMAGE_MIME`. Run upload specs. Commit.

**B2 · Move Turnstile verification out of the controller (S)**
- [ ] Add a `verify(token, remoteip): Promise<TurnstileOutcome>` method to the existing auth `TurnstileService` (typed `outcome`, no `any`). Spec the success/failure/malformed-response branches. Commit.
- [ ] Rewrite `books.controller.ts` `verifyCaptcha` (L32–77) to delegate to `TurnstileService`; type the request (drop `@Req() req: any`); replace all `console.error` (L~40, L235, L349) with the NestJS `Logger`. Run books controller/service specs. Commit.

### Phase 2 — Frontend extraction (testable seams first)

**F2 · Shared modal-transition hook (M — highest leverage)**
- [ ] Create `Frontend/app/hooks/useModalTransition.ts` → `{ mounted, visible, close }` implementing the CLAUDE.md-documented pattern (double-`requestAnimationFrame` enter, `setTimeout` exit keyed to the CSS duration). Add `useModalTransition.test.ts` (fake timers: enter sets visible after 2 frames; `close()` clears visible then unmounts after the timeout). Commit.
- [ ] Migrate modals **one per commit** to the hook, deleting the hand-rolled `mounted`/`visible` state each time: `ConfirmDialog`, `LoginModal`, `CoverLightbox`, `CountrySelect`, `StudioSelect`, `HeroCarousel`, `CommentThread`, `community/page.tsx`, `studio/account/page.tsx`, `AccountModal`, `BookDetailModal`, `AccountModal` sub-uses. (One small commit each; visually verify enter/exit still animates.)

**Extract testable logic from God components (feeds Phase 3)**
- [ ] Extract zoom/pan gesture math from `MangaReader.tsx` into `Frontend/app/hooks/useZoomPan.ts` (`updateZoom`, `getContinuousZoomAnchor`, `restoreContinuousZoomAnchor` as pure/near-pure functions). Add `useZoomPan.test.ts`. **No JSX change yet** — `MangaReader` just consumes the hook. This kills the `set-state-in-effect` suppressions if possible. Commit.
- [ ] Extract chapter-unlock/coin logic from `BookDetailModal.tsx` into `Frontend/app/hooks/useChapterUnlock.ts` (owns `handlePurchaseUnlock`, balance read). Add `useChapterUnlock.test.ts` (mock the `/api/proxy` unlock call; assert debit-then-unlock ordering and error paths). Commit.
- [ ] Type the 3 `any` sites in `studio/upload/page.tsx` and extract its upload-orchestration into `useStudioUpload.ts`. Add a hook test. Commit.

### Phase 3 — Decomposition (reuse Phase-2 hooks)

**B3 · Break up `getPublicProfile` (M)**
- [ ] Extract the secondary-query/aggregation steps of `getPublicProfile` (L215–367) into named private helpers (`#loadFavorites`, `#loadStats`, `#aggregateProfile`, …). Pure behavior preservation, guarded by `forum.service.spec.ts`. Commit.

**B4 · Peel cohesive sub-services (M, optional-but-in-scope)**
- [ ] Extract `ForumProfileService` (profile read + the now-shared upload helper) out of `forum.service.ts`; keep the public API stable via delegation. Run forum specs. Commit.
- [ ] Extract `UserHistoryService` (history + photo-history + avatar GC) out of `users.service.ts`. Run users specs. Commit.

**F1 · Split MangaReader (L — dedicated effort, do last)**
- [ ] Extract the captcha-gate into `<ReaderCaptchaGate>` wrapper. Commit.
- [ ] Extract `<ChapterPicker>` (language picker + chapter nav). Commit.
- [ ] Extract a presentational `<PageRenderer>` (page + continuous modes; the 4 raw `<img>` blocks). Commit.
- [ ] `MangaReader.tsx` becomes an orchestrator composing `useZoomPan` + the three children. Verify reading, zoom, captcha, translation menu manually. Commit.

**F3 · Split AccountModal (L)**
- [ ] Extract per-tab children (`ProfileTab`, `PasswordTab`, `AccountsTab`, `DangerTab`); hoist shared form state into a small reducer. Remove the 3 `exhaustive-deps` suppressions by fixing the underlying deps. Commit per tab.

**F4 · Split BookDetailModal (L/M)**
- [ ] Extract `<ChapterList>` consuming `useChapterUnlock`; leave `BookDetailModal` owning only detail-fetch + cover carousel/lightbox. Commit.

**F5 · Decompose upload page (M)**
- [ ] Split `studio/upload/page.tsx` into step components consuming `useStudioUpload`. Commit per step.

### Phase 4 — Coverage + consistency

**B5 · Backend spec gaps**
- [ ] Add `email-validation.service.spec.ts` (allow/warn/block + normalization). Commit.
- [ ] Add `forum-events.service.spec.ts` (SSE subject emits; Redis pub/sub fan-out) and `status.service.spec.ts`. Commit each.

**F6 · Frontend coverage via extracted hooks** — satisfied incrementally by the Phase-2/3 hook tests (`useModalTransition`, `useZoomPan`, `useChapterUnlock`, `useStudioUpload`). No standalone component tests.

**F7 · Fetch consistency (S/M)**
- [ ] Migrate the 14 raw `fetch('/api/...')` call sites to `apiFetch` + `apiCache` where caching/auth-header/retry semantics apply; leave streaming/SSE endpoints as-is. One small commit per file cluster.

---

## Decision Document

- **Scope:** Full — Backend (B1–B5) **and** Frontend (F1–F7). Confirmed by developer 2026-07-07.
- **Phasing:** quick-wins → extraction → decomposition → coverage. Highest-risk file (`MangaReader.tsx`) is decomposed **last**, only after its gesture math is extracted and tested.
- **No new runtime dependencies** and no schema/API-contract changes. Public HTTP endpoints and their request/response shapes are unchanged — this is internal grooming.
- **Backend modules built/modified:** new `common/storage/image-mime.ts` + `saveValidatedImage` helper (shared by `forum` + `upload`); `TurnstileService.verify` gains the captcha round-trip (moved out of `books.controller`); `forum.service` and `users.service` shed `ForumProfileService` / `UserHistoryService` behind stable public methods.
- **Frontend hooks built:** `useModalTransition`, `useZoomPan`, `useChapterUnlock`, `useStudioUpload`. Components become thin orchestrators over these hooks.
- **Interfaces (stable contracts):** `saveValidatedImage(tempFilePath, keyPrefix) → { url, key }`; `extForMime(mime) → string | null`; `TurnstileService.verify(token, remoteip) → TurnstileOutcome`; `useModalTransition() → { mounted, visible, close }`. Existing service public methods keep their signatures (delegation preserves them).
- **Logging:** stray `console.error` in `books.controller.ts` replaced by NestJS `Logger`, matching the rest of the codebase.
- **Behavior preservation gate:** every decomposition commit must keep the pre-existing suite green; no happy-path behavior change is permitted.

## Testing Decisions

- **What makes a good test here:** exercise *external behavior* through the extracted seam, not React internals. Test the **hook/module**, not the component tree. Prior art the tests must mirror: `Frontend/app/hooks/useTopupCreate` + `useTopupStream` tests and the `Frontend/app/lib/*.test.ts` suite (`bun:test`); Backend `forum.service.spec.ts` characterization style + `webhook`-style dependency-light units.
- **Modules that gain tests:** `image-mime`, `saveValidatedImage`, `TurnstileService.verify`, `email-validation.service`, `forum-events.service`, `status.service` (Backend, Jest); `useModalTransition`, `useZoomPan`, `useChapterUnlock`, `useStudioUpload` (Frontend, `bun:test`).
- **Deliberately NOT tested:** React components / pages directly (developer decision 2026-07-07 — "extract แล้ว test เฉพาะ hook"). Coverage rises because logic moves *into* testable hooks, not because we snapshot JSX.
- **Payment-sensitive path (`useChapterUnlock`):** must assert HWID + wallet-debit-then-unlock ordering and the error/rollback branches, since this touches coins.

## Out of Scope

- Any MIT (`MIT/`) change, and therefore the benchmark/PNG rule does not apply to this refactor.
- `dashboardv2/` (separate app) — untouched.
- `books/mangadex.service.ts` (778 LOC) and `mit-batch-orchestrator.service.ts` — large but cohesive and well-tested; left alone.
- The `as X` cast hardening (96 sites) — noted, not urgent; not part of this plan.
- Rewriting healthy layers: `lib/`, `hooks/` (existing), `AuthContext.tsx` core, `RedisService`/`StorageProvider`/`SupabaseService` abstractions.
- No GitHub issue is opened for now (developer chose file-based tracking); promote to an issue later if desired.

## Further Notes

- Ordering rationale: `F2` (modal hook) and `B1`/`B2` are the safest, highest-value commits — land them first to de-risk the phase and prove the extract-then-delete rhythm before touching `MangaReader`.
- Watch-items `B4` are genuinely optional; if `forum.service.ts`/`users.service.ts` feel tolerable after B1/B3, defer the service split rather than over-fragmenting (North Star: fewest moving parts).
- Notify the developer via `pwsh -NoProfile -File scripts/notify.ps1 -Message "..."` at the end of each phase (phase complete / needs a confirm before merge), per CLAUDE.md.
