# MangaReader split — design spec (#582)

- **Issue:** [#582] Split MangaReader into captcha-gate / ChapterPicker / PageRenderer (parent story #563)
- **Date:** 2026-07-08
- **Scope chosen:** "Follow the issue **+ consolidate the viewport**" — extract the three children the issue names, and additionally fold zoom/pan + continuous-mode + page-tracking (the shared-ref cluster, scrutinize N1) into a single owning unit. *Not* extracting pure chapter-nav logic into a separately-tested module (that was the wider scope we declined) and *not* adding new test surface beyond what already exists.
- **Approach chosen:** Approach 1 — a hook owns the viewport; the three children are purely presentational.

---

## 1. Problem

`Frontend/app/components/MangaReader.tsx` is a single 1557-LOC function component: 22 `useState`, 16 `useRef`, 11 `useEffect`, 5 `eslint-disable`. Translation, chapter-list fetch, zoom/pan, and modal-transition are already extracted as hooks (`useChapterTranslation`, `useChapters`, `useZoomPan`, `useModalTransition`). What remains inline is the Turnstile/captcha gate, the chapter-nav derivations, the chapter-picker modal, the page render (paged + continuous, four `<img>` blocks), the toolbars, and the global keyboard/wheel handlers.

The hard coupling — and the reason a naive "move the JSX out" split is not enough — is the **viewport**: six refs (`continuousModeRef`, `scrollContainerRef`, `continuousContentRef`, `continuousLenisRef`, `pageRefs`) plus the `syncContinuousPageFromViewport` callback are shared between `useZoomPan` and the continuous-mode logic (`useLocalLenis`, the IntersectionObserver that tracks the visible page, the zoom-resync-on-mode-toggle effect). Zoom and continuous scrolling are one concern: *how the page images are displayed, zoomed, scrolled, and which page is current.* `useZoomPan` today takes those six refs + `page` + the sync callback as inputs and returns transforms + refs — a leaky boundary flagged in the earlier scrutinize (N1).

## 2. Target structure

```
Frontend/app/hooks/
  useReaderCaptcha.ts      (new)  captcha token state + reset
  useReaderViewport.ts     (new)  zoom/pan + continuous + page-tracking; composes useZoomPan
  useZoomPan.ts            (unchanged — composed, not rewritten → its tests stay green)
Frontend/app/components/reader/
  ReaderCaptchaGate.tsx    (new)  presentational Turnstile overlay / gate
  PageRenderer.tsx         (new)  presentational; the four <img> blocks
  ChapterPicker.tsx        (new)  presentational picker modal
Frontend/app/components/
  MangaReader.tsx          (orchestrator; 1557 → ~450 LOC)
```

New presentational reader sub-components live under `components/reader/`; the two new hooks sit beside the existing ones in `hooks/`.

## 3. Units and interfaces

Each unit answers *what does it do, how do you use it, what does it depend on* on its own.

### `useReaderCaptcha` (hook)
- **Owns:** `clearanceToken`, `turnstilePassed`, `turnstileExiting` state; lazy-initialised from `localStorage.getItem("cf_clearance_token")` (preserves the current no-hydration-flash behaviour).
- **Returns:** `{ clearanceToken, turnstilePassed, turnstileExiting, setTurnstileExiting, onVerify(token), resetCaptcha }`.
  - `onVerify(token)` → persist to localStorage, set token, set passed.
  - `resetCaptcha()` → remove localStorage key, clear token, set passed=false (the shared recovery used by both the page-fetch 401 path and the translate 401 path, #227).

### `useReaderViewport` (hook)
- **Inputs:** `{ page, setPage, data, continuousMode }`.
- **Owns:** the six viewport refs (`continuousModeRef`, `scrollContainerRef`, `continuousContentRef`, `continuousLenisRef`, `pageRefs`), the continuous `useLocalLenis(scrollContainerRef, …)` wiring, `syncContinuousPageFromViewport`, the IntersectionObserver effect that tracks the visible page in continuous mode, the `continuousModeRef` sync effect, and the zoom-resync-on-continuous-toggle effect. **Composes `useZoomPan` internally** (passes it the owned refs) rather than reimplementing it, so `useZoomPan` and its pure-function tests are untouched.
- **Returns:** `{ zoom, isDragging, zoomIn, zoomOut, zoomReset, resetZoomAndPan, isZoomingRef, continuousLenisRef, refs: { zoomWrapperRef, zoomRef, scrollContainerRef, continuousContentRef, pageRefs } }`.

### `ReaderCaptchaGate` (component, presentational)
- **Props:** `{ passed, siteKey, exiting, onVerify, children }`.
- Renders the Turnstile modal overlay while `!passed` (with the existing enter/exit animation driven by `exiting`); renders `children` otherwise — matching the exact current render/animation.

### `PageRenderer` (component, presentational)
- **Props:** the viewport bundle (`refs`, `zoom`, `isDragging`) + `{ data, page, continuousMode, useSaver, showTranslation, translatedPages, patchedPages, completedTranslatedPages, translatingCurrentPageIndex, imgLoading, setImgLoading }`.
- Renders the four `<img>` blocks (paged original/translated, continuous original/translated), attaches `pageRefs`, `continuousContentRef`, and the zoom refs, applies the zoom transform, and picks each `src` (saver vs full, translated vs original). No business logic — given the props, the output is determined.

### `ChapterPicker` (component, presentational)
- **Props:** `{ mounted, visible, langFilter, setLangFilter, chapterList, currentChapterId, onSelect, onClose, refs: { pickerRef, pickerScrollRef, activeChapterBtnRef } }`.
- Renders the picker modal (language tabs + chapter list) from the `useModalTransition` `mounted`/`visible` flags passed in. The "scroll to active chapter on open / lang-filter change" effect moves inside this component (it is picker-internal).

### `MangaReader` (orchestrator)
- Composes `useReaderCaptcha`, `useChapters`, the inline **chapter-nav derivations** (`sameLangList`, `otherLangNextMap`, prev/next, `maxMainChapter`/counter — kept inline because they are shared by the picker, the end-of-chapter banner, and the toolbar), `useReaderViewport`, `useChapterTranslation`.
- Owns the **data-fetch effect** (page fetch with the `x-captcha-clearance` header and the 401 → `resetCaptcha` recovery), the page/menu/mode state, and the **global keyboard/wheel handlers** — these stay in the orchestrator because they must coordinate the picker, close, zoom, and continuous-scroll at once; they *call* `viewport.zoomIn()`/`zoomOut()` and read `viewport.continuousLenisRef` / `viewport.isZoomingRef` (a value bundle, not an imperative handle).
- Renders the toolbars/header/footer JSX and mounts `<ReaderCaptchaGate>`, `<PageRenderer>`, `<ChapterPicker>`.

## 4. Data flow / coupling to preserve

- **Captcha reset fan-out:** `resetCaptcha` from `useReaderCaptcha` is threaded into *both* the orchestrator's data-fetch effect (page-fetch 401) and `useChapterTranslation`'s `onCaptchaExpired` — identical recovery for both paths (#227).
- **`setPage` ownership:** lives in the orchestrator (paged prev/next); passed into `useReaderViewport`, whose continuous IntersectionObserver / `syncContinuousPageFromViewport` call it as the user scrolls. One writer surface, two callers — unchanged from today, just relocated.
- **Global input stays central:** the keyboard (`Escape` closes picker-then-reader; arrow/space scroll in continuous; zoom keys in paged) and wheel (zoom in paged, native scroll in continuous, skip when over the picker) handlers remain in the orchestrator because they read picker + zoom + continuous state together. They depend on the viewport only through the returned value bundle.

## 5. Testing & behaviour

- **Pure relocation — no logic changes.** The `set-state-in-effect` suppressions (the mount-flag / chapter-change reset block) move verbatim with their code; we do **not** try to eliminate them — they are legitimate reset-on-prop choke points.
- `useZoomPan` is composed, not rewritten, so `useZoomPan.test.ts` stays green. No new test surface is added (consistent with the chosen scope).
- **Verification bar = manual E2E** (as the issue states), driving the real reader: paged + continuous reading; zoom in/out/pan; captcha gate fresh *and* expired (401 recovery); translation start/cancel/per-page; chapter-picker language filter + selection; prev/next same-lang and other-lang; keyboard shortcuts. Plus `bunx tsc --noEmit` and file-scoped `bunx eslint` clean (baseline-preserving).
- **Opus review before the PR** — this is core reader UX (captcha, translation, payment-adjacent reading).

## 6. Migration (incremental, one commit per unit)

Extract in dependency order so each step is independently verifiable and a regression is isolated to one commit:

1. `ReaderCaptchaGate` + `useReaderCaptcha` — smallest, self-contained.
2. `ChapterPicker` — self-contained modal (+ its scroll-to-active effect).
3. `useReaderViewport` + `PageRenderer` — the coupled pair (viewport hook first, then the presentational renderer that consumes it).
4. Orchestrator cleanup — remove the now-dead inline code; confirm `MangaReader` reads as a thin composition.

Manual-verify checkpoint after each step. No backend changes; no new dependencies.

## 7. Non-goals

- No behaviour changes, no visual changes, no new features.
- Not extracting chapter-nav derivations into a separately-tested module (declined wider scope).
- Not touching `useZoomPan`, `useChapterTranslation`, `useChapters`, or `useModalTransition` internals.
- Not addressing the other god-component issues (#584 ChapterList, #585 AccountModal, #586 studio steps) — separate specs.
