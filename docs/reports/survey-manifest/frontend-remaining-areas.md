# Frontend Remaining Areas — Deep Survey (2026-07-04)

Survey scope: the manga reader/chapter viewer + book detail flow, the Community Forum's remaining pages/components, the Search page, the Studio (creator dashboard) area, and the Auth/Toast contexts plus the hooks not already covered by prior surveys. All files were read against `origin/main` (not the working tree, which carries unrelated WIP on `perf/mit-layout-fit-and-merge`).

**What's genuinely presentation-worthy**: `MangaReader.tsx` (1749 lines) is the single most important user-facing component in the app — it drives dual pagination modes (paged vs. continuous/webtoon scroll with `IntersectionObserver` page sync), a bubble-tagged translation-patch overlay (never the whole-image endpoint — confirms the team's own benchmarking rule), CSS-variable-driven zoom/pan with scroll-anchor preservation across reflows, and a full Cloudflare Turnstile captcha-recovery flow — all without a next/prev chapter prefetch, which is a real, citable gap. `useChapterTranslation.ts` is the orchestration brain behind it: cooperative-cancellation, retry-with-backoff, and a documented reason (`MIT/ARCHITECTURE.md §6, #129`) for why cancel can't be instant. Second most interesting: `AuthContext.tsx` (817 lines) is visibly a Firebase→Supabase migration with deliberate compatibility shims (`uid`/`id` duplication, Firebase-style `error.code`, provider-id translation) and a real popup-based OAuth flow with `postMessage` handoff, plus a documented (issue #152) narrow-memoization fix for the context value. The Community Forum's post-detail page (`p/[id]/page.tsx`) is the only file in scope with a full 5-event live-collaboration SSE model and is the sole place spoiler-blur + Image-XSS rules were verified fully compliant. Studio is the weakest-tested/most-duplicated area: two ~90%-overlapping custom dropdown components, two independently hand-rolled mobile sub-view state machines, and no upload page reordering — a fair "tech debt to point at" in a thesis.

---

## Reader/Book Detail

### Frontend/app/book/[id]/page.tsx
- **last_commit:** a9dd09b646d7e9468c45464de104d3e1da997c43
- **lines_covered:** 1-47 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Thin route wrapper for `/book/[id]`; makes the book detail view a shareable/bookmarkable URL rather than only an in-place modal.
  - State: single `useState` with a lazy initializer (lines 8-16) reading `sessionStorage.getItem(\`mb:book:${id}\`)`. The book is never fetched by ID here — it must already have been written to `sessionStorage` by the linking screen (e.g. `BookRow`/search results); visiting cold shows a Thai "ไม่พบข้อมูลหนังสือ" (book not found) message (lines 18-30).
  - Hands the parsed `LandingBook` straight to `<BookDetailModal book={book} asPage onClose={...} />` (40-46) — confirms `BookDetailModal` is a dual-mode component (modal overlay vs. full page) controlled entirely by the `asPage` prop.
  - No fetch, no loading state, no error boundary beyond the static not-found message — matches North Star "simplest construct that suffices," delegating all data-fetching complexity to `BookDetailModal`.

### Frontend/app/components/BookDetailModal.tsx
- **last_commit:** e673db0ee13f72052f3d254048c62ea3b3569709
- **lines_covered:** 1-1279 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Renders as a `createPortal`-into-`document.body` modal or a full page (`asPage` prop) — hero image, auto-translated description, volume-cover gallery, chapter list with paywall/coin-unlock, forum discussion, related manga.
  - State is almost entirely `useState`, no `useReducer`/Context beyond `AuthContext`. Modal lifecycle uses double-phase `mounted`/`visible` (lines 90-91, 172-176) for enter animation; `historyPushedRef` wires mobile hardware back-button support via `pushState`/`popstate` (190-208).
  - Description auto-translate starts immediately from the card's cached description (line 230) before the full detail fetch resolves, then re-translates only if the full detail brings a longer description (line 237) — perceived-latency optimization.
  - On mount (186-299), 3-4 fetches run in parallel (manga detail, chapters, translated description, `/versions/title/:id` merged with chapters at 243-279) — explicitly documented in a comment (241-243) as a refactor from "a pure waterfall" to parallel, a perf-minded North-Star-aligned change.
  - Chapter merge (249-272) tags MangaDex chapters `source: "mangadex"`, user versions `source: "user"` with `versionId`/`priceCoins`/`translatorName`, sorted by parsed chapter number.
  - **Paywall/unlock**: uses the extracted pure `chapterAccess()` function from `../lib/chapterAccess` (import line 16; usage 405-408, 1049-1052) for `readable`/`coinLocked`/`unavailableLabel` per chapter. `handlePurchaseUnlock` (321-348) calls `purchaseUnlock(token, versionId)`, updates `unlockedVersions`/wallet balance, dispatches a `window` CustomEvent `mb:coin-balance-update` for cross-component sync without prop drilling (line 332), and auto-opens the chapter by setting `activeChapter`.
  - `activeChapter && <MangaReader .../>` appears twice (asPage branch 1245-1254, portal branch 1266-1275) — `BookDetailModal` is literally what mounts `MangaReader`; the reader is layered on top, not routed to.
  - **Anti-pattern/tech debt**: ~180-line inline IIFE `ChapterRowInner` for grouped chapter rows (1035-1213) — functionally fine (captures `unlockedVersions`/`purchasingId` from closure correctly) but a readability smell; extracting to a named component/`useMemo` would reduce file size. `alert(msg || "ไม่สามารถปลดล็อคได้")` on line 343 for a purchase failure is a native `alert()` — CLAUDE.md's "never `alert()`" rule is scoped to unauthenticated flows specifically, but this is still inconsistent with the app's toast-based UX elsewhere. Uses raw `fetch()` (not `app/lib/apiCache.ts`'s LRU) for detail/chapters/description-translate (lines 222, 232, 244-247, 284) — no caching/dedup beyond React state, so reopening the same book always refetches.

### Frontend/app/components/BookRow.tsx
- **last_commit:** cad8073e1cd9908a85ec51024f1e1f1e6f64a69c
- **lines_covered:** 1-374 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Horizontal-scrolling "row of manga cards" (Netflix-style row) for landing/browse pages. Each `BookCard` owns its own hover-expand info panel, favorite/like actions, thumbnail fallback chain, and a "continue reading" shortcut.
  - Per-card state: `thumbSrc`/`thumbFellBack` (image fallback via `onError`, guarded boolean to prevent loop, lines 38-39), `isLandscape` (from `naturalWidth > naturalHeight`, toggles `object-contain` vs `object-cover`), three overlay flags (`showModal`/`showCover`/`showReader`), mirrored translated-description state, `expandRight` (recomputed on hover/resize to pick which side the hover panel expands so it doesn't clip off-screen, lines 66-76).
  - Reuses `useBookActions(book)` (import line 9) for favorite/like, kept in sync across all cards sharing a `bookId` via a window event.
  - **"Continue reading" shortcut**: reads `getHistory().find(h => h.id === book.id)` in an effect deferred via `queueMicrotask` to dodge SSR hydration mismatch (lines 58-64); if a `lastChapterId` exists, the play button opens `<MangaReader chapterId={lastChapterId} .../>` directly, bypassing `BookDetailModal` entirely (lines 149-152, 344-353) — the shortest path from landing page to reader in the app.
  - Horizontal scroll delegated to `useHorizontalScroll` hook (`canScrollLeft/Right`, `scrollBy`, `update`).
  - Scope stops at "open the reader" — no translation/pagination logic lives here.

### Frontend/app/components/MangaReader.tsx
- **last_commit:** 31f7b4d8be5bed764d1c29d9074c5584f71eaa10
- **lines_covered:** 1-1749 (full)
- **read_date:** 2026-07-04
- **findings:**
  - The chapter viewer/reader itself — most important reader file in the app.
  - **Pagination modes**: both paged (`continuousMode=false`, single `<img>` per page + prev/next buttons + click-zones, lines 1567-1683) and vertical/continuous "webtoon" scroll (`continuousMode=true`, all pages in a scrollable column, `IntersectionObserver`-driven `page` state sync, lines 1458-1565) exist and are user-toggleable at runtime. Default is continuous on mobile (`window.innerWidth < 640`, lines 202-204).
  - **Translation patch overlay**: confirmed the reader consumes the patch-tagged (bubble-region) endpoints via `useChapterTranslation` — never the whole-image endpoint — matching the team's own benchmarking rule (`feedback_benchmark_patch_not_image_endpoint`).
  - **Zoom/pan**: custom CSS-variable-driven transform (`--mg-zoom`, `--mg-pan-x`, `--mg-pan-y` set imperatively via `el.style.setProperty`, `applyTransform()` lines 411-418) rather than React state driving inline style every frame — avoids re-render during drag. Discrete zoom levels via `zoomInLevel`/`zoomOutLevel` (from `../lib/zoomLevel`). Continuous-mode zoom has a non-trivial "anchor" system (`getContinuousZoomAnchor`/`restoreContinuousZoomAnchor`, lines 310-392) preserving visual scroll position across a zoom-triggered reflow — reasonably isolated into three named `useCallback`s.
  - **Keyboard shortcuts**: Escape (close picker else close reader), ArrowLeft/Right (paged nav), ArrowUp/Down (continuous mode, held-key smooth scroll via `requestAnimationFrame` loop, lines 665-727), Ctrl/Cmd `=`/`-`/`0` (zoom, lines 708-710).
  - **Prefetching next/prev chapter**: not implemented — `goToChapter` (line 481) only switches state, re-triggering the page-fetch effect (`[chapterId, ...]`, line 578); no evidence of prefetching ahead of the click. Real, citable gap — chapter transitions always show a full loading spinner.
  - **Error/retry states**: `loading` (spinner), `error` (generic, both paged/continuous variants), `noCacheError` (forceLocal debug mode, backend has no cached copy yet, lines 1474-1480/1582-1590). No dedicated retry button — retry is re-navigation-driven.
  - **Loading skeletons**: spinners not skeletons for page load (`imgLoading`, lines 1595-1599) and full-screen spinner for chapter-load (`loading`, lines 1462-1467/1569-1574) — contrast with `BookDetailModal`'s real skeleton placeholders.
  - **Image proxying**: `resolvePages` (lines 631-639) avoids MangaDex CDN hotlink-blocking via Referer header, using either backend-local `/img-cache` paths or a same-origin `/api/img-proxy?url=...` wrapper.
  - **Turnstile/captcha**: full modal/bottom-sheet Cloudflare Turnstile flow gates chapter-page fetches (not user-uploaded `ver:` chapters), shared with translate-flow 401 handling via `resetCaptcha()` (lines 53-57), addressing issue #227 (mid-session token expiry).
  - **Spoiler blur**: not present anywhere in the reader/detail-modal flow — that CLAUDE.md rule targets the Community Forum specifically, a scoping clarification worth noting rather than a defect.

### Frontend/app/hooks/useBookActions.ts
- **last_commit:** eb68e5658d5d8eeffb78c87c11394e25b8135644
- **lines_covered:** 1-56 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Small single-purpose hook — good "extract for testability"/"simplest construct" example. `useState` for `favorited`/`liked`, synced via `sync()` reading `isFavorited(book.id)`/`isLiked(book.id)` from `../lib/userCache` (localStorage-backed).
  - Subscribes to a custom `CACHE_EVENT` on `window` (lines 30-33) so toggling favorite/like from any card updates every card showing that book without Context.
  - Both toggle handlers gate on `user` (from `AuthContext`); unauthenticated clicks call `showLoginPrompt()` — correctly follows the CLAUDE.md rule of never using `alert()` (lines 37, 46).
  - `e?.stopPropagation()` in both handlers (36, 45) — needed since these buttons sit inside a clickable card.

### Frontend/app/hooks/useChapterTranslation.ts
- **last_commit:** 31f7b4d8be5bed764d1c29d9074c5584f71eaa10
- **lines_covered:** 1-427 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Core translation orchestration hook driving all MIT interaction for one open chapter. Extracted from `MangaReader` per issue #142 (doc comment lines 51-55) so the desktop dropdown and mobile sheet consume the same state.
  - ~15 separate `useState` calls (no reducer) each mapping to a distinct, independently-updated UI concern: `translating`/`translatingCurrentPage`/`translatingCurrentPageIndex` (batch vs. single-page flags), `transProgress`, perceived-progress fields (`pageElapsedSec` ticked every 1000ms, `avgPageSec` rolling average, `currentStage` live MIT pipeline stage via SSE `type: "progress"`), `translatedPages`/`patchedPages` as `Map`s (pages complete out of order), `completedTranslatedPages: Set`, `showTranslation`, model selection persisted to `localStorage` (`MANGA_IMAGE_TRANSLATE_MODEL_KEY`), `mitStatus` health-checked on mount and again at `startTranslate()` start (line 191).
  - **Patch tagging confirmed**: both `translateCurrentPage` and `startTranslate` call `translateMangaPagePatches`/`translateMangaChapterBatchPatches` (from `../lib/mangaTranslatePage`) — patches endpoints (`.../pages/:pageIndex/translate-patches`, `.../batch-translate-patches`) return `{xPct,yPct,wPct,hPct,url}` per bubble region, never a whole-image endpoint.
  - Batch translate streams NDJSON-over-SSE via manual `res.body.getReader()` parsing (not `EventSource`, since POST bodies aren't supported by EventSource).
  - **Cancellation**: `translateControllerRef` holds an `AbortController`; cancellation is cooperative at page boundaries only — a page mid-inference finishes and its result is dropped (lines 291-296), explicitly citing `MIT/ARCHITECTURE.md §6, #129` right where a maintainer would need it.
  - **Reset semantics**: three separate effects — chapter change clears everything including `patchedPages`; target-lang/derivative change clears `patchedPages`/`completedTranslatedPages` but deliberately NOT `translatedPages` (different cache key, patches from one derivative must not overlay the other, #156).
  - **Batch ordering**: currently-visible page always moved to front of the batch list (lines 210-217) for instant feedback before the rest finishes — a real perceived-performance optimization.
  - **Retry**: on batch 500/network-error, retries up to 2x with `800ms * attempt` backoff, re-sending only pages not yet in `doneSet` (lines 258-288).
  - **Captcha-expiry (#227)**: `isCaptchaExpiredError(err)` calls `onCaptchaExpired?.()` (wired to `MangaReader`'s `resetCaptcha`) instead of dead-ending on failure.
  - No `apiCache` LRU use — appropriate since translation results are per-request stateful streams, not cacheable GETs.

### Frontend/app/hooks/useChapters.ts
- **last_commit:** f4ac96544b6f6f8ef3894153eb6efd399cb06e90
- **lines_covered:** 1-60 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Single `useState<ChapterPageItem[]>`, fetched in one `useEffect` keyed on `mangaId`.
  - JSDoc (lines 27-31) explicitly documents this as extracted "verbatim" from `MangaReader`'s previously-inline effect for issue #302 — a textbook North Star "extract for testability/surgical change" instance, isolating the chapter-list fetch from Reader's viewport/zoom/translation state.
  - Same merge pattern as `BookDetailModal` (MangaDex + `/versions/title/:mangaId` user uploads, sorted by parsed chapter number) — but this is a **near-duplicate** of `BookDetailModal.tsx` lines 249-272 (both parse chapter numbers, sort identically, filter `backendAvailable !== false`). North-Star-relevant duplication; unification would need a shared result type first (`ChapterPageItem` here vs `MangaChapter` there).
  - All fetch failures degrade to `[]` via `.catch(() => [])` (lines 45-46) — resilient default but no error state/retry surfaced to the caller.

### Frontend/app/lib/chapterAccess.ts
- **last_commit:** f4ac96544b6f6f8ef3894153eb6efd399cb06e90
- **lines_covered:** 1-87 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Pure, dependency-free module — doc comment (lines 3-6) explicitly extracted from `BookDetailModal`'s inline predicates because it is "money-adjacent" (coin-unlock) logic that benefits from being pure/unit-testable rather than closures over component state. A direct, named instance of the North Star's "extract for testability when it pays off."
  - `chapterNeedsBackup(ch)` → true if `ch.isOfflineFallback === true`. `chapterMissingInBackend(ch)` → true if `ch.source === "user" && ch.backendAvailable === false`.
  - `chapterCoinLocked(ch, unlockedVersions)` (lines 33-40): only `source === "user"` chapters can be coin-locked, requires `priceCoins > 0` and a `versionId`; MangaDex chapters are never coin-locked — paywall only applies to user-uploaded translations.
  - `chapterReadable(ch, unlockedVersions)` (42-52): ordered checks — missing-in-backend → false; needs-backup → `readerAvailable === true`; coin-locked → false; else `pageCount > 0`.
  - `unavailableChapterLabel(...)` (54-67) produces exact Thai UI labels: "ไม่มีใน backend", "ไม่ได้สำรอง", `"🪙 {price}"`, generic "ล็อค".
  - Public `chapterAccess(ch, {unlockedVersions})` (76-86) bundles all three — exactly what `BookDetailModal.tsx` (line 406, 1049-1052) consumes. Only one external input (`unlockedVersions: Set<string>`), everything else read off the chapter object — makes it trivially unit-testable without mocking wallet/auth state.

---

## Community Components

### Frontend/app/community/page.tsx
- **last_commit:** a6980f00e4dc7308b446630f32925df1b1b53154
- **lines_covered:** 1-459 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Main community feed/landing page — post list with category/manga/sort filters, create-post modal, live "new posts" banner.
  - Categories/`mangaId` state (lines 28-33) seeded from `useSearchParams()` on mount, re-synced on URL change (effect at 72-75); filter changes go through `router.push` (106-111, 246-250, 260-264) — URL is source of truth, matching the documented "nav state lives in URL query params" pattern.
  - Data fetch via raw `listPosts()` wrapper (`../lib/communityApi`, line 7) — no SWR, no apiCache LRU. `fetchPosts` re-triggered whenever `category`/`mangaId`/`sort` change.
  - `useFeedStream` (line 13, wired 83-87) only increments a `newPostCount` counter (line 85) on `onNewPost` — does not auto-splice new posts. Renders a sticky "มี N โพสต์ใหม่ — คลิกเพื่อดู" banner (293-306) the user must click to trigger a manual refetch (line 297) — a deliberate "pull to refresh" UX avoiding feed-reordering-under-cursor problems.
  - No pagination — `listPosts` returns all items in one shot (line 93), no cursor/offset, no infinite scroll.
  - **Optimistic post-create** (113-175): builds a `tempPost` with fake `id: temp-${Date.now()}` (121-142), prepends immediately, closes modal with the same double-`requestAnimationFrame` animation used for normal opening. On success swaps for server-canonical post by id (line 162); on failure reverts (filters out temp post, restores form state, reopens modal, lines 163-171).
  - Debt: no pagination (scaling wall once volume grows); minor duplicated category-label ternary chains (mobile strip 205-212, desktop chip 259, modal buttons 365-376) vs. a shared label map elsewhere.

### Frontend/app/community/manga/[mangaId]/page.tsx
- **last_commit:** a6980f00e4dc7308b446630f32925df1b1b53154
- **lines_covered:** 1-323 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Per-manga discussion page — subreddit-style, own create-post modal, banner header with manga cover/title.
  - `sort`/`viewMode` are local-only state (lines 20-31), not URL-synced (unlike `community/page.tsx`); `mangaId` from `useParams`.
  - Two-tier metadata fetch: `listPosts({mangaId, sort})` primary; if no post carries `targetMangaTitle`/`targetMangaCover`, falls back to a direct `fetch('/api/proxy/books/${mangaId}')` (`fetchMangaMeta`, lines 36-46) — opportunistic reuse of metadata riding on the posts response before a second dedicated request (52-59).
  - **No SSE wiring at all** in this file — notable live-update parity gap vs. the main community feed (`useFeedStream`/`usePostStream` not used here).
  - Same optimistic temp-post pattern as `page.tsx` (lines 75-127) but simpler — reopens modal on failure without the double-rAF entrance animation (line 123), a minor inconsistency between two near-duplicate create-post flows.
  - **Tech debt (clearest instance found)**: ~80% JSX/logic overlap with `community/page.tsx`'s create-post modal (category chips, title/content inputs, `PostImageUploader`, optimistic temp-post construction) with no shared component extraction — the two copies have already drifted (missing SSE here, missing close-animation timing here vs. there). Candidate for a shared `useCreatePostFlow` hook or `<CreatePostModal>`.

### Frontend/app/community/p/[id]/page.tsx
- **last_commit:** f4ac96544b6f6f8ef3894153eb6efd399cb06e90
- **lines_covered:** 1-594 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Richest community page in scope: single post detail + full comment thread, voting, live SSE, inline edit/delete, spoiler gate, image gallery.
  - Extensive flat `useState` (lines 58-79), no reducer/context despite many interlocking flags — a candidate for `useReducer` but the North Star would generally favor the current flat approach unless flag interactions become error-prone. `voteCounts` is a `Map<string,{upvotes,downvotes}>` keyed `"${targetType}:${targetId}"` (line 77), fed exclusively by SSE. `mountedRef` (line 79) guards against post-unmount setState.
  - Data fetch via `communityApi` (`getPost`/`listComments`/`createComment`/`updatePost`/`deletePost`), run in parallel via `Promise.all` (154-157); `fetchData(silent)` supports silent refetch so comment additions don't retrigger the full skeleton.
  - **`usePostStream`** (line 15, wired 86-115) — most fully-featured SSE consumer in the whole survey, handling 5 event types: `vote` (merge into `voteCounts`), `comment` (append + dedup by id, line 99), `post_edited` (live-patch title/content/updatedAt), `post_deleted` (redirect other viewers), `comment_deleted` (filter out) — real-time collaborative editing/voting, not just a "new content" ping.
  - No comment pagination — `listComments(id)` returns full list.
  - **Optimistic UI**: comment posting clears input immediately (214), awaits `createComment` then appends the real server object (218); on error restores the typed text (222) — a lighter-weight, input-preserving revert strategy vs. the temp-post-with-fake-id pattern used in the other two community pages. Post edit/delete are NOT optimistic (await before updating).
  - **Spoiler-blur — fully CLAUDE.md-compliant, 2 sites**: post body text (459-463) and image gallery (493-494), both `style={{filter: ... ? 'blur(0px)' : 'blur(4px)', transition: 'filter 0.5s ease'}}` — zero Tailwind `blur-sm`/`blur-0` usage. Reveal is one-way (`setSpoilerRevealed(true)`, line 472), gated by `post.category === 'spoiler'`.
  - **Image-XSS check — present and verbatim-compliant** (line 498): `const safeUrl = /^\s*(javascript|data|vbscript|file):/i.test(trimmed) ? '#' : trimmed;` applied before both `href` (502) and `<Image src>` (510).
  - `mountedRef` guard and SSE-comment dedup-by-id (line 99, guards against the author's own optimistic comment double-inserting with the SSE echo) are both real correctness safeguards, not incidental.
  - Tech debt: 594 lines owning post-view/edit/delete-confirm-menu/comment-compose/spoiler-gating in one file with a 5-way SSE switch plus ~10 boolean/derived flags — strongest internal candidate for extracting the "post header actions menu" (347-415) and "spoiler gate" (456-478) into standalone components.

### Frontend/app/community/profile/[uid]/page.tsx
- **last_commit:** f4ac96544b6f6f8ef3894153eb6efd399cb06e90
- **lines_covered:** 1-586 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Public/own user profile page — banner (upload + drag-to-reposition), avatar, bio, role badge, creator earnings panel (own profile only), 3-4 tab content browser (posts/comments/liked/translated).
  - `dragRef` (line 67) is a plain `useRef` (not state) holding transient drag-start coordinates — correctly kept out of React state since only read during pointer-move math (130-133); textbook "use the lightest construct" per North Star.
  - Raw `fetch`-wrapper `getProfile(uid)` (line 75), one shot, no apiCache LRU, no SSE, refetched fresh every mount.
  - Tabs (`posts`/`comments`/`likedPosts`/`translatedTitles`) are all fully materialized arrays from one response; tab switching is pure client-side filtering (488-580), not separate paginated fetches — works because a single profile's content is bounded.
  - Banner reposition drag (119-160) is hand-rolled via `pointermove`/`pointerup` on `document` rather than a drag library — reversible via explicit save/cancel (`handleSavePosition` 147-160, `handleCancelPosition` 162-165 reverts to last-saved value), no partial-save states. Good example of "pick the simplest construct that suffices."
  - No spoiler-blur in this file (no spoiler content of its own; feed posts rendered via `PostCard`, out of scope here).

### Frontend/app/community/trending/page.tsx
- **last_commit:** a6980f00e4dc7308b446630f32925df1b1b53154
- **lines_covered:** 1-138 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Trending-manga grid, ranks by community post-count, links to `/community/manga/[mangaId]`. Simplest of the six community files — minimal `useState` (`trending`, `loading`), no modals/forms.
  - **Only file in the whole community survey using `app/lib/apiCache.ts`'s LRU** (import line 8: `cacheGet, cacheSet, TTL`): cache-first pattern (84-106) with `TTL.MEDIUM` (5 min, correct tier for "quasi-frequently-changing" trending data). However this is cache-first-then-stop, not true stale-while-revalidate — it does NOT background-refresh after a cache hit, a narrower behavior than the "stale-while-revalidate" the module name/CLAUDE.md doc implies. Worth flagging: a visit within 5 minutes of a previous one shows stale counts with no background refresh.
  - Fixed `getTrendingManga(20)` (line 91) — top-20 only, no infinite scroll (appropriate for a "top N" list).
  - Mount-guard via a plain `mounted` boolean (88, 93, 98, 102) rather than `AbortController` — matches CLAUDE.md's "simpler primitive over heavier machinery" philosophy exactly.

### Frontend/app/community/components/CommunityErrorBoundary.tsx
- **last_commit:** a6980f00e4dc7308b446630f32925df1b1b53154
- **lines_covered:** 1-31 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Class-based React error boundary (necessarily a class — no hook equivalent in React 19) wrapping only the main feed page (used at `community/page.tsx` line 449); the other four community routes render without their own boundary.
  - Implements only `getDerivedStateFromError` (no `componentDidCatch`) — caught errors are never logged/reported anywhere, a real observability gap (no console.error, no Sentry-equivalent).
  - Recovery is a hard `window.location.reload()` (line 21) rather than a "reset boundary state" button — simplest possible recovery, trades in-place recovery for reliability.
  - Textbook-minimal implementation — exactly the amount of code needed, no unnecessary generalization.

### Frontend/app/components/CommentThread.tsx
- **last_commit:** 3a646abc8c04935e95fdbe5f3b56ddeeaf1f3d8a
- **lines_covered:** 1-399 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Renders a single comment + its nested reply tree recursively; owns per-comment reply box, inline edit, delete confirm, mobile long-press context menu.
  - `displayContent` (lines 28-31) is a local optimistic mirror of `comment.content`, updated directly in `handleSaveEdit` (line 101) after the network call resolves (not before) — edit is applied post-await, unlike the vote optimistic pattern.
  - Delete sets local `isDeleted=true` (line 129 causes `null` render) — self-hides rather than telling the parent list to prune.
  - Mobile long-press context menu: hand-rolled 500ms long-press on raw Pointer Events with move-cancellation (drag distance² > 100, line 61) — non-trivial custom gesture, no library.
  - **Recursion strategy**: pure recursive component composition — renders itself for `comment.replies` (384-396), incrementing `depth` each level; depth only affects indentation (`ml-4 pl-4 border-l` when `depth > 0`, line 132). **No depth cap** — a deeply nested reply chain recurses/indents indefinitely.
  - **No pagination/"load more" for replies** — the entire reply tree is assumed pre-loaded in `comment.replies` and rendered eagerly.
  - Optimistic-post indicator: a comment with `id.startsWith('temp-')` shows a spinner + "กำลังโพสต์..." (205-213), implying a parent-level optimistic placeholder swapped for the real comment later.
  - Error handling: `handleReply`/`handleSaveEdit`/`handleDeleteComment` all `console.error` in empty `catch{}` (lines 78, 103, 122), no user-facing error toast; `handleReply` clears `replyContent` and closes the box optimistically before the await (115-117) with no restore of the drafted text on failure — a failed reply silently loses the user's draft.

### Frontend/app/components/ForumSideMenu.tsx
- **last_commit:** a6980f00e4dc7308b446630f32925df1b1b53154
- **lines_covered:** 1-285 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Persistent forum sidebar — mini search-as-you-type manga lookup, feed/trending nav, category filter buttons, top-5 trending list, static guidelines block.
  - `getTrendingManga(6)` (line 76) fetches 6 explicitly to detect overflow-beyond-5 (conditionally shows "ดูทั้งหมด" button, line 258, when `trending.length > 5`, even though only top 5 render).
  - Manga search debounced 500ms (`setTimeout`, 101-107), fires only once `searchQuery.length >= 2` (line 103) against `/api/proxy/books/search?q=...&limit=5`.
  - Category list sourced from shared `CATEGORY_LIST` (`../lib/forumCategories`) combined with local `categoryMetadata` (34-67, label+icon) — reasonable split of shared enum vs. presentation metadata.
  - No spoiler-blur, no vote logic, no XSS-relevant URL handling (only internal `Link`/`router.push` navigation).

### Frontend/app/components/ForumSkeleton.tsx
- **last_commit:** b429175979b03429d327bba4e1a2a9e8e653f693
- **lines_covered:** boilerplate, full read (117 lines) but no logic
- **read_date:** 2026-07-04
- **findings:**
  - Purely presentational: `PostSkeleton({viewMode})`, `CommentSkeleton()`, `PostDetailSkeleton()` — no hooks, no state, all `animate-pulse` Tailwind divs mimicking real component shapes. No logic to report.

### Frontend/app/components/PostCard.tsx
- **last_commit:** f4ac96544b6f6f8ef3894153eb6efd399cb06e90
- **lines_covered:** 1-297 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Renders a forum post in two layouts via `viewMode` prop: `'compact'` (Reddit-style thumbnail-left row, 49-158) and `'card'` (Facebook-style block, 161-296).
  - Only local state is `spoilerRevealed` (line 47) — vote state fully delegated to child `VoteButtons` (130-136, 275-281).
  - **Spoiler-blur — matches CLAUDE.md exactly, 3 sites**: compact thumbnail (line 62), card-view body text (line 205), card-view image grid (line 231), all `style={{filter: isSpoiler && !spoilerRevealed ? 'blur(4px)' : 'blur(0px)', transition: 'filter 0.5s ease'}}`. Also gates pointer interaction via `pointer-events-none` while blurred (lines 61, 230) — a sensible companion not covered by the CLAUDE.md snippet itself. Reveal handlers call `e.preventDefault(); e.stopPropagation()` (148, 211) so revealing doesn't also navigate through the wrapping `<Link>`.
  - `MarqueeMangaTag` sub-component (12-42): hand-built marquee/scrolling-text effect via `useLayoutEffect` + direct DOM style manipulation (measures `scrollWidth - clientWidth`, animates only if overflow, content-length-adaptive speed `Math.max(5, overflow/22)` seconds) — a reasonably self-contained "extract for testability" candidate currently inlined rather than extracted.
  - **Image-XSS gap**: no scheme check (`javascript:`/`data:`/etc.) applied to `post.imageUrls` before rendering into `<Image src={url}>` (multiple call sites, e.g. lines 65, 240) — see cross-cutting gap under `PostImageUploader.tsx` below; several images pass `unoptimized` (line 240) presumably because they're arbitrary user-supplied/external URLs not in the `next.config.ts` domain allow-list.

### Frontend/app/components/PostImageUploader.tsx
- **last_commit:** f4ac96544b6f6f8ef3894153eb6efd399cb06e90
- **lines_covered:** 1-179 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Dual-mode image attach widget — "อัพโหลดไฟล์" (upload file) and "ลิงก์รูปภาพ" (image link/URL) tabs, capped at `maxImages` (default 4, line 13).
  - Client-side validation: file `accept` attribute only (advisory, line 134); drag-and-drop DOES check `file.type.startsWith('image/')` before upload (line 60) — the only actual JS-side type check. Regular file-picker path (`handleFileChange`, 50-54) does no type/size check at all.
  - **No client-side file-size check** despite UI copy stating "ไม่เกิน 5MB" (line 149) — the cap is text-only; a too-large file is only discovered via a failed network request. Enforcement is presumably backend-only (consistent with `file-type` magic-byte MIME validation per CLAUDE.md, but the size limit is not mirrored client-side).
  - **Image-XSS check NOT applied** — the clearest deviation from a CLAUDE.md-documented rule found across the community-components survey. `addUrl` (22-26) only does `url.trim()`, dedup check, and the `maxImages` cap; it does NOT run the mandated `/^\s*(javascript|data|vbscript|file):/i.test(...)` check before pushing the raw user-typed URL into `images`, later rendered via `<Image src={url}>` (line 75 here, and in `PostCard.tsx`).
  - Upload flow is direct multipart, not presigned-URL: `handleFileUpload` (37-48) calls `uploadForumImage(file)` (`communityApi.ts`), which builds `FormData` with the raw `File` and does a single `fetch(POST .../forum/upload-image)` through the `/api/proxy` rewrite — backend returns `{imageUrl}` appended to `images` (line 42). No presigned S3 step, no separate confirm step.
  - `dragOver` boolean (line 17) purely for hover affordance styling — appropriately simple, no debounce/complexity.

### Frontend/app/components/VoteButtons.tsx
- **last_commit:** a9dd09b646d7e9468c45464de104d3e1da997c43
- **lines_covered:** 1-129 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Shared upvote/downvote control used by both `PostCard` and `CommentThread` (parameterized via `targetType: 'post'|'comment'`).
  - State (`upvotes`/`downvotes`/`userVote`/`loading`, lines 24-27) seeded from props then locally owned — classic "seed-then-own" pattern.
  - Two carefully-commented resync effects: one resets from `initial*` props only on `targetId` change, deliberately excluding `initialUpvotes`/`initialDownvotes` from deps (32-38) so in-flight optimistic state isn't clobbered by a parent re-render carrying stale props; the other applies SSE-driven external vote counts only when `!loading` (41-46), so an incoming SSE update is dropped while the current user has an in-flight vote request — prevents an external update from stomping optimistic UI mid-flight.
  - **Optimistic vote mechanism** (`handleVote`, 48-88): guards on auth (`showLoginPrompt()`, matching CLAUDE.md convention, never `alert()`) and not-already-loading. Snapshots prev values for revert-on-error (56-58). Toggle-off (clicking same direction again removes vote, 59-65) and toggle/switch (upvote↔downvote in one optimistic step, 67-72) both handled before any `await` — true "apply first" optimistic update. On success overwrites local counts with server-authoritative values (78-79) rather than trusting client-computed numbers, avoiding compounding drift. **On error: reverts** to the exact pre-click snapshot (80-84); `finally` always releases the loading lock.
  - Net score displayed as `upvotes - downvotes` (line 110), Reddit-style single number.
  - Cleanest file of the six community components against the North Star — single-purpose, no unnecessary abstraction, comments justify non-obvious dependency-array omissions.

---

## Search

### Frontend/app/search/page.tsx
- **last_commit:** c77fcc2e86ab6f7021879e74b5714f4308831e52
- **lines_covered:** 1-561 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Full-text book/manga search page (`/search?q=...`), client-side, wrapped in `<Suspense>` (555-561) because it reads `useSearchParams()`.
  - **No debounce at all** — the input (`inputValue`, line 207) only fires a request on form submit (`handleSearch`, 296-300) via `router.push('/search?q=...')`; the actual fetch effect (232-264) is keyed off the URL `query` param (line 205), not `inputValue` — search-as-navigation, not search-as-you-type.
  - **Single server data source**: `GET /api/proxy/books/search` (line 252) — no direct MangaDex client-side calls. A second, local-only source exists: `source: "all" | "mylist"` (line 16) — `"mylist"` pulls from `getFavorites()`+`getHistory()` merged/deduped (`mergeLocal()`, 44-51) and filters client-side by substring on title/authors; the two sources are mutually exclusive, not merged.
  - **Filters**: language (`th`/`en`/`ja`/`all`), status (`ongoing`/`completed`/`hiatus`, toggle-off on re-click), year range (sent as query params only when non-empty), and a dynamically-derived category filter computed from the current result set and narrowed purely client-side (284-294). Everything except category is sent server-side via query string; category filtering happens in-browser over already-fetched results.
  - **Pagination**: server-driven, `PAGE_SIZE = 28` (line 223), `offset = (page-1)*PAGE_SIZE` (line 245), full page-number UI (first/prev/window-of-5/next/last, 464-520).
  - Results render as a 2-6 col CSS grid; each card (`SearchResultCard`, 54-97) uses Next `<Image fill>` with an `onError` fallback rerouting through `/api/img-proxy?url=...` when `thumbnailLocal` was set (65-70) — a workaround for CDNs that block direct client fetches.
  - **URL query-param sync gap**: only `q` is synced to the URL — `source`/`langFilter`/`statusFilter`/`yearFrom`/`yearTo`/`categoryFilter`/`page` all live in local `useState` only, lost on refresh/share-link. Minor inconsistency vs. the Community Forum's documented "all nav state in URL" convention, though the scope here (one search page, not a persistent shared layout) is narrower.
  - Abort handling: `abortRef` (line 222) cancels the in-flight fetch when effect deps change, effect cleanup also calls `ctrl.abort()` (263) — correct race-condition prevention. `.catch` checks `(e as Error).name !== "AbortError"` (line 261) — common but slightly fragile duck-typing, acceptable given narrow scope.

---

## Studio

### Frontend/app/studio/upload/page.tsx
- **last_commit:** a6980f00e4dc7308b446630f32925df1b1b53154
- **lines_covered:** 1-923 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Chapter/page upload wizard — creates a "translation version" (title + chapter + language) and lets a translator upload page images; also doubles as the edit screen for an existing version (`?versionId=`) and supports mobile hand-off from `/studio/search`.
  - Two components in one file: `MangaPickerModal` (52-355, search-and-pick manga modal, with a full-page mobile variant via `asPage`) and `StudioUploadContent` (359-915), wrapped by `StudioUploadPage` (917-923) providing `<Suspense>` for `useSearchParams()`.
  - **Not a multi-step wizard state machine** — plain per-field `useState` (371-380: `titleId/titleName/titleAltName/chapterId/chapterNumber/chapterTitle/language/description/priceCoins`) plus `versionId`/`pages`/`saving`/`scrolled`. Once `versionId` is set, metadata inputs become `disabled={hasVersion}` (e.g. 710, 747, 757, 767) — the "step" transition is implicit, gated by whether a draft version exists server-side, not an explicit step index.
  - `POST /versions` draft creation is guarded by `ensureVersionPromiseRef` (401, 464-502) so concurrent `uploadFile()` calls (e.g. dropping 20 files at once) share one in-flight creation promise instead of racing to create duplicate drafts — deliberate, well-commented concurrency fix (comment block 396-401).
  - Validation is all client-side, ad-hoc, not DTO-mirrored: file type filter `f.type.startsWith("image/")` (561), no dimension/format allow-list, no client-side file-size check despite UI text claiming "สูงสุด 10 MB ต่อไฟล์" (848). `priceCoins`: `Math.max(0, parseInt(e.target.value) || 0)` (795) floors to integer; backend also does `Math.floor` server-side — consistent, but neither side uses the `@IsNumber({maxDecimalPlaces:2})` pattern CLAUDE.md documents for float DTOs (this field is a plain `number` on a hand-typed inline body interface, not a class-validator DTO at all — minor inconsistency, arguably fine since coins are integer-only by design).
  - **Upload mechanism**: native multi-file `<input type="file" multiple accept="image/*">` (826-833) plus drag-and-drop (836-844); each file is one full `FormData` POST — no chunking. Progress is coarse (per-tile spinner overlay while `uploading:true`, 861-865; disabled submit button while any page uploads, 817-823) — no percentage/byte progress.
  - **Optimistic per-file upload**: `uploadFile()` (505-547) immediately pushes a placeholder using `URL.createObjectURL(file)` (508-510), swaps for the server URL on success (531-533, revoking the blob to avoid a leak, 534); on failure the blob tile stays with an `error` flag rendered as an error banner (540-543, 866-870) — good per-file isolation, one failed upload doesn't block the others.
  - **Reordering: not implemented.** Pages render in array-append order only — no drag handle, no up/down button, no reorder API call. Real functional gap for a manga upload flow where page order is load-bearing content; the only fix path today is delete-and-reupload.
  - **No autosave** of metadata — `handleSaveMetadata` (603-624) is a manual "บันทึก" button; draft creation itself is implicitly automatic (triggered by first file upload), but field edits require an explicit click. `handleDone` (648-655) opportunistically calls `handleSaveMetadata` again before navigating away and swallows its error ("Continue anyway if save fails", 653) — pragmatic but silent failure mode.
  - Unmount effect (551-557) revokes remaining `blob:` URLs using a `pagesRef` kept live every render (406-407) specifically so blobs created after mount are still caught — a subtle, correctly-solved stale-closure-in-cleanup bug.
  - Tech debt: hand-rolled body-scroll-lock in `MangaPickerModal` (148-169, manually saves/restores 4 inline style props + `window.scrollTo`), no image dimension/resolution validation anywhere, no error boundary around either component, 923 lines in one file (justified by two cohesive UI states but could split cleanly at the `MangaPickerModal` boundary).

### Frontend/app/studio/wallet/page.tsx
- **last_commit:** da581ebc344d46325a36a2692c325cb954906873
- **lines_covered:** 1-524 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Creator/translator wallet dashboard — balance, income/spending breakdown, monthly analytics charts, creator sales/earnings stats. **Read-only reporting only** — no top-up/purchase flow in this file at all; `useTopupCreate`/`useTopupStream` are NOT imported or used here (those hooks belong to a different, consumer-facing wallet page). Only reads: `getWalletBalance`, `getWalletTransactions`, `getCreatorEarnings` (imports 10-15).
  - **Cache-then-fetch hydration**: initial state reads a synchronous in-memory cache getter (`getCached<T>("wallet:...")`, 153-155) for instant render of stale data while `fetchData()` (165-187) refreshes in background and repopulates the cache (176-177). `hasFetched` ref (161, 190-194) guards against double-fetch under Strict Mode — same idiom confirmed reused verbatim in `account/page.tsx` and `manga/[titleId]/page.tsx`, i.e. a deliberate, consistent Studio-wide convention (not one-off duplication) — the shared mechanism lives in `lib/studioCache.ts`.
  - Responsive split via explicit `useIsMobile()` branch (line 151) into two parallel render trees; mobile flow has its own small view-state machine `WalletMobileView = "menu"|"analytics"|"income"|"spending"` (43, 158, 240-378).
  - Analytics derivation delegated entirely to pure functions in `../lib/dashboardAnalytics` (`getOverviewStats`, `getWalletMonthSummary`, `getDailyWalletSeriesForMonth`, `getWalletMonthlyTotals`, `getAvailableTransactionYears`, imports 33-40), memoized per month/year selection (204-226) — good separation, a testable analytics module rather than inline computation.
  - **No true pagination** on transaction history — fetched once, filtered client-side into income/spending buckets (228-235), rendered in a fixed-height scrollable div (desktop) or full mobile sub-screen — fine at small scale, will not hold up at thousands of transactions (no `limit`/`cursor` param on `getWalletTransactions`).
  - **Modal inconsistency**: `WalletSummaryModal` (84-146) is a plain conditional render with no transition at all (just returns `null` when closed, line 99) — inconsistent with the CLAUDE.md "double rAF enter / setTimeout exit" modal convention that `MangaPickerModal` (upload page) does implement.

### Frontend/app/studio/account/page.tsx
- **last_commit:** da581ebc344d46325a36a2692c325cb954906873
- **lines_covered:** 1-569 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Translator profile editor — bio, spoken/translation languages, country, preferred language, derived "profile completeness" score. **No avatar upload** — avatar shown (250-256, 462-468) is read-only from `user?.photoURL` (the Supabase Auth OAuth photo); no file input, no POST for avatar anywhere.
  - Same house pattern as wallet: `getCached<ProfileCache>("account:profile")` instant hydration (71-77), `hasFetched` ref guard (83, 121-126).
  - **Manual dirty-tracking**: `originalRef` (84) snapshots last-saved values; an effect (145-153) diffs current state against it every render to derive `hasChanges`, gating the Save button's `disabled` (221, 539) — hand-rolled form-dirty tracking, no form library, appropriate for a 4-field form per the North Star's "simplest construct."
  - Editable fields: `bio` (max 500 chars enforced via an actual truncating input handler, `.slice(0,500)`, 319/483 — not just a `maxLength` attribute), `languages: string[]` (multi-select, capped at 10 via a ternary guard in `toggleLanguage`, 155-159), `country` (via `CountrySelect`), `preferredLanguage` (single-select). Validation is purely soft/client-side, no required-field errors.
  - Mobile drill-down: `AccountMobileView = "menu"|"bio"|"languages"|"identity"|"guide"` (42) — same structural pattern as wallet's `WalletMobileView`, confirming a deliberate Studio-wide "split dense desktop page into menu + full-screen sub-views" convention. Scroll-position restoration on "back" (183-213) uses a double-`requestAnimationFrame` (frame1→frame2, 205-207) before restoring `window.scrollY` — a more careful variant of the CLAUDE.md double-rAF modal trick, applied to view transitions instead.
  - Profile completeness computed via `getAccountProfileCompleteness()` from `../lib/dashboardAnalytics` (23, 85-94) — again delegates derived-metric logic to a shared testable module.
  - **Notable unexplained hack**: an effect (128-142) dispatches a synthetic `window.dispatchEvent(new Event("resize"))` on a `requestAnimationFrame` + `setTimeout(180ms)` double-trigger once `loadingProfile` flips false — presumably forcing some layout-dependent component (sticky nav/Lenis instance) to recalculate after content loads. No comment explains why this hack exists — exactly the "prop up fragility instead of fixing root cause" pattern the North Star warns against; a candidate tech-debt/investigate item.

### Frontend/app/studio/manga/[titleId]/page.tsx
- **last_commit:** a6980f00e4dc7308b446630f32925df1b1b53154
- **lines_covered:** 1-446 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Per-title management view — all uploaded chapter "versions" for one manga title, grouped by chapter number, with publish/edit/delete actions per version; the hub a translator lands on after the upload page's `handleDone`.
  - `VersionRow` (28-109) renders a version card with a hand-drawn tree connector (absolute-positioned lines/dots, purely visual, no library); `ChapterGroup` (112-236) groups versions sharing a `chapterNumber` (e.g. two language versions of one chapter) behind a collapsible header using a CSS grid-row animation trick (`gridTemplateRows: open ? "1fr":"0fr"`, 216-217) — a lightweight, dependency-free alternative to JS height measurement. Single-version groups skip the collapse UI entirely and show inline action buttons directly (186-210) — nice UI economy.
  - No aggregate per-title stats (views/sales/revenue) in this file — that lives in the wallet page's earnings section; "stats" here are implicitly just the version list.
  - Same `getCached`/`hasFetched` idiom (247-249, 279-312) as wallet/account — third confirmation of the deliberate shared Studio convention.
  - **Data flow inefficiency**: `getMyVersions(token)` (293) fetches ALL of the translator's versions across all titles, then filters client-side by `titleId` (line 252) — every title-detail page visit re-filters the entire translator catalog rather than hitting a scoped endpoint. Fine at small catalog sizes, a genuine N+1-shaped inefficiency at scale (a `GET /versions?titleId=` server-side filter would be more correct).
  - `publishVersion`/`deleteVersion` (318, 341) both re-trigger a full `fetchVersions()` refetch afterward rather than optimistic local splice — simpler, more correct-by-construction, slightly slower UX.
  - Title display uses a three-tier fallback chain (query param → first loaded version's `titleName` → direct `/api/proxy/books/manga/:titleId` fetch, 243-274) purely to avoid a loading flash — adds branching complexity for what's ultimately a page-title string.
  - Deletion UX uses shared `ConfirmDialog` (438-443) rather than `window.confirm`/hand-rolled modal — good reuse; loading state handled correctly (comment at 337: "don't close yet — let ConfirmDialog show loading spinner").

### Frontend/app/studio/page.tsx
- **last_commit:** a6980f00e4dc7308b446630f32925df1b1b53154
- **lines_covered:** 1-481 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Studio overview dashboard — aggregates "my works" stats + wallet stats + recent transactions + charts.
  - Instant-paint-from-cache (103-106) via `studioCache`'s `getCached`/`setCache`; fetch-once guard via `hasFetched` ref (108, 133-138); `fetchAll` (110-131) runs `Promise.all` of `getMyVersions`/`getWalletBalance`(`.catch`→`{balance:0}`)/`getWalletTransactions`(`.catch`→`[]`), writing both React state and the cache.
  - Derived stats via `useMemo` (140-154) calling into `dashboardAnalytics.ts` — clean separation of "shape raw arrays" from the component.
  - Mobile branch (156-343) has its own local `OverviewMobileView` state machine (`"menu"|"insights"|"wallet"|"activity"`, line 45/107) — a same-route four-screen switcher via plain component state and back buttons, **not** URL query params and **not** a custom window event (contrast with `community/layout.tsx`'s `toggleMobileMenu` event).
  - `RecentTransactionList` (47-96) is a small local presentational component with an inline Thai labels dict — fine, but not extracted to a shared component even though `works/page.tsx` wants similar treatment.

### Frontend/app/studio/works/page.tsx
- **last_commit:** a6980f00e4dc7308b446630f32925df1b1b53154
- **lines_covered:** 1-433 (full)
- **read_date:** 2026-07-04
- **findings:**
  - List of the creator's uploaded titles, grouped by `titleId`, with search/status/language filters and a list/card view toggle.
  - Uses `useProtectedPage()` (line 126) instead of `useAuth()` directly (unlike `studio/page.tsx`) — inconsistency in the auth-access idiom between sibling pages (one relies on `StudioLayout`'s own loading gate, the other supplies its own via the wrapping hook).
  - Same cache-first `useState(() => getCached(...))` + `hasFetched` ref guard pattern as the rest of Studio.
  - View-mode preference persisted to `localStorage` (`"mb:studio:viewMode"`, 140-142/144) — a different persistence mechanism than the `studioCache` module used elsewhere in the same page.
  - Filtering/grouping (`mangaGroups`, 169-185) computed inline in a `useMemo`, NOT extracted into `dashboardAnalytics.ts` despite being the same category of "shape raw versions into UI-ready groups" work that module exists for — a missed extraction opportunity per the North Star, currently only testable by mounting the whole page.
  - Second, independently-implemented mobile view-switcher: `WorksMobileView = "browse"|"filters"` (line 37/136) — structurally identical to `studio/page.tsx`'s `OverviewMobileView` but hand-rolled separately rather than shared.
  - `StatusDots` sub-component (62-70) tallies published/draft counts inline via an ad hoc reduce that duplicates the shape of `getVersionStatusBreakdown` already in `dashboardAnalytics.ts`.

### Frontend/app/studio/search/page.tsx
- **last_commit:** f4ac96544b6f6f8ef3894153eb6efd399cb06e90
- **lines_covered:** 1-257 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Full-screen manga search used when attaching a new translation to a book; on selection writes to `sessionStorage` (`mb:studio:selectedBook`, line 83) and calls `router.back()` — hand-off pattern rather than route params or global state.
  - Manual debounce via `setTimeout` (400ms, `SEARCH_DEBOUNCE_MS` line 12) plus a `searchRequestRef` counter (36, incremented 59, checked 64/68/72) to discard stale in-flight responses — a lightweight hand-rolled race-condition guard functionally similar to `AbortController` but without actual request cancellation. `MIN_SEARCH_QUERY_LENGTH = 2` (line 13).
  - Uses `useLocalLenis` (line 40) for the results scroll container — same local-Lenis pattern documented for the community sidebar, reused here.
  - Wrapped in `<Suspense>` (250-256) despite not calling `useSearchParams()` anywhere in the file — looks like defensive/boilerplate `Suspense` rather than functionally required.
  - **Third distinct auth-guard pattern** in Studio: manual `useEffect` redirect (`if (!loading && !user) router.replace("/")`, lines 42-44) rather than `useProtectedPage()` or relying on `StudioLayout`'s RBAC gate — this page does its own auth check independently.

### Frontend/app/studio/lib/dashboardAnalytics.ts
- **last_commit:** a9dd09b646d7e9468c45464de104d3e1da997c43
- **lines_covered:** 1-291/292 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Pure functions turning raw `ChapterVersion[]`/`WalletTransaction[]` arrays into stats/chart-ready shapes — no React, no fetch, no side effects (only imports are the two data-model types). **The cleanest match in the entire Studio survey to the CLAUDE.md North Star's "extract for testability" example** (directly analogous to the `server/webhook.py` case cited in CLAUDE.md) — trivially unit-testable with plain arrays, no context/router/auth mocking needed.
  - `getOverviewStats(versions, transactions, balance)` (58-94): `totalWorks` (unique titleId count), `totalChapters`, `totalPages` (sum of page counts), `languages` (unique count), `paidChapters`, status counts (published/draft/pending/rejected/approved), wallet aggregates (`topupTotal`, `rewardTotal`=reward+refund, `spendingTotal`=purchases), `avgQuality`, `avgPrice` (over paid versions only).
  - `getVersionStatusBreakdown`/`getLanguageBreakdown`/`getTopTitlesByChapterCount` (96-144) produce `BreakdownDatum[]` (`{label,value,tone}`) for donut/bar charts, filtering zero-count buckets, cycling a 6-color tone palette by index.
  - `getWalletFlowLastDays`/`getWalletMonthlyTotals` (146-200) — time-bucketed series via `Map` keyed by day/month, pre-seeded with empty buckets so gaps show as zero rather than being absent.
  - Also exports (used by wallet/account pages, confirmed by cross-reference): `getAvailableTransactionYears`, `getDailyWalletSeriesForMonth`, `getWalletMonthSummary`, `getAccountProfileCompleteness` (checklist-based profile-completeness percentage).
  - `formatCurrency`/`formatCompactNumber` (50-56) wrap `Intl.NumberFormat("th-TH", ...)` — locale-correct Thai number formatting centralized rather than reimplemented per component.

### Frontend/app/studio/layout.tsx
- **last_commit:** 6beae980a7511e7cfb90137e6382917e22f9a76e
- **lines_covered:** 1-142/143 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Pure RBAC gate, NOT a navigational shell (explicit docstring, lines 11-18): unauthenticated → redirect `/`; authenticated with `role:'user'` → onboarding/upsell screen; authenticated with `translator|creator|admin` → render children.
  - `isAuthorized` check (line 66) is a flat inline OR (`userRole === "translator" || "creator" || "admin"`) — no role table/config.
  - Non-authorized branch (68-138) renders a full marketing/onboarding page with a "Become Creator" CTA wired to `becomeTranslator(token)` then `refreshSession()` to pick up the new role from a refreshed JWT (32-52).
  - Authorized branch is just `<div className="min-h-dvh bg-[#141414]">{children}</div>` — no chrome/nav injected at the layout level.
  - **Diverges materially from `community/layout.tsx`'s pattern** (per CLAUDE.md): Community's layout owns cross-page nav state (URL query params for category/manga filter) and a custom `toggleMobileMenu` window event for a mobile drawer. Studio's layout owns zero navigation state — navigation is instead per-route (`StudioNav.tsx` derives the active tab from `usePathname()` against a static table, works because Studio sections are separate routes, not one route with query-param sub-state). Studio's mobile-nav equivalent is not a drawer+window-event at all — each page implements its own local view-switcher (see `page.tsx`/`works/page.tsx` above) rendered inside the page body, not the layout — a materially different, duplicated-across-pages approach.

### Frontend/app/studio/components/StudioDashboardWidgets.tsx
- **last_commit:** a6980f00e4dc7308b446630f32925df1b1b53154
- **lines_covered:** 1-446/447 (full)
- **read_date:** 2026-07-04
- **findings:**
  - **No charting library used at all** (no Recharts/Chart.js/D3/Victory) — every chart is hand-rolled inline SVG: `LineChart` (163-237, manual path-string construction, fixed `viewBox="0 0 720 256"`, responsiveness via viewBox scaling not resize-observer measurement, 5 gridlines + area fill + point circles), `GroupedBarChart` (239-322, side-by-side income/spending bars, shares `LegendRow`), `HorizontalBreakdownChart` (324-359, proportional horizontal bars), `DonutChart` (361-446, manual `stroke-dasharray`/`stroke-dashoffset` ring segments via `reduce`-accumulated cumulative offset, 376-392).
  - All four guard on empty/all-zero data with a shared `EmptyChartState` (155-161); each SVG has `role="img" aria-label` + `<title>` for accessibility (196, 263, 338, 395).
  - `TONE_STYLES` (7-57): a 7-tone design-token object (`text`/`border`/`bg`/`fill`/`softFill` per tone) reused by `MetricCard`, `LegendRow`, and all four charts via `getToneStyles()`.
  - Anti-pattern: because charts are entirely custom SVG, there's no built-in tooltip/hover interactivity, no legend auto-generation, and any new chart type means writing another manual geometry function — reasonable "simplest construct that suffices" tradeoff for a handful of static charts today, but duplicated axis/gridline code between `LineChart` (201-211) and `GroupedBarChart` (268-278) is nearly identical and could be factored into a shared helper — a scaling risk if the analytics surface grows.

### Frontend/app/studio/components/StudioMobileShell.tsx
- **last_commit:** 1a760b7a192f918c23fa7cdbcac80b87d9f0505b
- **lines_covered:** 1-129/130 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Purely presentational, no state, no drawer: `StudioMobileHeader` (sticky header + optional back button), `StudioMobileHero` (eyebrow/title/description/aside), `StudioMobileMenuCard` (tappable row card with icon/title/description/value badge, tone-styled), `StudioMobileSection` (titled section wrapper).
  - Every "navigate to sub-view" affordance is just an `onClick` prop the parent page wires to its own local `setMobileView(...)` — confirms there is **no shared mobile-drawer mechanism** analogous to community's `toggleMobileMenu` window event; Studio's mobile UX is "swap the whole screen's content by local enum state," not "open an overlay drawer."

### Frontend/app/studio/components/StudioSelect.tsx
- **last_commit:** 1a760b7a192f918c23fa7cdbcac80b87d9f0505b
- **lines_covered:** 1-182/183 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Hand-built `<select>` replacement (not native `<select>`, not headless-UI/Radix). Two-phase open/close: `open` drives animation classes, `renderPanel` keeps the DOM node mounted for a 200ms exit transition before actual unmount (`closeTimerRef` `setTimeout`, 66-82).
  - Opening uses `requestAnimationFrame` (113-117) to mount then trigger the transition on the next frame — matches the CLAUDE.md double-rAF-style enter convention (here single rAF + a mount step, not literally nested rAFs).
  - `checkFlip` (34-40) measures `getBoundingClientRect()` vs `window.innerHeight` to flip the panel upward if insufficient space below, recalculated on resize/scroll while open (51-64). Click-outside-to-close via `mousedown` document listener (42-49). Uses `useLocalLenis` (32) for the option list's internal scrolling.

### Frontend/app/studio/components/StudioSkeleton.tsx
- **last_commit:** b62f9ec2e34a9493f87f85df23c8cdab86dae7bd
- **lines_covered:** 1-207/208 (full)
- **read_date:** 2026-07-04
- **findings:**
  - 5 skeleton components mirroring real page structure to minimize layout shift: `StudioOverviewSkeleton`, `StudioWorksSkeleton` (branches on list/card view mode exactly like the real `works/page.tsx`), `StudioChaptersSkeleton`, `StudioWalletSkeleton`, `StudioAccountSkeleton` — all built from one shared `SkeletonPulse` primitive.

### Frontend/app/studio/components/CountrySelect.tsx
- **last_commit:** a9dd09b646d7e9468c45464de104d3e1da997c43
- **lines_covered:** 1-162 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Structurally near-identical to `StudioSelect.tsx` (same `renderPanel`/`open`/`dropUp` triple-state, same rect-measuring flip logic 33-39, same rAF-open/200ms-timeout-close lifecycle 41-58, same click-outside handler 60-68) but implemented as a second, fully independent copy rather than built on top of `StudioSelect`.
  - Differences: filterable text-input+dropdown (search-as-you-type against `COUNTRIES`, 28-31) rather than a plain option list; offers a "use this value anyway" freeform passthrough when no country matches (143-155).
  - **Clearest concrete duplication/tech-debt point found across the entire Studio survey**: two ~90%-overlapping dropdown implementations (183 + 163 lines) that could reasonably be one component with a variant prop — directly contrary to the North Star's "remove complexity rather than prop it up" / "pick the simplest construct that suffices."

### Frontend/app/studio/components/studioTabs.tsx
- **last_commit:** 1a760b7a192f918c23fa7cdbcac80b87d9f0505b
- **lines_covered:** 1-69 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Static tab table `STUDIO_TABS` (overview/works/wallet/account, each with key/Thai label/href/inline SVG icon factory) plus one pure helper `getActiveStudioTab(pathname)` mapping a pathname prefix to a tab key. Small, pure, easily testable — a good extraction in the same spirit as `dashboardAnalytics.ts` but for navigation rather than stats.

### Frontend/app/studio/components/StudioNav.tsx
- **last_commit:** 1a760b7a192f918c23fa7cdbcac80b87d9f0505b
- **lines_covered:** boilerplate, skimmed only (37 lines)
- **read_date:** 2026-07-04
- **findings:** Boilerplate — renders `STUDIO_TABS` as a desktop-only (`hidden md:block`) horizontal tab bar using `usePathname()` + `getActiveStudioTab`.

### Frontend/app/studio/components/ConfirmDialog.tsx
- **last_commit:** a6980f00e4dc7308b446630f32925df1b1b53154
- **lines_covered:** boilerplate, skimmed only (70 lines)
- **read_date:** 2026-07-04
- **findings:** Boilerplate reusable confirm modal (double-rAF enter animation, Escape-to-cancel, focus-on-open). Note: returns `null` immediately once `open` is false rather than delaying via `setTimeout` for its exit transition — the declared exit-transition classes never actually get to play, a small deviation from the documented modal-animation convention depending on how callers toggle `open`.

### Frontend/app/studio/components/CoverImage.tsx
- **last_commit:** a6980f00e4dc7308b446630f32925df1b1b53154
- **lines_covered:** boilerplate, skimmed only (36 lines)
- **read_date:** 2026-07-04
- **findings:** Boilerplate — Next `<Image>` wrapper with `onError` → emoji fallback (📚).

### Frontend/app/studio/lib/countries.ts
- **last_commit:** b62f9ec2e34a9493f87f85df23c8cdab86dae7bd
- **lines_covered:** boilerplate, skimmed only (28 lines)
- **read_date:** 2026-07-04
- **findings:** Boilerplate — static `COUNTRIES` array (26 countries, `{code,label}`), sorted with `localeCompare(..., "th")`.

---

## Auth Context

### Frontend/app/contexts/AuthContext.tsx
- **last_commit:** 8f97d873ad2ca4c848c8ec05605fb498c6f1011d
- **lines_covered:** 1-817 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Consumes a pre-built Supabase client singleton from `../lib/supabase` (line 14) — does not construct the client itself.
  - **`AppUser` shape** (30-43): `{uid, id, email, displayName, photoURL, emailVerified, role?, providerData[]}`. `uid` and `id` are both set to `u.id` (70-71) — a Firebase-era compatibility shim (Firebase-style `uid` alongside Supabase-native `id`) so old call sites using either name still work.
  - **`adaptUser` mapping** (53-79): `displayName` from `user_metadata.display_name ?? full_name ?? name` (56), `photoURL` from `user_metadata.avatar_url ?? picture` (57), `role` from `user_metadata.role` (58) — role initially comes from Supabase JWT/user metadata, later overwritten by a backend profile fetch when available. `providerData` mapped from `u.identities[]` via `mapProviderId` (46-51) which translates Supabase's `google`/`facebook`/`email` into Firebase-style `google.com`/`facebook.com`/`password`. `emailVerified` from `!!u.email_confirmed_at` (75).
  - **Backend profile merge** (`extractBackendProfile` 87-110, `fetchBackendProfile` 243-254): calls `GET /api/proxy/users/me`, tries several response shapes/field-name variants, merges `displayName`/`photoURL`/`role` on top of the Supabase-derived `AppUser` (282-292) — backend is the source of truth for role, Supabase for identity.
  - **Session persistence**: no explicit refresh scheduling in this file — relies on Supabase client's own auto-refresh. `onAuthStateChange` (line 262) is the single source of truth, updating `sessionRef`/`supabaseUserRef`/`user`/`loading` on every event. `getIdToken()` (221-225) calls `supabase.auth.getSession()` fresh each time (no caching). `refreshSession()` (706-718) explicitly calls `supabase.auth.refreshSession()` and re-merges the backend profile, exposed in the context type for callers needing updated JWT claims (e.g. after a role change).
  - **Cross-account cache isolation**: if `lastUidRef.current` differs from the new session's uid (270-277, 299-304), calls `clearUserCache()`, `clearHistory()`, `clearAllApiCache()` BEFORE switching — confirms `clearAllApiCache()` fires exactly at the auth-state-change boundary per CLAUDE.md. Also repeated (belt-and-suspenders) in `signOut()` (504-513) and `deleteAccount()` (680-697).
  - **OAuth flow is popup-based, not full-page redirect**: `supabase.auth.signInWithOAuth({provider, options:{redirectTo, skipBrowserRedirect:true}})` (402-405, 413-416) gets a URL but suppresses the browser's own redirect; opened via `window.open` into a 500×650 popup (`openOAuthPopup`, 323-397). The popup's `/auth/callback` page (URL built by `getOAuthCallbackUrl()`, resolved from `window.location.origin` at call-time so it matches dev IP/tunnel domain/etc.) `postMessage`s a `{type:"supabase:oauth:callback", access_token, refresh_token, error_code?/error?}` payload back to the opener (341-380). Opener calls `supabase.auth.setSession()` only if its own `getSession()` came back empty (373-378) — fallback for browsers with per-window localStorage isolation. A `setInterval` poll every 500ms (384-396) detects manual popup close, rejecting with `code:"auth/popup-closed-by-user"`. Error-code mapping (352-368) translates Supabase codes into Firebase-style codes (`auth/credential-already-in-use`, `auth/email-already-in-use`). After popup resolves, both `signInWithGoogle`/`signInWithFacebook` call `reloadPage()` (408, 419) — a full page reload post-login rather than a soft state update.
  - **`showLoginPrompt()` mechanics** (201-215): does NOT directly open a modal — shows a toast (`info` type) with Thai "กรุณาเข้าสู่ระบบเพื่อใช้ฟีเจอร์นี้" and an action button "เข้าสู่ระบบ" whose click dismisses the toast then calls `setLoginOpen(true)` (209-211) — the modal only opens if the user clicks the toast button. Separately, `openLoginModal()` (217-219) skips the toast for direct-open callers (e.g. a dedicated Login nav button). Confirms CLAUDE.md's "never `alert()`" convention is followed exactly.
  - **Login modal lazy-loaded via a CJS `require()`** inside a small wrapper component (`LoginModalLazy`, 811-815, `eslint-disable no-require-imports` at 812) rather than `next/dynamic`/top-level import, explicitly commented as avoiding a circular-import issue at module evaluation time (line 810) — an unconventional but pragmatic pattern.
  - **No hardware-ID header logic anywhere in this file** — only ever sends `Authorization: Bearer <token>` (e.g. lines 233, 246, 620, 687, 726, 743). Confirms `HardwareIdMiddleware` HWID injection (per CLAUDE.md) happens elsewhere (proxy layer or a chapter/upload-specific fetch wrapper), not in the shared auth context.
  - **Error handling**: most Supabase calls destructure `{data,error}` and `throw error` directly, propagating raw `AuthError`. Some paths synthesize Firebase-style `.code` errors (`auth/invalid-credential` 459, `auth/wrong-password` 546/664, `auth/email-already-in-use` 442). Many best-effort background syncs swallow errors silently (`syncToBackend` 228-241 empty catch commented "non-critical"; photo-history get/save 720-749).
  - **Memoization with a documented paper trail**: context `value` wrapped in `useMemo` keyed only on `[user, loading]` (759-798), with a code comment (759-765) documenting a prior bug (#152) where an unmemoized value caused every `useAuth()` consumer to re-render on any provider state change (including `loginOpen` toggling), and stating an audit was done 2026-06-06 confirming every exposed callback only closes over `user`. Good example of documented, narrow-scope optimization matching the North Star's "optimize the hot path, keep clarity" — but creates a maintenance hazard: any future addition to `value` reading `loading`/new state would silently go stale unless the comment/dep array is updated.
  - `switchToConflictingAccount` (751-754) is an explicit no-op stub "kept for API compatibility" — another Firebase-migration leftover.
  - **Overall theme**: this file is visibly a Firebase→Supabase Auth migration with deliberate compatibility shims throughout (uid/id duplication, provider-id translation, Firebase-style error codes) — reasonable isolated compatibility debt rather than accidental complexity, candidate for eventual cleanup once all UI consumers are confirmed Supabase-native.

### Frontend/app/contexts/ToastContext.tsx
- **last_commit:** b429175979b03429d327bba4e1a2a9e8e653f693
- **lines_covered:** 1-230 (full)
- **read_date:** 2026-07-04
- **findings:**
  - Single-toast (not stacked) notification system, fixed-position bottom banner. `useState<(ToastOptions & {key:number}) | null>` (line 102) — calling `showToast()` again while one is visible REPLACES it immediately, no queue, no stacking. Each toast gets an incrementing `key` (`keyRef`, 111) to force the progress-bar animation to restart even if the same message/type repeats.
  - Auto-dismiss default `duration=4000`ms (133, 157); `duration=0` disables auto-dismiss (used for the "unverified email" warning toast in `AuthContext`, line 466). Two-phase dismissal: `setVisible(false)` immediately (starts CSS transition, `duration-300`), then actual `setToast(null)` after a 300ms `closeTimer` (117-121, 135-138) so the exit animation finishes before unmount — matches CLAUDE.md's "setTimeout for exit" convention. Enter uses a single `setTimeout(() => setVisible(true), 10)` (line 131) — a simpler variant of "let DOM paint before flipping the visible class," not literally double-rAF, but same purpose.
  - **No dedup logic** — `showToast` always clears pending timers and stomps the previous toast state (124-129), last-call-wins.
  - Action button supports async `onClick` — if it returns a Promise, `actionLoading` is set true, spinner replaces the label (194-201), progress bar hidden while loading, `dismissToast()` fires in a `finally` once the promise settles (148-152); synchronous handlers must manage dismissal themselves (comment line 154).

### Frontend/app/hooks/useForumStream.ts
- **last_commit:** f994c47c905735146aad8042339b77290fab8274
- **lines_covered:** 1-115 (full)
- **read_date:** 2026-07-04
- **findings:**
  - **Naming note (explicitly checked)**: the file's first/main export is `usePostStream` (line 24) — there is no hook literally named `useForumStream` anywhere in the codebase; the filename doesn't match its primary export. **`useFeedStream` IS a second export in this same file** (lines 72-115) — it is not a separate file (confirmed: `Frontend/app/hooks/useFeedStream.ts` does not exist in `origin/main`; directory listing has no such file). CLAUDE.md's reference to "useForumStream/useFeedStream hooks" is accurate insofar as both hooks live together in this one file, just under differently-named exports.
  - `usePostStream` (18-65) connects to `/api/proxy/forum/posts/${postId}/stream` (line 33); handles a `ForumStreamEvent` union (6-12): `vote`, `comment`, `post_edited`, `post_deleted`, `comment_deleted`, `heartbeat` (filtered out before forwarding, line 39).
  - `useFeedStream` (67-115) connects to `/api/proxy/forum/feed/stream` (81); handles `FeedStreamEvent` union (14-16): only `new_post` and `heartbeat`, only `new_post` forwarded (87).
  - **Reconnect/backoff** (identical shape in both, 46-53/96-103): exponential, `delay = min(1000*2^retries, 30000)`ms, retry counter capped at 6, plateaus at 30s ceiling after ~5 retries. Retry counter resets to 0 on any successful message for `usePostStream`; for `useFeedStream` reset only happens on `new_post` messages specifically (line 89) — heartbeats do NOT reset the feed-stream retry counter, a subtle asymmetry between the two hooks. Both use a ref-wrapped callback (`onEventRef`/`onNewPostRef`) so the connection isn't torn down merely because the caller passed a new inline function each render.

### Frontend/app/hooks/useHorizontalScroll.ts
- **last_commit:** 6beae980a7511e7cfb90137e6382917e22f9a76e
- **lines_covered:** 1-25 (full)
- **read_date:** 2026-07-04
- **findings:** Thin wrapper exposing `{ref, canScrollLeft, canScrollRight, update, scrollBy}`; delegates left/right-edge detection to a pure helper `computeScrollState()` in `../lib/horizontalScroll` — extracted for testability per the North Star. `scrollBy` moves 75% of the container's `clientWidth` per click.

### Frontend/app/hooks/useIsMobile.ts
- **last_commit:** 1a760b7a192f918c23fa7cdbcac80b87d9f0505b
- **lines_covered:** 1-18 (full)
- **read_date:** 2026-07-04
- **findings:** Wraps `window.matchMedia` for a `max-width` breakpoint (default 767px); listens to the modern `change` event, not the deprecated `addListener`. Textbook implementation, nothing unusual.

### Frontend/app/hooks/useLocalLenis.ts
- **last_commit:** 644465899dda5ff676dfd3c7f2e25403072b5c1b
- **lines_covered:** 1-62 (full)
- **read_date:** 2026-07-04
- **findings:** Wires a local (non-root) Lenis smooth-scroll instance to a given ref — the mechanism behind CLAUDE.md's "community sidebar has its own local ReactLenis instance" note (this is the imperative/manual Lenis API, a distinct integration style from a `<ReactLenis>` component wrapper, both apparently present in the codebase). Manually drives Lenis via `requestAnimationFrame` (82-86) rather than an external RAF driver. Explicitly stops wheel/touch event bubbling on the scroller element (`stopBubbling`, 88-94) to prevent the local scroll from also scrolling the global root Lenis instance — an important nested-scroll-area isolation detail. Accepts an optional external `instanceRef` (56) so parents can reach into the Lenis instance externally, and an optional separate `contentRef` distinct from the wrapper `ref`.

### Frontend/app/hooks/useProtectedPage.ts
- **last_commit:** 8a62e45cfd736f089ace2ee254b8e17ac9212c64
- **lines_covered:** 1-22 (full)
- **read_date:** 2026-07-04
- **findings:** Auth-gate helper redirecting to `/` once `!auth.loading && !auth.user`. Explicitly documented (comment, lines 16-21) as a dedup of a previously copy-pasted `useEffect` pattern across studio/account/wallet/works pages — a direct, self-documented North Star "extract for testability/dedup" instance. Returns the full `useAuth()` context so callers get both the guard and auth data from one hook call. Note: only `works/page.tsx` in the Studio survey actually uses this hook (`page.tsx`/`search/page.tsx` each implement their own separate auth-guard idiom — see Studio section).

### Frontend/app/hooks/useSystemStatus.ts
- **last_commit:** eb68e5658d5d8eeffb78c87c11394e25b8135644
- **lines_covered:** 1-43 (full)
- **read_date:** 2026-07-04
- **findings:** Subscribes to `/api/proxy/status/stream` SSE, filters events by `serviceName` match, returns a single `ServiceStatus` (`online`/`offline`/`maintenance`/`unknown`). **No manual reconnect/backoff** — comment explicitly relies on native `EventSource` auto-reconnect, unlike `useForumStream.ts`'s hand-rolled exponential backoff. A real pattern inconsistency across the app's three SSE hooks (native auto-reconnect here vs. hand-rolled capped backoff there) — not necessarily wrong (simpler is fine for a low-stakes status indicator) but worth flagging for maintainability.

### Frontend/app/hooks/useTopupCreate.ts
- **last_commit:** 34806f147d5803a4cb2d42b136eec40f97ecead3
- **lines_covered:** 1-52 (full)
- **read_date:** 2026-07-04
- **findings:** Manages coin top-up amount selection (fixed tiers `[20,50,100,200,500,1000]`) or custom amount; `handleProceed()` calls `createTopup(token, amount)` from `../lib/studioApi`. Pure helper `computeEffectiveAmount` is exported standalone and has a companion `useTopupCreate.test.ts` in the repo — another testability-extraction example. `canProceed` gates on `effectiveAmount >= 20` (smallest tier).

### Frontend/app/hooks/useTopupStream.ts
- **last_commit:** 34806f147d5803a4cb2d42b136eec40f97ecead3
- **lines_covered:** 1-92 (full)
- **read_date:** 2026-07-04
- **findings:** Tracks a top-up payment's live status via three cooperating effects: (1) a 1-second countdown to `expiresAt` flipping status to `"expired"` client-side; (2) an SSE subscription (`subscribeTopupStream`) that only runs while `status==="pending"`, dispatching a global `mb:coin-balance-update` CustomEvent on success so other components (e.g. a wallet balance widget) react without prop drilling; (3) a `visibilitychange` fallback re-polling `getTopupStatus()` when the tab regains focus — explicitly there to catch a payment confirmed while the user was away (e.g. in a banking app) whose SSE connection may have been suspended by a backgrounded tab. Uses refs (`getIdTokenRef`, `statusRef`) to keep effects from re-subscribing due to new closure identities — mirrors the same ref-stabilization pattern in `useForumStream.ts`. Has a companion test file confirming the extracted pure countdown helper is unit-tested.
