# Design: Split ChapterList out of BookDetailModal (#584)

**Date:** 2026-07-08  
**Issue:** [#584](https://github.com/Slow-Inc/MangaDock/issues/584)  
**Parent Story:** #564  
**Integration branch:** `feat/frontend-ui`

---

## Problem

`BookDetailModal.tsx` is 1,266 LOC. The chapter section (lines 958–1207, ~250 LOC) is fully inlined inside the modal, interleaved with:

- 5 state variables (`chapters`, `loadingChapters`, `langFilter`, `expandedGroups`, and coin/unlock from `useChapterUnlock`)
- 5 refs (`chaptersRef`, `highlightChapterRef`, `chaptersListScrollRef`, `chaptersContentRef`, `chaptersLenisRef`)
- 2 Lenis `useEffect` + 1 ResizeObserver effect
- `useChapterUnlock` hook call
- `TopupModal` render
- `ChapterRowInner` defined inline inside the render callback (React anti-pattern — recreated every render)

---

## Approach: Self-Contained ChapterList (owns fetch + unlock + Lenis)

ChapterList receives the minimum props needed to operate and surfaces back only what BookDetailModal's CTA buttons need.

### New file: `Frontend/app/components/ChapterList.tsx`

```tsx
type ActiveChapter = {
  id: string;
  chapterNumber: string | null;
  title: string | null;
};

type ChapterListProps = {
  book: LandingBook;
  effectiveHighlightId?: string;
  asPage: boolean;
  visible: boolean;                                        // drives Lenis on/off
  onChapterSelect: (ch: ActiveChapter) => void;
  sectionRef?: React.RefObject<HTMLDivElement>;            // chaptersRef from parent, for scroll-to-section
  onReadyState?: (                                         // drives CTA buttons in BookDetailModal
    loading: boolean,
    firstReadable: MangaChapter | undefined,
  ) => void;
};
```

### What ChapterList owns internally

| Concern | Notes |
|---|---|
| Chapter fetch | Moved from BookDetailModal's `useEffect([])` — the `Promise.all([mangaDex + versions])` block |
| `chapters`, `loadingChapters` state | Moved in |
| `langFilter`, `expandedGroups` state | Moved in |
| `useChapterUnlock` hook | Moved in — ChapterList "consumes" it as the issue specifies |
| `TopupModal` render | Moved in — uses `topupOpen`/`setTopupOpen` from `useChapterUnlock` |
| `highlightChapterRef` | Moved in — ChapterList auto-scrolls when chapters finish loading |
| `chaptersListScrollRef`, `chaptersContentRef`, `chaptersLenisRef` | Moved in |
| Both Lenis `useLocalLenis` calls for chapters + ResizeObserver | Moved in |
| `ChapterRowInner` | Elevated from inline anonymous → module-level function at top of file |

### `ChapterRowInner` elevation

Currently defined inside the render callback — recreated on every render. Move to module level:

```tsx
function ChapterRowInner({ ch, isTreeChild, isLast, ... }: ChapterRowInnerProps) { ... }
```

Receives the context it needs (access result, isHighlighted, purchasingId, onClick handler) as props, removing the closure dependency.

### `ActiveChapter` type

Move from BookDetailModal-local to `Frontend/app/lib/types/manga.ts` so both files can import it.

### `onReadyState` callback

ChapterList calls `onReadyState(loading, firstReadable)` in a `useEffect` that watches `[loadingChapters, chapters, unlockedVersions]`. ChapterList computes `firstReadableChapter` internally (it has access to both `chapters` and `unlockedVersions`).

BookDetailModal stores the result in 2 state variables:
```tsx
const [loadingChapters, setLoadingChapters] = useState(false);
const [firstReadableChapter, setFirstReadableChapter] = useState<MangaChapter | undefined>();
```

These drive the existing CTA buttons at lines 558–575 and 713–724 — no other changes needed there.

### Highlight scroll

ChapterList handles internally: when `!loadingChapters` and `effectiveHighlightId` is set, `setTimeout` scrolls `highlightChapterRef.current` into view (mirrors current line 365-369 behavior). The parent scroll-to-section (`chaptersRef.current?.scrollIntoView`) remains in BookDetailModal's existing `scrollToChapters` effect, now using `sectionRef` on the ChapterList outer div.

---

## BookDetailModal after extraction

### Removed from BookDetailModal
- ~250 LOC chapter render block
- State: `chapters`, `loadingChapters`, `langFilter`, `expandedGroups`
- Hook call: `useChapterUnlock`
- Refs: `highlightChapterRef`, `chaptersListScrollRef`, `chaptersContentRef`, `chaptersLenisRef`
- Effects: 2× `useLocalLenis` for chapters + ResizeObserver
- `TopupModal` render
- Imports: `useChapterUnlock`, `chapterAccess` (only used for chapter section + `firstReadableChapter`)

### Added to BookDetailModal
```tsx
const [loadingChapters, setLoadingChapters] = useState(false);
const [firstReadableChapter, setFirstReadableChapter] = useState<MangaChapter | undefined>();
```

```tsx
{isManga && (
  <ChapterList
    book={book}
    effectiveHighlightId={effectiveHighlightId}
    asPage={asPage}
    visible={visible && activeChapter === null}
    onChapterSelect={setActiveChapter}
    sectionRef={chaptersRef}
    onReadyState={(loading, firstReadable) => {
      setLoadingChapters(loading);
      setFirstReadableChapter(firstReadable);
    }}
  />
)}
```

`chaptersRef` remains in BookDetailModal (used in `scrollToChapters` effect, line 359-371). `TopupModal` render moves into ChapterList. Import of `useChapterUnlock` and `chapterAccess` removed from BookDetailModal.

---

## Files changed

| File | Change |
|---|---|
| `Frontend/app/components/ChapterList.tsx` | **New** — ~280 LOC |
| `Frontend/app/components/BookDetailModal.tsx` | Shrinks by ~300 LOC |
| `Frontend/app/lib/types/manga.ts` | Add `ActiveChapter` export |

---

## Behaviour contract

- All existing chapter list behaviour preserved: fetch, merge, sort, lang filter, group/expand, coin-lock, unlock, highlight scroll, Lenis smooth scroll, TopupModal
- `ChapterRowInner` rendered identically — same CSS, same badges, same animations
- `scrollToChapters` UX unchanged: BookDetailModal scrolls to section via `sectionRef`, ChapterList scrolls to highlighted row internally
- CTA buttons in BookDetailModal ("อ่านตอนที่ X") driven by `onReadyState` — same `disabled` logic, same label text

---

## Out of scope

- Toolbar/chrome extraction from MangaReader (separate follow-up)
- Backend B4 (deferred)
- Any visual change to the chapter list
