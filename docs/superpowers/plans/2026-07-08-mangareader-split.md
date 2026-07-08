# MangaReader Split (#582) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break the 1557-LOC `MangaReader.tsx` into a thin orchestrator plus two hooks (`useReaderCaptcha`, `useReaderViewport`) and three presentational children (`ReaderCaptchaGate`, `ChapterPicker`, `PageRenderer`), with **no behaviour change**.

**Architecture:** Approach 1 from the spec — a `useReaderViewport` hook owns the zoom/pan + continuous-mode + page-tracking cluster (composing the existing `useZoomPan`, not rewriting it); the three children are pure presentational components driven by props. The orchestrator keeps data-fetch, chapter-nav derivations, global keyboard/wheel input, and composition. See `docs/superpowers/specs/2026-07-08-mangareader-split-design.md`.

**Tech Stack:** Next.js 16, React 19, TypeScript, `bun` (dev/test/lint), Lenis (`useLocalLenis`), Cloudflare Turnstile (`@marsidev/react-turnstile`).

## Global Constraints

- **Pure relocation — zero behaviour, visual, or feature change.** Every extracted block is moved verbatim; only wiring (props/return values) changes.
- **Do NOT rewrite `useZoomPan`** — compose it inside `useReaderViewport`. `Frontend/app/hooks/useZoomPan.test.ts` must stay green.
- **Do NOT add new test surface** (scope decision). No new `*.test.ts` beyond what exists.
- **Preserve the `set-state-in-effect` eslint-disable suppressions** — move them verbatim with their code; do not attempt to remove them.
- **NEVER run repo-wide lint.** Verify with file-scoped `bunx eslint <files>` (no `--fix`) and `bunx tsc --noEmit` from `Frontend/`. The known unrelated `app/docs/MermaidRenderer.tsx` mermaid tsc error is pre-existing — ignore it.
- **eslint baseline rule:** a task is clean if it introduces **zero new** eslint findings vs `HEAD` for the touched files (confirm by linting the `HEAD` version when in doubt). MangaReader carries pre-existing suppressions/warnings; do not "fix" unrelated ones.
- **Branch:** `refactor/mangareader-split-582` (already created, spec committed at `a6eb723`).
- **New presentational components live in** `Frontend/app/components/reader/`; **new hooks in** `Frontend/app/hooks/`.
- **Verification bar per task:** `tsc --noEmit` clean + file-scoped `eslint` baseline-clean + `useZoomPan.test.ts` green + the task's **manual-verify checklist** (drive the real reader). Manual verification is the primary correctness gate for these presentational/DOM-heavy units — there are no component tests.

---

## File Structure

| File | Responsibility |
|---|---|
| `Frontend/app/hooks/useReaderCaptcha.ts` (create) | Turnstile clearance-token state + `resetCaptcha` |
| `Frontend/app/components/reader/ReaderCaptchaGate.tsx` (create) | Presentational Turnstile overlay/gate |
| `Frontend/app/components/reader/ChapterPicker.tsx` (create) | Presentational chapter-picker modal + scroll-to-active |
| `Frontend/app/hooks/useReaderViewport.ts` (create) | Zoom/pan + continuous + page-tracking; composes `useZoomPan` |
| `Frontend/app/components/reader/PageRenderer.tsx` (create) | Presentational page images (paged + continuous, 4 `<img>` blocks) |
| `Frontend/app/components/MangaReader.tsx` (modify) | Orchestrator: data-fetch, chapter-nav derivations, global input, composition |
| `Frontend/app/hooks/useZoomPan.ts` / `useZoomPan.test.ts` | Unchanged (composed) |

**Source-region map** (current `MangaReader.tsx`, line numbers approximate — the implementer must confirm by reading, since earlier edits may have shifted them):
- Captcha state + `resetCaptcha`: ~41–59. Turnstile modal JSX: inside the `return`, the `!turnstilePassed` block (locate by `<Turnstile`).
- Chapter-nav derivations: ~62–119 (`chapterList`, `sameLangList`, `otherLangNextMap`, prev/next, `maxMainChapter`, `chapterNumDisplay`).
- Picker state/refs/handlers: ~207–235 (`pickerOpen`, `useModalTransition`, `pickerLangFilter`, `pickerRef`, `pickerScrollRef`, `activeChapterBtnRef`, `openPicker`, `closePicker`, `showChapterPickerRef` sync effect, scroll-to-active effect). Picker JSX: `!` block in `return` (locate by `pickerMounted`).
- Viewport refs + sync + `useZoomPan` call: ~261–316. Continuous `useLocalLenis`: ~269. Continuous-toggle resync effect: ~437–442. IntersectionObserver effect: ~449–472. `continuousModeRef` sync: ~434.
- Data-fetch effect (page fetch, `x-captcha-clearance`, 401→`resetCaptcha`): ~341–431.
- Keyboard handler: ~515–577. Wheel handler: ~579–590.
- The four `<img>` blocks: ~1293, 1304, 1410, 1422.

---

## Task 1: Extract `useReaderCaptcha` + `ReaderCaptchaGate`

**Files:**
- Create: `Frontend/app/hooks/useReaderCaptcha.ts`
- Create: `Frontend/app/components/reader/ReaderCaptchaGate.tsx`
- Modify: `Frontend/app/components/MangaReader.tsx`

**Interfaces:**
- Produces:
  ```ts
  // useReaderCaptcha.ts
  export interface ReaderCaptcha {
    clearanceToken: string | null;
    turnstilePassed: boolean;
    turnstileExiting: boolean;
    setTurnstileExiting: (v: boolean) => void;
    onVerify: (token: string) => void;   // persist + set token + passed=true
    resetCaptcha: () => void;            // remove localStorage key + clear token + passed=false
  }
  export function useReaderCaptcha(): ReaderCaptcha;

  // ReaderCaptchaGate.tsx
  export interface ReaderCaptchaGateProps {
    passed: boolean;
    exiting: boolean;
    siteKey: string;
    onVerify: (token: string) => void;
    children: React.ReactNode;
  }
  export default function ReaderCaptchaGate(props: ReaderCaptchaGateProps): JSX.Element;
  ```
- Consumes: nothing (first task).

- [ ] **Step 1: Read the current captcha code.** In `MangaReader.tsx` read the captcha state block (`clearanceToken`/`turnstilePassed`/`turnstileExiting`/`turnstileSiteKey`/`resetCaptcha`, ~41–59) and locate the Turnstile modal JSX in the `return` (search `<Turnstile`). Note the exact enter/exit animation classes and the `onSuccess`/verify handler that persists `cf_clearance_token`.

- [ ] **Step 2: Create `useReaderCaptcha.ts`.** Move the three `useState`s (with the lazy `localStorage.getItem("cf_clearance_token")` initializer verbatim — preserves no-hydration-flash), and `resetCaptcha`. Add `onVerify(token)` capturing the exact persist logic currently in the Turnstile `onSuccess` (set `localStorage`, `setClearanceToken`, `setTurnstilePassed(true)`). Return the `ReaderCaptcha` bundle. Do not move `turnstileSiteKey` (it's `process.env`-derived; the orchestrator passes `siteKey` to the gate).

- [ ] **Step 3: Create `ReaderCaptchaGate.tsx`.** Move the Turnstile modal JSX verbatim. Render the overlay when `!passed` (wire `<Turnstile siteKey={siteKey} onSuccess={onVerify} />` and the exit animation from `exiting`), and render `{children}` for the reader body. Keep the exact class names / animation structure.

- [ ] **Step 4: Wire the orchestrator.** In `MangaReader.tsx`: replace the removed state with `const { clearanceToken, turnstilePassed, turnstileExiting, setTurnstileExiting, onVerify, resetCaptcha } = useReaderCaptcha();`. Wrap the reader body in `<ReaderCaptchaGate passed={turnstilePassed} exiting={turnstileExiting} siteKey={turnstileSiteKey} onVerify={onVerify}>…</ReaderCaptchaGate>`. Confirm `resetCaptcha` is still passed to the data-fetch effect and `useChapterTranslation({ onCaptchaExpired: resetCaptcha })`. Delete the now-dead inline state/JSX.

- [ ] **Step 5: Typecheck + lint.**
  Run (from `Frontend/`): `bunx tsc --noEmit 2>&1 | grep -v MermaidRenderer`
  Expected: no output.
  Run: `bunx eslint app/hooks/useReaderCaptcha.ts app/components/reader/ReaderCaptchaGate.tsx app/components/MangaReader.tsx`
  Expected: zero **new** findings vs `HEAD` for `MangaReader.tsx` (new files clean).

- [ ] **Step 6: Manual verify.** `bun dev`, open a chapter reader. Checklist: (a) returning reader with a stored token skips the Turnstile flash; (b) clear `localStorage.cf_clearance_token`, reload → Turnstile modal shows, solving it reveals the reader with the exit animation; (c) force a page-fetch 401 (or wait for token expiry) → the modal re-appears (resetCaptcha path intact).

- [ ] **Step 7: Commit.**
  ```bash
  git add Frontend/app/hooks/useReaderCaptcha.ts Frontend/app/components/reader/ReaderCaptchaGate.tsx Frontend/app/components/MangaReader.tsx
  git commit -m "refactor(reader): extract useReaderCaptcha + ReaderCaptchaGate (#582)"
  ```

---

## Task 2: Extract `ChapterPicker`

**Files:**
- Create: `Frontend/app/components/reader/ChapterPicker.tsx`
- Modify: `Frontend/app/components/MangaReader.tsx`

**Interfaces:**
- Consumes: `ChapterPageItem` from `../../hooks/useChapters` (the chapter list item type already used by MangaReader).
- Produces:
  ```ts
  // ChapterPicker.tsx
  export interface ChapterPickerProps {
    mounted: boolean;                 // from useModalTransition (DOM gate)
    visible: boolean;                 // from useModalTransition (CSS class toggle)
    langFilter: string;               // "all" | lang code
    setLangFilter: (l: string) => void;
    chapterList: ChapterPageItem[];
    currentChapterId: string;
    onSelect: (chapter: ChapterPageItem) => void;
    onClose: () => void;
    pickerRef: React.RefObject<HTMLDivElement | null>;
    pickerScrollRef: React.RefObject<HTMLDivElement | null>;
    activeChapterBtnRef: React.RefObject<HTMLButtonElement | null>;
  }
  export default function ChapterPicker(props: ChapterPickerProps): JSX.Element | null;
  ```

- [ ] **Step 1: Read the picker code.** In `MangaReader.tsx` read the picker state/refs/handlers (~207–235) and the picker modal JSX in the `return` (language tabs + chapter list; locate by `pickerMounted`/`pickerVisible`). Note the scroll-to-active effect (~230–235) and `useLocalLenis(pickerScrollRef, …)` (~270).

- [ ] **Step 2: Create `ChapterPicker.tsx`.** Move the picker modal JSX verbatim. It returns `null` when `!mounted`. Move the scroll-to-active effect **inside** the component (it depends only on `visible`, `langFilter`, `pickerScrollRef`, `activeChapterBtnRef`). Move `useLocalLenis(pickerScrollRef, "vertical", mounted && visible)` inside. The language-tab clicks call `setLangFilter`; a chapter row click calls `onSelect(chapter)`; the close affordance calls `onClose`. The list-filtering by `langFilter` and the "active chapter" highlight (`chapter.id === currentChapterId`) move verbatim.

- [ ] **Step 3: Wire the orchestrator.** Keep `pickerOpen` state + `useModalTransition` + `openPicker`/`closePicker` + `showChapterPickerRef` sync effect in the orchestrator (the global ESC handler reads them). Remove the now-inlined scroll effect and `useLocalLenis(pickerScrollRef…)`. Render `<ChapterPicker mounted={pickerMounted} visible={pickerVisible} langFilter={pickerLangFilter} setLangFilter={setPickerLangFilter} chapterList={chapterList} currentChapterId={currentChapterId} onSelect={handleSelectChapter} onClose={closePicker} pickerRef={pickerRef} pickerScrollRef={pickerScrollRef} activeChapterBtnRef={activeChapterBtnRef} />`. If a `handleSelectChapter` doesn't already exist, extract the existing chapter-row onClick body (setCurrentChapter* + closePicker) into one.

- [ ] **Step 4: Typecheck + lint.**
  Run: `bunx tsc --noEmit 2>&1 | grep -v MermaidRenderer` → no output.
  Run: `bunx eslint app/components/reader/ChapterPicker.tsx app/components/MangaReader.tsx` → zero new findings vs `HEAD`.

- [ ] **Step 5: Manual verify.** In the reader: open the chapter picker; the enter/exit animation matches; the active chapter is scrolled into view; switching the language filter re-scrolls; selecting a chapter navigates and closes; `Escape` closes the picker (not the reader) when open; picker list scrolls smoothly (Lenis).

- [ ] **Step 6: Commit.**
  ```bash
  git add Frontend/app/components/reader/ChapterPicker.tsx Frontend/app/components/MangaReader.tsx
  git commit -m "refactor(reader): extract ChapterPicker (#582)"
  ```

---

## Task 3: Extract `useReaderViewport` (compose `useZoomPan`)

**Files:**
- Create: `Frontend/app/hooks/useReaderViewport.ts`
- Modify: `Frontend/app/components/MangaReader.tsx`

**Interfaces:**
- Consumes: `useZoomPan` (unchanged signature), `useLocalLenis`, `ChapterPages` (the `data` type), `Lenis`.
- Produces:
  ```ts
  // useReaderViewport.ts
  export interface ReaderViewport {
    zoom: number;
    isDragging: boolean;
    zoomIn: () => void;
    zoomOut: () => void;
    zoomReset: () => void;
    resetZoomAndPan: () => void;
    isZoomingRef: React.RefObject<boolean>;
    continuousLenisRef: React.RefObject<Lenis | null>;
    refs: {
      zoomWrapperRef: React.RefObject<HTMLDivElement | null>;
      zoomRef: React.RefObject<HTMLDivElement | null>;
      scrollContainerRef: React.RefObject<HTMLDivElement | null>;
      continuousContentRef: React.RefObject<HTMLDivElement | null>;
      pageRefs: React.RefObject<(HTMLImageElement | null)[]>;
    };
  }
  export function useReaderViewport(args: {
    page: number;
    setPage: (p: number) => void;
    data: ChapterPages | null;
    continuousMode: boolean;
  }): ReaderViewport;
  ```
  (Match the exact `zoom*` names `useZoomPan` returns; if `useZoomPan` exposes `zoomWrapperRef`/`zoomRef` differently, keep its names and re-expose under `refs`.)

- [ ] **Step 1: Read the viewport code.** Read `MangaReader.tsx` ~261–316 (the six refs, `useLocalLenis(scrollContainerRef…)`, `syncContinuousPageFromViewport`, the `useZoomPan({...})` call), the `continuousModeRef` sync effect (~434), the continuous-toggle resync effect (~437–442), and the IntersectionObserver effect (~449–472). Note which of these read `data`, `page`, `setPage`, `continuousMode`, `isZoomingRef`.

- [ ] **Step 2: Create `useReaderViewport.ts`.** Move the six `useRef`s, `useLocalLenis(scrollContainerRef, "vertical", continuousMode, continuousLenisRef, continuousContentRef)`, `syncContinuousPageFromViewport` (verbatim — it reads `scrollContainerRef`/`pageRefs`, calls `setPage`), the `continuousModeRef` sync effect, the continuous-toggle resync effect, and the IntersectionObserver effect (verbatim, incl. its `data`/`continuousMode`/`isZoomingRef` deps and the `set-state-in-effect` suppressions if present). Call `useZoomPan({ page, continuousModeRef, scrollContainerRef, continuousContentRef, continuousLenisRef, pageRefs, syncContinuousPageFromViewport })` internally. Return the `ReaderViewport` bundle.

- [ ] **Step 3: Wire the orchestrator.** Replace the removed refs/effects/`useZoomPan` call with `const viewport = useReaderViewport({ page, setPage, data, continuousMode });`. Update every reader-body reference: `viewport.zoom`, `viewport.zoomIn/zoomOut/zoomReset`, `viewport.resetZoomAndPan`, `viewport.isZoomingRef`, `viewport.continuousLenisRef`, and the `viewport.refs.*` on the JSX elements. The data-fetch effect's `resetZoomAndPan` dep becomes `viewport.resetZoomAndPan`. The global keyboard/wheel handlers now call `viewport.zoomIn()` etc. and read `viewport.continuousLenisRef`/`viewport.refs.scrollContainerRef`. **Do not move the keyboard/wheel handlers** — they stay in the orchestrator (they also read picker refs + close). Leave `continuousMode`/`setContinuousMode` state and `continuousModeRef`? — `continuousModeRef` moves into the hook; the orchestrator passes the `continuousMode` value; if the keyboard/wheel handlers currently read `continuousModeRef.current`, expose it via `viewport` **or** have them read the `continuousMode` value through a ref the orchestrator still owns. Simplest: keep a thin `continuousModeRef` in the orchestrator for the handlers OR add `continuousModeRef` to the returned `refs`. Pick one and keep it consistent; prefer adding `continuousModeRef` to `viewport.refs` so there's a single owner.

- [ ] **Step 4: Typecheck + lint + zoom-pan tests.**
  Run: `bunx tsc --noEmit 2>&1 | grep -v MermaidRenderer` → no output.
  Run: `bun test app/hooks/useZoomPan.test.ts` → all pass (composition didn't touch `useZoomPan`).
  Run: `bunx eslint app/hooks/useReaderViewport.ts app/components/MangaReader.tsx` → zero new findings vs `HEAD`.

- [ ] **Step 5: Manual verify.** In the reader (both a small and a long chapter): paged mode — zoom in/out (keys + wheel + buttons), pan while zoomed, zoom reset; switch to continuous mode — smooth scroll (Lenis), the page counter tracks the visible page (IntersectionObserver + `syncContinuousPageFromViewport`), zoom persists correctly when toggling modes; on chapter change zoom/pan resets. Confirm no console errors.

- [ ] **Step 6: Commit.**
  ```bash
  git add Frontend/app/hooks/useReaderViewport.ts Frontend/app/components/MangaReader.tsx
  git commit -m "refactor(reader): extract useReaderViewport composing useZoomPan (#582)"
  ```

---

## Task 4: Extract `PageRenderer`

**Files:**
- Create: `Frontend/app/components/reader/PageRenderer.tsx`
- Modify: `Frontend/app/components/MangaReader.tsx`

**Interfaces:**
- Consumes: `ReaderViewport` (Task 3), `ChapterPages`, and the translation-display fields from `useChapterTranslation`.
- Produces:
  ```ts
  // PageRenderer.tsx
  export interface PageRendererProps {
    viewport: ReaderViewport;
    data: ChapterPages;              // non-null (orchestrator renders it only when data exists)
    page: number;
    continuousMode: boolean;
    useSaver: boolean;
    showTranslation: boolean;
    translatedPages: /* same type as in MangaReader */ unknown;
    patchedPages: unknown;
    completedTranslatedPages: unknown;
    translatingCurrentPageIndex: number | null;
    imgLoading: boolean;
    setImgLoading: (v: boolean) => void;
  }
  export default function PageRenderer(props: PageRendererProps): JSX.Element;
  ```
  (Replace each `unknown` with the exact type MangaReader currently uses for that variable — read them from the `useChapterTranslation` destructure and copy the types verbatim.)

- [ ] **Step 1: Read the render code.** Read the four `<img>` blocks (~1293, 1304, 1410, 1422) and the surrounding paged-vs-continuous container JSX. Identify exactly which props each block reads (src selection: `useSaver`/full, `showTranslation`/`patchedPages`/`translatedPages`, per-page loading, the zoom transform wrapper, `pageRefs` attachment, `continuousContentRef`, the `no-img-element` eslint-disable comments).

- [ ] **Step 2: Create `PageRenderer.tsx`.** Move the paged + continuous render subtrees verbatim, including the four `<img>` blocks and their `eslint-disable-next-line @next/next/no-img-element` comments. Attach `viewport.refs.zoomRef`/`zoomWrapperRef` (paged transform), `viewport.refs.pageRefs` (per-image), `viewport.refs.scrollContainerRef` + `viewport.refs.continuousContentRef` (continuous). Apply the zoom transform from `viewport.zoom` exactly as today. All `src`/translation selection logic moves verbatim; add no new logic.

- [ ] **Step 3: Wire the orchestrator.** Replace the moved render subtree with `{data && <PageRenderer viewport={viewport} data={data} page={page} continuousMode={continuousMode} useSaver={useSaver} showTranslation={showTranslation} translatedPages={translatedPages} patchedPages={patchedPages} completedTranslatedPages={completedTranslatedPages} translatingCurrentPageIndex={translatingCurrentPageIndex} imgLoading={imgLoading} setImgLoading={setImgLoading} />}`. Keep the loading/error/`noCacheError` branches in the orchestrator (they gate whether `PageRenderer` renders).

- [ ] **Step 4: Typecheck + lint.**
  Run: `bunx tsc --noEmit 2>&1 | grep -v MermaidRenderer` → no output.
  Run: `bunx eslint app/components/reader/PageRenderer.tsx app/components/MangaReader.tsx` → zero new findings vs `HEAD`.

- [ ] **Step 5: Manual verify.** In the reader: pages render in both modes; the save-data toggle swaps sources; translating a page shows the patched/translated image (and the per-page translating indicator); the image loading state behaves; zoom transform applies to the rendered page; continuous list renders all pages and `pageRefs` tracking still updates the counter.

- [ ] **Step 6: Commit.**
  ```bash
  git add Frontend/app/components/reader/PageRenderer.tsx Frontend/app/components/MangaReader.tsx
  git commit -m "refactor(reader): extract PageRenderer (#582)"
  ```

---

## Task 5: Orchestrator cleanup + full-flow verification

**Files:**
- Modify: `Frontend/app/components/MangaReader.tsx`

- [ ] **Step 1: Remove dead code.** Delete any now-unused imports, refs, helpers, or comments orphaned by Tasks 1–4 (e.g. an import only the moved JSX used). Confirm the orchestrator now reads as: captcha hook → chapter derivations → viewport hook → translation hook → data-fetch effect → global keyboard/wheel handlers → toolbars/header/footer JSX → `<ReaderCaptchaGate>` wrapping `<PageRenderer>` + `<ChapterPicker>`.

- [ ] **Step 2: Confirm the LOC / shape.** Run `wc -l Frontend/app/components/MangaReader.tsx` — expect roughly ~400–550. If it's still near 1557, an extraction didn't remove its source; re-check Tasks 1–4.

- [ ] **Step 3: Typecheck + lint + zoom-pan tests (whole set).**
  Run: `bunx tsc --noEmit 2>&1 | grep -v MermaidRenderer` → no output.
  Run: `bun test app/hooks/useZoomPan.test.ts` → all pass.
  Run: `bunx eslint app/components/MangaReader.tsx app/components/reader/ReaderCaptchaGate.tsx app/components/reader/ChapterPicker.tsx app/components/reader/PageRenderer.tsx app/hooks/useReaderCaptcha.ts app/hooks/useReaderViewport.ts` → zero new findings vs `HEAD`.

- [ ] **Step 4: Full manual E2E (the issue's "done when").** Drive the real reader end-to-end: reading (paged + continuous), zoom/pan, captcha gate (fresh + expired 401 recovery), translation (start/cancel/per-page), chapter picker (open, lang filter, select), prev/next same-lang and other-lang navigation, keyboard shortcuts (Escape, arrows/space, zoom keys), and the end-of-chapter banner. Confirm no console errors and no visual diffs vs `main`.

- [ ] **Step 5: Commit.**
  ```bash
  git add Frontend/app/components/MangaReader.tsx
  git commit -m "refactor(reader): thin MangaReader orchestrator after split (#582)"
  ```

- [ ] **Step 6: Opus review + PR.** Request an Opus review of the full range (`git diff feat/frontend-ui..HEAD`) focused on: behaviour equivalence of each relocation, no lost effect/dep, `resetCaptcha` fan-out intact (fetch + translation), viewport ref ownership single-sourced, no new floating promises. Address findings, then open a bilingual PR into `feat/frontend-ui` referencing #582 and the spec.

---

## Self-Review

**Spec coverage:**
- ReaderCaptchaGate → Task 1 ✓ · ChapterPicker → Task 2 ✓ · useReaderViewport (viewport consolidation, scrutinize N1) → Task 3 ✓ · PageRenderer (4 img blocks) → Task 4 ✓ · thin orchestrator → Task 5 ✓.
- Spec §4 coupling: `resetCaptcha` fan-out verified in Task 1 Step 4 + Task 5 Step 6; `setPage` ownership in Task 3; global input central in Task 3 Step 3 + Task 5 ✓.
- Spec §5 testing: `useZoomPan.test` green gate in Tasks 3 & 5; manual-verify each task; opus review Task 5 ✓. No new test surface ✓.
- Spec §6 migration order (CaptchaGate → ChapterPicker → viewport+PageRenderer → cleanup) = Tasks 1→5 ✓.

**Placeholder scan:** The `unknown` types in Task 4's interface are explicitly flagged "replace with the exact type MangaReader uses" with the source to copy from — a bounded instruction, not an open TODO, because the concrete translation types live in `useChapterTranslation` and must be read at implementation time rather than guessed here. All other steps carry concrete commands/wiring.

**Type consistency:** `ReaderViewport` (Task 3) is consumed by name in Task 4's `PageRendererProps.viewport`; `zoomIn/zoomOut/zoomReset/resetZoomAndPan/isZoomingRef/continuousLenisRef/refs.*` names are used identically in Tasks 3–5; `ReaderCaptcha` fields (Task 1) match their orchestrator wiring. `ChapterPageItem` is the shared list type from `useChapters` in Task 2.
