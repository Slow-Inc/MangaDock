# PRD: Backend + Frontend Refactor (Grooming)

**Status:** Draft
**Author:** akkanop-x (via 2026-07-07 refactor assessment)
**Date:** 2026-07-07

> Companion implementation plan: `docs/superpowers/plans/2026-07-07-backend-frontend-refactor.md`

---

## Overview

The MangaDock NestJS Backend and Next.js Frontend are both structurally healthy (type safety tight, `@ts-ignore`=0, TODO/FIXME=0, no swallowed catches, strong `lib`/`hooks` test coverage), but a 2026-07-07 subagent assessment found bounded, concrete debt: security-sensitive duplication, business logic living inside an HTTP controller, one over-long function, and a handful of oversized "God components." This PRD scopes a **grooming** effort — behavior-preserving, no new dependencies, no schema/API-contract changes — that removes that debt and raises testability by extracting logic into small, unit-testable modules and hooks. This is explicitly **not a rewrite.**

---

## Goals

- Eliminate the duplicated, security-sensitive image-upload validation (magic-byte MIME check) so it exists in exactly one tested place.
- Move Turnstile captcha verification out of `books.controller` into the auth layer, removing the only `@Req() req: any` and the only stray `console.*` calls.
- Reduce the largest units to maintainable sizes: the 152-line `getPublicProfile` function and the God components (`MangaReader` 1,749 LOC, `AccountModal` 1,383, `BookDetailModal` 1,279, `studio/upload` 923).
- Introduce a single shared `useModalTransition` hook, replacing the modal enter/exit pattern hand-rolled across ~13 files.
- Raise test coverage of currently-untested complex logic by **extracting it into hooks/modules and testing those** (not by testing React components directly).
- Every change leaves the app working and the existing suites green (measurable: no red between commits).

## Non-goals

- No rewrite; no re-architecture of healthy layers (`lib/`, existing `hooks/`, `AuthContext` core, `RedisService`/`StorageProvider`/`SupabaseService`).
- No MIT (`MIT/`) changes — the benchmark/PNG rule does not apply to this work.
- No `dashboardv2/` changes (separate app).
- No changes to public HTTP endpoints or their request/response shapes.
- No direct React component/page unit tests (developer decision: extract → test the hook).
- Not touching cohesive-but-large `mangadex.service.ts` / `mit-batch-orchestrator.service.ts`, nor the 96 `as X` cast sites.

---

## User Stories

1. As a **backend maintainer**, I want image-upload validation in one shared helper so a security fix can't be missed in a second copy.
2. As a **backend maintainer**, I want Turnstile verification testable in the auth layer instead of inline in a controller, so I can unit-test success/failure/malformed-response branches.
3. As a **backend maintainer**, I want `getPublicProfile` broken into named helpers so I can change one aggregation step without reading 152 lines.
4. As a **frontend maintainer**, I want one `useModalTransition` hook so the documented modal-animation gotcha is impossible to re-violate.
5. As a **frontend maintainer**, I want the reader's zoom/pan math and the chapter-unlock/payment logic as tested hooks so I can change the reading and purchase flows with confidence.
6. As a **frontend maintainer**, I want `MangaReader`/`AccountModal`/`BookDetailModal`/`studio-upload` decomposed into focused children so edits are low-risk.
7. As a **QA/reviewer**, I want data-fetching unified on `apiFetch` + `apiCache` so auth-header/retry/caching behavior is uniform.
8. As a **developer on call**, I want every refactor commit to preserve behavior and keep the suite green, so a regression is caught immediately.

---

## Functional Requirements

### Backend — Upload (B1)
- FR-1: A single source of truth exports `ALLOWED_IMAGE_MIME`, `MIME_TO_EXT`, and `extForMime(mime) → string | null`.
- FR-2: A shared `saveValidatedImage(tempFilePath, keyPrefix) → { url, key }` encapsulates magic-byte validation → storage put → temp-file cleanup → typed error; used by `forum` (banner + image) and `upload`.
- FR-3: All inline duplicates of the constants/logic are deleted after migration.

### Backend — Turnstile (B2)
- FR-4: `TurnstileService.verify(token, remoteip) → TurnstileOutcome` performs the `siteverify` round-trip with a typed outcome.
- FR-5: `books.controller.verifyCaptcha` delegates to it; the request is typed (no `any`); all `console.error` become NestJS `Logger`.

### Backend — Decomposition (B3, B4)
- FR-6: `getPublicProfile` is split into named private helpers with behavior preserved.
- FR-7 (optional-in-scope): cohesive sub-services (`ForumProfileService`, `UserHistoryService`) are peeled off behind stable public method signatures via delegation.

### Backend — Coverage (B5)
- FR-8: `email-validation.service`, `forum-events.service`, and `status.service` gain Jest specs covering their real branches.

### Frontend — Modal hook (F2)
- FR-9: `useModalTransition() → { mounted, visible, close }` implements double-`requestAnimationFrame` enter + `setTimeout` exit; ~13 modals migrate to it and delete their hand-rolled state.

### Frontend — Extraction + Decomposition (F1, F3, F4, F5)
- FR-10: Reader zoom/pan math extracted to `useZoomPan` (tested); `MangaReader` split into captcha-gate, chapter-picker, and page-renderer children.
- FR-11: Chapter-unlock/coin logic extracted to `useChapterUnlock` (tested, asserts HWID + debit-then-unlock ordering + error/rollback); `BookDetailModal` split with a `<ChapterList>`.
- FR-12: `AccountModal` split per tab (profile/password/accounts/danger) with shared state via a small reducer; the 3 `exhaustive-deps` suppressions removed by fixing deps.
- FR-13: `studio/upload/page` decomposed into step components over a `useStudioUpload` hook; its 3 `any` sites typed.

### Frontend — Fetch consistency (F7)
- FR-14: Raw `fetch('/api/...')` call sites migrate to `apiFetch` + `apiCache` where caching/auth/retry apply; SSE/streaming endpoints stay as-is.

---

## Non-functional Requirements

- **Performance:** No happy-path regression; hot paths (reader render, unlock) unchanged in behavior. Extraction must not add re-renders (preserve `useMemo`/`useCallback` boundaries).
- **Security:** The magic-byte MIME validation is preserved exactly and centralized; captcha verification behavior is unchanged, only relocated.
- **Accessibility:** Modal migration must preserve existing focus/animation behavior (respect the CLAUDE.md spoiler-blur/modal gotchas).
- **Error handling:** No behavior change on the happy path; error/rollback branches in `useChapterUnlock` are explicitly tested. Backend logging moves to `Logger`.
- **Testability:** New hooks/modules are dependency-light and unit-tested (`bun:test` for Frontend, Jest for Backend).

---

## UX / UI Notes

This is internal grooming — **no visible UX change intended.**

- **Happy path:** Reader, modals, uploads, chapter unlock, profile pages behave identically before/after.
- **Modal enter/exit:** animation timing/curve unchanged after `useModalTransition` migration (visually verify each).
- **Error state:** unchanged for users; internally errors are logged (backend) / surfaced through the same UI paths (frontend).
- **Loading state:** unchanged.
- Regression signal is the existing suite plus the new hook tests — not new screens.

---

## Technical Notes

- **New backend modules:** `common/storage/image-mime.ts` + `saveValidatedImage` helper (shared by `forum` + `upload`); `TurnstileService.verify` absorbs the captcha round-trip from `books.controller`; `ForumProfileService` / `UserHistoryService` peeled from `forum.service` / `users.service` behind stable public methods.
- **New frontend hooks:** `useModalTransition`, `useZoomPan`, `useChapterUnlock`, `useStudioUpload`. Components become thin orchestrators over these hooks.
- **Stable contracts:** `saveValidatedImage(tempFilePath, keyPrefix) → { url, key }`; `extForMime(mime) → string | null`; `TurnstileService.verify(token, remoteip) → TurnstileOutcome`; `useModalTransition() → { mounted, visible, close }`. Existing service public method signatures preserved via delegation.
- **No new runtime dependencies. No schema/API-contract changes.**
- **Phasing (from the plan):** (1) Backend quick wins B1/B2 → (2) Frontend extraction F2 + hook-extractions → (3) Decomposition B3/B4/F1/F3/F4/F5 (MangaReader last) → (4) Coverage + consistency B5/F6/F7. Each task is one tiny commit leaving the app green.

---

## Success Metrics

- **Duplication:** magic-byte upload validation exists in exactly 1 place (was 3).
- **Controller cleanliness:** `books.controller` has 0 `console.*` and 0 `@Req() req: any` (was 4 / 1).
- **Function size:** no production function > ~80 lines (was 152 max).
- **Component size:** the four God components materially reduced; reader gesture math lives in a tested hook.
- **Modal pattern:** 1 shared hook; 0 hand-rolled `mounted`/`visible` copies remain.
- **Coverage:** new specs for `email-validation`, `forum-events`, `status` (backend) and the four new hooks (frontend); overall suite stays green across every commit.
- **Fetch:** raw `fetch('/api/...')` count reduced toward 0 (was 14) where caching/auth applies.

---

## Open Questions

- [ ] B4 (`ForumProfileService` / `UserHistoryService` split) is marked optional-in-scope — split now, or defer if the services feel tolerable after B1/B3?
- [ ] Land as one long-lived branch off `main`, or one branch per phase (4 PRs)?
- [ ] Any modal among the ~13 with bespoke timing that should be excluded from the `useModalTransition` migration?

---

## Tracking (GitHub Issues — `Slow-Inc/MangaDock`)

Created 2026-07-07 · [all issues](https://github.com/Slow-Inc/MangaDock/issues)

**Epic [#555](https://github.com/Slow-Inc/MangaDock/issues/555) — Backend Grooming (B1–B5)**
- B1 · Story [#557](https://github.com/Slow-Inc/MangaDock/issues/557) → Tasks [#568](https://github.com/Slow-Inc/MangaDock/issues/568) [#569](https://github.com/Slow-Inc/MangaDock/issues/569) [#570](https://github.com/Slow-Inc/MangaDock/issues/570) [#571](https://github.com/Slow-Inc/MangaDock/issues/571)
- B2 · Story [#558](https://github.com/Slow-Inc/MangaDock/issues/558) → Tasks [#572](https://github.com/Slow-Inc/MangaDock/issues/572) [#573](https://github.com/Slow-Inc/MangaDock/issues/573)
- B3 · Story [#559](https://github.com/Slow-Inc/MangaDock/issues/559) → Task [#574](https://github.com/Slow-Inc/MangaDock/issues/574)
- B4 · Story [#560](https://github.com/Slow-Inc/MangaDock/issues/560) _(blocked by #557, #559)_ → Tasks [#575](https://github.com/Slow-Inc/MangaDock/issues/575) [#576](https://github.com/Slow-Inc/MangaDock/issues/576)
- B5 · Story [#561](https://github.com/Slow-Inc/MangaDock/issues/561) → Tasks [#577](https://github.com/Slow-Inc/MangaDock/issues/577) [#578](https://github.com/Slow-Inc/MangaDock/issues/578)

**Epic [#556](https://github.com/Slow-Inc/MangaDock/issues/556) — Frontend Grooming (F1–F7)**
- F2 · Story [#562](https://github.com/Slow-Inc/MangaDock/issues/562) → Tasks [#579](https://github.com/Slow-Inc/MangaDock/issues/579) [#580](https://github.com/Slow-Inc/MangaDock/issues/580)
- F1 · Story [#563](https://github.com/Slow-Inc/MangaDock/issues/563) _(blocked by #562)_ → Tasks [#581](https://github.com/Slow-Inc/MangaDock/issues/581) [#582](https://github.com/Slow-Inc/MangaDock/issues/582)
- F4 · Story [#564](https://github.com/Slow-Inc/MangaDock/issues/564) _(blocked by #562)_ → Tasks [#583](https://github.com/Slow-Inc/MangaDock/issues/583) [#584](https://github.com/Slow-Inc/MangaDock/issues/584)
- F3 · Story [#565](https://github.com/Slow-Inc/MangaDock/issues/565) _(blocked by #562)_ → Task [#585](https://github.com/Slow-Inc/MangaDock/issues/585)
- F5 · Story [#566](https://github.com/Slow-Inc/MangaDock/issues/566) → Task [#586](https://github.com/Slow-Inc/MangaDock/issues/586)
- F7 · Story [#567](https://github.com/Slow-Inc/MangaDock/issues/567) → Task [#587](https://github.com/Slow-Inc/MangaDock/issues/587)

_F6 (component coverage) has no separate issue — satisfied by the hook tests in #562/#563/#564._

---

---

# PRD (ฉบับภาษาไทย): Refactor Backend + Frontend (Grooming)

**สถานะ:** Draft
**ผู้เขียน:** akkanop-x (จากผลประเมิน refactor วันที่ 2026-07-07)
**วันที่:** 2026-07-07

> แผน implementation คู่กัน: `docs/superpowers/plans/2026-07-07-backend-frontend-refactor.md`

---

## ภาพรวม

Backend (NestJS) และ Frontend (Next.js) ของ MangaDock **สุขภาพดีเชิงโครงสร้าง** (type-safety แน่น, `@ts-ignore`=0, TODO/FIXME=0, ไม่มี swallowed catch, test ฝั่ง `lib`/`hooks` ครอบคลุมดี) แต่ผลประเมินโดย subagent วันที่ 2026-07-07 พบหนี้ทางเทคนิคที่ชัดเจนและมีขอบเขต: โค้ด validate ที่ไวต่อความปลอดภัยซ้ำกัน, business logic ฝังอยู่ใน HTTP controller, ฟังก์ชันยาวเกินหนึ่งตัว และ "God component" ก้อนใหญ่ไม่กี่ตัว PRD นี้กำหนดขอบเขตงาน **grooming** — คงพฤติกรรมเดิม, ไม่เพิ่ม dependency, ไม่เปลี่ยน schema/API-contract — ที่ลบหนี้เหล่านั้นและเพิ่ม testability ด้วยการดึง logic ออกเป็น module/hook เล็ก ๆ ที่ unit-test ได้ **ยืนยันว่าไม่ใช่การ rewrite**

---

## เป้าหมาย

- ลบโค้ด validate การอัปโหลดรูป (magic-byte MIME) ที่ซ้ำและไวต่อความปลอดภัย ให้เหลือที่เดียวที่มี test
- ย้าย Turnstile captcha verification ออกจาก `books.controller` เข้า auth layer ลบ `@Req() req: any` ตัวเดียว และ `console.*` ที่หลงเหลือทั้งหมด
- ลดขนาดหน่วยที่ใหญ่สุด: ฟังก์ชัน `getPublicProfile` 152 บรรทัด และ God components (`MangaReader` 1,749, `AccountModal` 1,383, `BookDetailModal` 1,279, `studio/upload` 923)
- สร้าง hook กลาง `useModalTransition` แทน pattern modal enter/exit ที่เขียนมือซ้ำ ~13 ไฟล์
- เพิ่ม test coverage ของ logic ซับซ้อนที่ยังไม่มี test ด้วยการ **ดึงออกเป็น hook/module แล้ว test ตัวนั้น** (ไม่ test React component ตรง ๆ)
- ทุกการเปลี่ยนแปลงต้องทำให้ app ยังทำงานได้ และ suite เดิมผ่าน (วัดได้: ไม่มี red ระหว่าง commit)

## สิ่งที่ไม่ทำ (Non-goals)

- ไม่ rewrite; ไม่ปรับสถาปัตยกรรมของ layer ที่สุขภาพดี (`lib/`, `hooks/` เดิม, core ของ `AuthContext`, `RedisService`/`StorageProvider`/`SupabaseService`)
- ไม่แตะ MIT (`MIT/`) — กฎ benchmark/PNG ไม่มีผลกับงานนี้
- ไม่แตะ `dashboardv2/` (app แยก)
- ไม่เปลี่ยน public HTTP endpoint หรือรูปแบบ request/response
- ไม่เขียน unit test ให้ React component/page ตรง ๆ (มติผู้พัฒนา: extract → test hook)
- ไม่แตะ `mangadex.service.ts` / `mit-batch-orchestrator.service.ts` ที่ใหญ่แต่ cohesive และ 96 จุด cast `as X`

---

## User Stories

1. ในฐานะ **backend maintainer** ฉันต้องการ validate การอัปโหลดรูปใน helper เดียว เพื่อให้ security fix ไม่ตกหล่นในสำเนาที่สอง
2. ในฐานะ **backend maintainer** ฉันต้องการ Turnstile verification ที่ test ได้ใน auth layer แทนที่จะฝังใน controller เพื่อ unit-test branch success/failure/malformed
3. ในฐานะ **backend maintainer** ฉันต้องการให้ `getPublicProfile` แตกเป็น helper ที่มีชื่อ เพื่อแก้ step เดียวโดยไม่ต้องอ่าน 152 บรรทัด
4. ในฐานะ **frontend maintainer** ฉันต้องการ hook `useModalTransition` ตัวเดียว เพื่อให้ gotcha เรื่อง modal animation ที่ documented ไว้ละเมิดซ้ำไม่ได้อีก
5. ในฐานะ **frontend maintainer** ฉันต้องการ math ของ zoom/pan และ logic chapter-unlock/payment เป็น hook ที่ test ได้ เพื่อแก้ flow การอ่านและการซื้ออย่างมั่นใจ
6. ในฐานะ **frontend maintainer** ฉันต้องการให้ `MangaReader`/`AccountModal`/`BookDetailModal`/`studio-upload` แตกเป็น child ที่โฟกัส เพื่อให้แก้ไขเสี่ยงต่ำ
7. ในฐานะ **QA/reviewer** ฉันต้องการให้ data-fetching รวมศูนย์ที่ `apiFetch` + `apiCache` เพื่อให้พฤติกรรม auth-header/retry/caching สม่ำเสมอ
8. ในฐานะ **developer on call** ฉันต้องการให้ทุก commit ของ refactor คงพฤติกรรมและ suite เขียว เพื่อจับ regression ได้ทันที

---

## Functional Requirements

### Backend — Upload (B1)
- FR-1: มีแหล่งความจริงเดียว export `ALLOWED_IMAGE_MIME`, `MIME_TO_EXT`, และ `extForMime(mime) → string | null`
- FR-2: helper กลาง `saveValidatedImage(tempFilePath, keyPrefix) → { url, key }` ห่อ validate magic-byte → storage put → cleanup temp → typed error; ใช้โดย `forum` (banner + image) และ `upload`
- FR-3: ลบสำเนา constants/logic ที่ inline หลัง migrate

### Backend — Turnstile (B2)
- FR-4: `TurnstileService.verify(token, remoteip) → TurnstileOutcome` ทำ `siteverify` round-trip พร้อม outcome ที่ typed
- FR-5: `books.controller.verifyCaptcha` delegate ไปที่ service; request typed (ไม่มี `any`); `console.error` ทั้งหมดเป็น NestJS `Logger`

### Backend — Decomposition (B3, B4)
- FR-6: `getPublicProfile` แตกเป็น private helper ที่มีชื่อ คงพฤติกรรมเดิม
- FR-7 (optional-in-scope): peel sub-service ที่ cohesive (`ForumProfileService`, `UserHistoryService`) ออก หลัง public method signature เดิมด้วย delegation

### Backend — Coverage (B5)
- FR-8: `email-validation.service`, `forum-events.service`, `status.service` ได้ Jest spec ครอบคลุม branch จริง

### Frontend — Modal hook (F2)
- FR-9: `useModalTransition() → { mounted, visible, close }` ทำ double-`requestAnimationFrame` enter + `setTimeout` exit; modal ~13 ตัว migrate มาใช้และลบ state ที่เขียนมือ

### Frontend — Extraction + Decomposition (F1, F3, F4, F5)
- FR-10: ดึง math zoom/pan ของ reader เป็น `useZoomPan` (มี test); แตก `MangaReader` เป็น child captcha-gate, chapter-picker, page-renderer
- FR-11: ดึง logic chapter-unlock/coin เป็น `useChapterUnlock` (มี test, assert ลำดับ HWID + debit-then-unlock + error/rollback); แตก `BookDetailModal` ด้วย `<ChapterList>`
- FR-12: แตก `AccountModal` ตาม tab (profile/password/accounts/danger) พร้อม state ร่วมผ่าน reducer เล็ก; ลบ suppression `exhaustive-deps` 3 จุดด้วยการแก้ deps
- FR-13: แตก `studio/upload/page` เป็น step components บน hook `useStudioUpload`; type จุด `any` 3 จุด

### Frontend — Fetch consistency (F7)
- FR-14: migrate จุดที่ใช้ raw `fetch('/api/...')` ไปที่ `apiFetch` + `apiCache` ตรงที่ caching/auth/retry มีผล; endpoint SSE/streaming คงเดิม

---

## Non-functional Requirements

- **Performance:** ไม่มี regression บน happy path; hot path (reader render, unlock) พฤติกรรมไม่เปลี่ยน; extraction ต้องไม่เพิ่ม re-render (คง boundary `useMemo`/`useCallback`)
- **Security:** คง magic-byte MIME validation ให้เป๊ะและรวมศูนย์; พฤติกรรม captcha ไม่เปลี่ยน แค่ย้ายที่
- **Accessibility:** การ migrate modal ต้องคง focus/animation เดิม (เคารพ gotcha spoiler-blur/modal ใน CLAUDE.md)
- **Error handling:** ไม่เปลี่ยนพฤติกรรม happy path; branch error/rollback ใน `useChapterUnlock` ถูก test ชัดเจน; logging ฝั่ง backend ย้ายไป `Logger`
- **Testability:** hook/module ใหม่ dependency น้อยและ unit-test ได้ (`bun:test` ฝั่ง Frontend, Jest ฝั่ง Backend)

---

## UX / UI Notes

งาน grooming ภายใน — **ไม่ตั้งใจให้ UX เปลี่ยนที่มองเห็นได้**

- **Happy path:** reader, modal, upload, chapter unlock, หน้า profile ทำงานเหมือนเดิมก่อน/หลัง
- **Modal enter/exit:** timing/curve เหมือนเดิมหลัง migrate `useModalTransition` (verify ด้วยตาแต่ละตัว)
- **Error state:** ผู้ใช้ไม่เห็นความต่าง; ภายใน error ถูก log (backend) / ผ่าน UI path เดิม (frontend)
- **Loading state:** เหมือนเดิม
- สัญญาณ regression คือ suite เดิม + hook test ใหม่ — ไม่ใช่หน้าจอใหม่

---

## Technical Notes

- **module backend ใหม่:** `common/storage/image-mime.ts` + helper `saveValidatedImage` (ใช้ร่วม `forum` + `upload`); `TurnstileService.verify` ดูด captcha round-trip จาก `books.controller`; peel `ForumProfileService` / `UserHistoryService` จาก `forum.service` / `users.service` หลัง public method เดิม
- **hook frontend ใหม่:** `useModalTransition`, `useZoomPan`, `useChapterUnlock`, `useStudioUpload`; component กลายเป็น orchestrator บาง ๆ บน hook เหล่านี้
- **contract คงที่:** `saveValidatedImage(...) → { url, key }`; `extForMime(mime) → string | null`; `TurnstileService.verify(...) → TurnstileOutcome`; `useModalTransition() → { mounted, visible, close }`; signature public method เดิมคงไว้ด้วย delegation
- **ไม่มี runtime dependency ใหม่ ไม่เปลี่ยน schema/API-contract**
- **การแบ่ง phase:** (1) Backend quick wins B1/B2 → (2) Frontend extraction F2 + hook extraction → (3) Decomposition B3/B4/F1/F3/F4/F5 (MangaReader ท้ายสุด) → (4) Coverage + consistency B5/F6/F7; แต่ละ task = 1 tiny commit ที่ app ยังเขียว

---

## Success Metrics

- **Duplication:** magic-byte upload validation เหลือ 1 ที่ (จาก 3)
- **Controller cleanliness:** `books.controller` มี `console.*` 0 และ `@Req() req: any` 0 (จาก 4 / 1)
- **Function size:** ไม่มีฟังก์ชัน production > ~80 บรรทัด (จากสูงสุด 152)
- **Component size:** God component 4 ตัวลดขนาดชัดเจน; gesture math ของ reader อยู่ใน hook ที่ test ได้
- **Modal pattern:** hook กลาง 1 ตัว; ไม่เหลือสำเนา `mounted`/`visible` ที่เขียนมือ
- **Coverage:** spec ใหม่ของ `email-validation`, `forum-events`, `status` (backend) และ hook ใหม่ 4 ตัว (frontend); suite เขียวทุก commit
- **Fetch:** จำนวน raw `fetch('/api/...')` ลดเข้าหา 0 (จาก 14) ตรงที่ caching/auth มีผล

---

## Open Questions

- [ ] B4 (`ForumProfileService` / `UserHistoryService`) เป็น optional-in-scope — แตกตอนนี้ หรือเลื่อนถ้า service ยังพอรับได้หลัง B1/B3?
- [ ] ทำเป็น branch เดียวยาวจาก `main` หรือ branch ต่อ phase (4 PR)?
- [ ] มี modal ตัวไหนใน ~13 ที่ timing พิเศษ ควรยกเว้นจากการ migrate `useModalTransition`?

---

## การติดตามงาน (GitHub Issues — `Slow-Inc/MangaDock`)

สร้างเมื่อ 2026-07-07 · [issue ทั้งหมด](https://github.com/Slow-Inc/MangaDock/issues)

**Epic [#555](https://github.com/Slow-Inc/MangaDock/issues/555) — Backend Grooming (B1–B5)**
- B1 · Story [#557](https://github.com/Slow-Inc/MangaDock/issues/557) → Task [#568](https://github.com/Slow-Inc/MangaDock/issues/568) [#569](https://github.com/Slow-Inc/MangaDock/issues/569) [#570](https://github.com/Slow-Inc/MangaDock/issues/570) [#571](https://github.com/Slow-Inc/MangaDock/issues/571)
- B2 · Story [#558](https://github.com/Slow-Inc/MangaDock/issues/558) → Task [#572](https://github.com/Slow-Inc/MangaDock/issues/572) [#573](https://github.com/Slow-Inc/MangaDock/issues/573)
- B3 · Story [#559](https://github.com/Slow-Inc/MangaDock/issues/559) → Task [#574](https://github.com/Slow-Inc/MangaDock/issues/574)
- B4 · Story [#560](https://github.com/Slow-Inc/MangaDock/issues/560) _(blocked by #557, #559)_ → Task [#575](https://github.com/Slow-Inc/MangaDock/issues/575) [#576](https://github.com/Slow-Inc/MangaDock/issues/576)
- B5 · Story [#561](https://github.com/Slow-Inc/MangaDock/issues/561) → Task [#577](https://github.com/Slow-Inc/MangaDock/issues/577) [#578](https://github.com/Slow-Inc/MangaDock/issues/578)

**Epic [#556](https://github.com/Slow-Inc/MangaDock/issues/556) — Frontend Grooming (F1–F7)**
- F2 · Story [#562](https://github.com/Slow-Inc/MangaDock/issues/562) → Task [#579](https://github.com/Slow-Inc/MangaDock/issues/579) [#580](https://github.com/Slow-Inc/MangaDock/issues/580)
- F1 · Story [#563](https://github.com/Slow-Inc/MangaDock/issues/563) _(blocked by #562)_ → Task [#581](https://github.com/Slow-Inc/MangaDock/issues/581) [#582](https://github.com/Slow-Inc/MangaDock/issues/582)
- F4 · Story [#564](https://github.com/Slow-Inc/MangaDock/issues/564) _(blocked by #562)_ → Task [#583](https://github.com/Slow-Inc/MangaDock/issues/583) [#584](https://github.com/Slow-Inc/MangaDock/issues/584)
- F3 · Story [#565](https://github.com/Slow-Inc/MangaDock/issues/565) _(blocked by #562)_ → Task [#585](https://github.com/Slow-Inc/MangaDock/issues/585)
- F5 · Story [#566](https://github.com/Slow-Inc/MangaDock/issues/566) → Task [#586](https://github.com/Slow-Inc/MangaDock/issues/586)
- F7 · Story [#567](https://github.com/Slow-Inc/MangaDock/issues/567) → Task [#587](https://github.com/Slow-Inc/MangaDock/issues/587)

_F6 (component coverage) ไม่มี issue แยก — ครอบด้วย hook test ใน #562/#563/#564_
