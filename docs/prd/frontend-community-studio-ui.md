# PRD: Frontend Community & Studio UI Improvements

**Status:** Draft  
**Author:** akkanop-x  
**Date:** 2026-07-02

---

## Overview

A UI audit of the Frontend app (Next.js, port 4000) surfaced 20 issues across the Community and Studio sections — ranging from user-facing bugs (stale form state, silent fetch errors, OS-native confirm dialogs) to maintenance risks (category list duplicated in three places, three independent caches for the same version data) to accessibility gaps (inaccessible SVG charts, mobile drawer without focus trap). These fixes harden existing flows without adding new features.

---

## Goals

- Community fetch failures show actionable toast messages — users can distinguish "API error" from "empty category"
- Create-post form clears fully on close in both Community feed and per-manga community pages
- Studio delete confirmation uses the app's design system (no OS `window.confirm()`)
- SVG charts in Studio are readable by screen readers (`role="img"` + `<title>`)
- Category list defined once in `forumCategories.ts` — one change adds a new category everywhere
- `getMyVersions()` result cached at one shared key — invalidation is coherent across pages

## Non-goals

- Mobile URL routing for Studio sub-views (S1) — architectural change requiring router refactor; tracked separately
- New Studio analytics features or new pages
- Backend changes of any kind
- i18n infrastructure — Thai copy is hardcoded (matching existing pattern)

---

## User Stories

1. As a **community reader**, I want to see a toast error when the API fails so I know it's a network problem, not an empty category.
2. As a **community user on mobile**, I want the view mode to update correctly when I rotate my device.
3. As a **community poster**, I want my draft to be cleared when I close the create-post modal so I don't see stale text when I reopen it.
4. As a **community poster**, I want the same create-post experience regardless of whether I'm on the main feed or a manga's community page.
5. As a **keyboard user**, I want the community mobile drawer to trap focus and close on Escape.
6. As a **screen reader user**, I want Studio charts to announce what they represent rather than reading raw SVG coordinates.
7. As a **translator**, I want a styled confirmation dialog when deleting a chapter — not the browser's grey OS dialog.
8. As a **developer**, I want the category list defined once so adding a new category requires editing one file.
9. As a **developer**, I want Studio's version data cached at one key so cache invalidation works correctly across all Studio pages.

---

## Functional Requirements

### Community — Correctness

- FR-1: `useIsMobile()` hook (already used in Studio) replaces the one-shot `window.innerWidth < 768` check in `community/page.tsx:68` and `community/manga/[mangaId]/page.tsx:69`; view mode responds to device changes.
- FR-2: `closeModal` in both community pages resets `newPost` to `{ title: "", content: "", category: "general" }` and `selectedManga` to `null` in addition to clearing `postImages`.
- FR-3: `CreatePostModal` is extracted to `app/community/components/CreatePostModal.tsx` and used by both pages; the duplicated modal state machine and JSX are removed from both pages.

### Community — Maintainability

- FR-4: `forumCategories.ts` exports `CATEGORY_LIST: readonly ForumCategory[]` (the existing private `ALL_CATEGORIES`). The mobile category strip in `community/page.tsx:195` and `community/manga/[mangaId]/page.tsx:244` uses this export instead of hardcoded arrays; `ForumSideMenu.tsx:31` also migrates.

### Community — Error Handling

- FR-5: `fetchPosts` error path in `community/page.tsx` and `getTrendingManga` error path in `community/trending/page.tsx` call `useToast` with `type: "error"` and a Thai message instead of `console.error`.
- FR-6: Both community pages are wrapped in a `CommunityErrorBoundary` (`app/community/components/CommunityErrorBoundary.tsx`) that renders a Thai error card with a reload button instead of the raw Next.js error page.
- FR-7: `trending/page.tsx` fetch is wrapped in an `AbortController`; cleanup cancels in-flight requests on unmount. Result is cached via `apiCache` with `TTL.MEDIUM` (5 min).

### Community — Accessibility & Polish

- FR-8: Mobile drawer in `community/layout.tsx` gains `role="dialog"`, `aria-modal="true"`, `aria-label="เมนู"`. On open: focus moves to the first interactive element inside. `keydown` listener on the overlay closes on Escape.
- FR-9: `ForumSideMenu` "See All Communities" button gets `onClick` navigating to `/community/trending`.
- FR-10: `ForumSideMenu` community rules strings (`"Respect others"`, `"No spoilers"`, `"No spam"`) replaced with Thai: `"เคารพซึ่งกันและกัน"`, `"ไม่สปอย"`, `"ไม่สแปม"`.

### Studio — Correctness

- FR-11: `ConfirmDialog` component added to `app/studio/components/ConfirmDialog.tsx` — modal with confirm/cancel buttons matching Studio's dark design language. `window.confirm()` in `studio/manga/[titleId]/page.tsx:368` replaced with this component.
- FR-12: `CoverImage` component extracted to `app/studio/components/CoverImage.tsx` with unified props `{ src: string; alt: string; className?: string; fallbackSize?: number }`. Both inline definitions in `studio/manga/[titleId]/page.tsx:235` and `studio/works/page.tsx:71` are replaced with this shared component.
- FR-13: `getMyVersions()` result is cached at a single key `"studio:versions"` via `studioCache`. The raw `localStorage` access in `studio/manga/[titleId]/page.tsx:270` is removed and replaced with `studioCache`.

### Studio — Accessibility & Polish

- FR-14: `LineChart`, `GroupedBarChart`, `DonutChart`, `HorizontalBreakdownChart` in `StudioDashboardWidgets.tsx` each gain `role="img"` on the `<svg>` and a `<title>` child element with a descriptive Thai label.
- FR-15: Mobile hero description strings in `studio/page.tsx:174` and `studio/works/page.tsx:301` are replaced with user-facing Thai copy (not developer rationale).
- FR-16: The two `eslint-disable-next-line react-hooks/exhaustive-deps` suppressions in `studio/upload/page.tsx:451` and `:543` are resolved by stabilising dependencies (moving values into refs or restructuring callbacks).

---

## Non-functional Requirements

- **Dependencies:** No new npm packages. All changes use existing hooks, contexts, and utilities.
- **Type safety:** `tsc --noEmit` passes after each task.
- **Lint:** `bun lint` passes after each task.
- **Language:** All user-visible strings Thai (matching existing pattern).
- **Tests:** New utility exports (`CATEGORY_LIST`, `CommunityErrorBoundary`) have unit tests in `*.test.ts` files.

---

## UX / UI Notes

- **Create-post modal:** Animation (slide + fade) stays as-is on main feed; the manga community page modal should match this animation after extraction.
- **ConfirmDialog (Studio):** Dark background overlay, white/red confirm button, cancel button. Shows the chapter number being deleted. Loading spinner on confirm button while delete is in-flight.
- **Error toast (Community):** Standard `useToast` call — same pattern as Studio. Type `"error"`, duration 4000ms, Thai message "โหลดโพสต์ไม่สำเร็จ กรุณาลองใหม่".
- **CommunityErrorBoundary:** Shows a card with "เกิดข้อผิดพลาด" heading and "โหลดใหม่" button that calls `window.location.reload()`.
- **SVG chart titles:** Each chart gets a single `<title>` describing the metric, e.g. `"กราฟยอดวิวรายวัน"`, `"กราฟรายได้"`.

---

## Technical Notes

- `useIsMobile` is at `Frontend/app/hooks/useIsMobile.ts` — already used by all Studio pages.
- `apiCache` with `TTL.MEDIUM` is at `Frontend/app/lib/apiCache.ts` — used by community pages for other data already.
- `studioCache` (`getCached`/`setCache`) is at `Frontend/app/lib/studioCache.ts` — used by `studio/page.tsx` and `works/page.tsx` already.
- `useToast` / `showToast` is from `Frontend/app/contexts/ToastContext.tsx` — used throughout Studio.
- `CreatePostModal` props: `{ isOpen: boolean; isVisible: boolean; onClose: () => void; onSubmit: (post, manga, images) => Promise<void>; userRole: string | null | undefined; defaultMangaId?: string }`. The two scroll refs (`modalScrollRef`) move inside the component.
- `ConfirmDialog` props: `{ open: boolean; title: string; onConfirm: () => Promise<void>; onCancel: () => void }`. Uses the existing modal animation pattern (double `requestAnimationFrame` enter, `setTimeout` exit).
- `CoverImage` unified props: `{ src: string; alt: string; className?: string; fallbackSize?: number }`. The probe pattern (hidden `Image` object checking naturalWidth) stays intact.

---

## Success Metrics

- Zero `console.error` calls in community fetch paths — all errors surface as toast notifications
- Create-post modal opens with empty fields every time (verified manually)
- Studio delete uses `ConfirmDialog` — `window.confirm` gone from codebase
- `grep -r "window.innerWidth" Frontend/app/community` returns no results
- `CATEGORY_LIST` export used in all 3 locations — `grep "hardcoded" community` returns nothing
- `bun lint && tsc --noEmit` green on `feat/frontend-ui` branch

---

## Open Questions

- [ ] Should `CreatePostModal` also be used by the profile page (`community/profile/[uid]/page.tsx`) if it gains a "create post" affordance in the future?
- [ ] Should `ConfirmDialog` be generalised to a shared `app/components/ConfirmDialog.tsx` (usable by non-studio pages), or stay scoped to Studio for now?
- [ ] S1 (mobile URL routing for Studio sub-views) — schedule for next sprint or leave as known limitation?
