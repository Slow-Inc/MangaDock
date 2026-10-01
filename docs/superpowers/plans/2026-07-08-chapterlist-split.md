# ChapterList Split (#584) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `ChapterList` from `BookDetailModal` so the chapter section is a self-contained component that owns its own fetch, unlock state, Lenis scroll, and `TopupModal`.

**Architecture:** Three-file change — add `ActiveChapter` type to `manga.ts`, create `ChapterList.tsx` (~280 LOC, moves the 250-LOC inline block + 5 state vars + 5 refs + 3 effects + 1 hook call), then slim `BookDetailModal.tsx` down by ~300 LOC replacing the chapter block with a single `<ChapterList />` usage. `onReadyState` callback surfaces `loading / firstReadable / isEmpty` back to BookDetailModal for its CTA buttons.

**Tech Stack:** React 19, Next.js 16, TypeScript, Lenis, `useChapterUnlock`, `cacheOrFetch`/`apiFetch`, `chapterAccess`

## Global Constraints

- **Behaviour-preserving only** — no visual change, no logic change, no new feature
- **TypeScript strict** — zero new errors; verify with `cd Frontend && bunx tsc --noEmit 2>&1 | grep -v "MermaidRenderer"` after each task
- **ESLint file-scoped, no `--fix`** — `bunx eslint <files> --max-warnings 0`; introduce zero new findings vs HEAD for touched files
- **NEVER run `npm run lint`** (repo-wide `eslint --fix` would reformat ~123 unrelated files)
- **Do not commit** `.gitignore`, `Backend/.env.example`, `dashboardv2/`, `scripts/notify.ps1`, or any docs file not part of this task
- **Integration branch:** `feat/frontend-ui`

---

### Task 1: Export `ActiveChapter` type from `manga.ts`

**Files:**
- Modify: `Frontend/app/lib/types/manga.ts` (append 5 lines)
- (`Frontend/app/lib/types/index.ts` already has `export * from './manga'` — no change needed)

**Interfaces:**
- Produces: `ActiveChapter` — imported by Task 2 (`ChapterList.tsx`) and Task 3 (`BookDetailModal.tsx`)

- [ ] **Step 1: Add `ActiveChapter` export to `manga.ts`**

  Append after the `MangaChapter` type (after line 38):

  ```ts
  export type ActiveChapter = {
    id: string;
    chapterNumber: string | null;
    title: string | null;
  };
  ```

- [ ] **Step 2: Verify TypeScript — no new errors**

  ```bash
  cd Frontend && bunx tsc --noEmit 2>&1 | grep -v "MermaidRenderer" | head -20
  ```

  Expected: empty output (zero errors).

- [ ] **Step 3: Commit**

  ```bash
  cd Frontend && git add app/lib/types/manga.ts
  git commit -m "types: export ActiveChapter from manga.ts (#584)"
  ```

---

### Task 2: Create `ChapterList.tsx`

**Files:**
- Create: `Frontend/app/components/ChapterList.tsx`

**Interfaces:**
- Consumes from Task 1: `import type { LandingBook, MangaChapter, ActiveChapter } from "../lib/types";`
- Produces: `export default function ChapterList(props: ChapterListProps)` — consumed by Task 3

- [ ] **Step 1: Create `Frontend/app/components/ChapterList.tsx` with the full implementation**

  ```tsx
  "use client";

  import { useCallback, useEffect, useRef, useState } from "react";
  import type Lenis from "lenis";
  import TopupModal from "./TopupModal";
  import { useChapterUnlock } from "../hooks/useChapterUnlock";
  import { useLocalLenis } from "../hooks/useLocalLenis";
  import { apiFetch } from "../lib/apiFetch";
  import { cacheOrFetch, TTL } from "../lib/apiCache";
  import { chapterAccess } from "../lib/chapterAccess";
  import { addToHistory } from "../lib/readingHistory";
  import { useAuth } from "../contexts/AuthContext";
  import type { LandingBook, MangaChapter, ActiveChapter } from "../lib/types";

  const API_BASE = "/api/proxy";

  type ChapterRowInnerProps = {
    ch: MangaChapter;
    isTreeChild: boolean;
    isLast?: boolean;
    unlockedVersions: Set<string>;
    effectiveHighlightId?: string;
    purchasingId: string | null;
    highlightRef: React.RefObject<HTMLButtonElement | null>;
    onSelect: (ch: MangaChapter) => void;
    onPurchase: (ch: MangaChapter) => void;
  };

  function ChapterRowInner({
    ch,
    isTreeChild,
    isLast,
    unlockedVersions,
    effectiveHighlightId,
    purchasingId,
    highlightRef,
    onSelect,
    onPurchase,
  }: ChapterRowInnerProps) {
    const access = chapterAccess(ch, { unlockedVersions });
    const readable = access.readable;
    const coinLocked = access.coinLocked;
    const unavailableLabel = readable ? null : access.unavailableLabel;
    const isHighlighted = ch.id === effectiveHighlightId;
    const isPurchasing = purchasingId === ch.versionId;

    const row = (
      <button
        ref={isHighlighted ? highlightRef : undefined}
        onClick={() => {
          if (coinLocked) onPurchase(ch);
          else if (readable) onSelect(ch);
        }}
        disabled={!readable && !coinLocked}
        className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left transition ${
          isHighlighted
            ? "border-blue-400/50 bg-blue-500/10 ring-1 ring-blue-400/30 cursor-pointer"
            : coinLocked
            ? "border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/5 cursor-pointer"
            : readable
            ? "border-white/10 hover:border-white/25 hover:bg-white/8 cursor-pointer"
            : "border-white/5 opacity-50 cursor-not-allowed"
        }`}
      >
        {!isTreeChild && (
          <span className="w-20 shrink-0 text-xs font-semibold text-white">
            ตอนที่ {ch.chapterNumber ?? "?"}
          </span>
        )}
        {ch.title ? (
          <span className="flex-1 truncate text-xs text-white/55">{ch.title}</span>
        ) : (
          <span className="flex-1" />
        )}
        {isHighlighted && (
          <span className="shrink-0 rounded bg-blue-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">
            อ่านค้างไว้
          </span>
        )}
        {ch.source === "user" && (
          <span
            className="shrink-0 rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-medium text-purple-300"
            title={ch.translatorName ? `แปลโดย ${ch.translatorName}` : "แปลโดยผู้ใช้"}
          >
            {ch.translatorName ? ch.translatorName : "ผู้ใช้แปล"}
          </span>
        )}
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
            ch.translatedLanguage === "th"
              ? "bg-blue-500/20 text-blue-300"
              : "bg-white/8 text-white/40"
          }`}
        >
          {ch.translatedLanguage === "th" ? "ภาษาไทย" : ch.translatedLanguage.toUpperCase()}
        </span>
        {coinLocked ? (
          isPurchasing ? (
            <span className="shrink-0 flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              <div className="h-3 w-3 animate-spin rounded-full border border-amber-300/30 border-t-amber-300" />
              ปลดล็อค...
            </span>
          ) : (
            <span className="shrink-0 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              🪙 {ch.priceCoins} ปลดล็อค
            </span>
          )
        ) : readable ? (
          <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
            {ch.pageCount > 0 ? `${ch.pageCount} หน้า` : "พร้อมอ่าน"}
          </span>
        ) : (
          <span className="shrink-0 rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-medium text-white/30">
            {unavailableLabel}
          </span>
        )}
        {readable && (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-white/30">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
          </svg>
        )}
      </button>
    );

    if (!isTreeChild) return row;
    return (
      <div className="relative flex gap-0 pb-1">
        <div className="relative w-6 shrink-0 self-stretch">
          <div
            className="absolute left-2.5 top-0 w-px bg-white/10"
            style={{ bottom: isLast ? "50%" : "0" }}
          />
          <div className="absolute left-2.5 top-4 flex items-center">
            <div className="h-px w-3 bg-white/10" />
            <div className="h-1 w-1 rounded-full bg-white/20" />
          </div>
        </div>
        <div className="flex-1">{row}</div>
      </div>
    );
  }

  type ChapterListProps = {
    book: LandingBook;
    effectiveHighlightId?: string;
    asPage: boolean;
    /** Drives Lenis on/off — caller passes `visible && activeChapter === null` */
    visible: boolean;
    onChapterSelect: (ch: ActiveChapter) => void;
    /** chaptersRef from BookDetailModal — attached to outer div for scroll-to-section */
    sectionRef?: React.RefObject<HTMLDivElement | null>;
    /** Surfaces loading/firstReadable/isEmpty to BookDetailModal for CTA buttons */
    onReadyState?: (loading: boolean, firstReadable: MangaChapter | undefined, isEmpty: boolean) => void;
  };

  export default function ChapterList({
    book,
    effectiveHighlightId,
    asPage,
    visible,
    onChapterSelect,
    sectionRef,
    onReadyState,
  }: ChapterListProps) {
    const [chapters, setChapters] = useState<MangaChapter[]>([]);
    const [loadingChapters, setLoadingChapters] = useState(true);
    const [langFilter, setLangFilter] = useState<string>("all");
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const highlightChapterRef = useRef<HTMLButtonElement>(null);
    const chaptersListScrollRef = useRef<HTMLDivElement>(null);
    const chaptersContentRef = useRef<HTMLDivElement>(null);
    const chaptersLenisRef = useRef<Lenis | null>(null);

    const { user, getIdToken } = useAuth();
    const { coinBalance, unlockedVersions, purchasingId, topupOpen, setTopupOpen, purchase } =
      useChapterUnlock({
        titleId: book.id,
        user,
        getIdToken,
        onUnlocked: (ch) => {
          addToHistory({ ...book, lastChapterId: ch.id, lastChapterNumber: ch.chapterNumber });
          onChapterSelect({ id: ch.id, chapterNumber: ch.chapterNumber, title: ch.title });
        },
      });

    // Fetch MangaDex chapters + user-uploaded versions in parallel on mount.
    // forceLocal: skips CDN and pulls from local img-cache (set via localStorage).
    // Versions are HWID-gated so apiFetch (not plain fetch) is required.
    useEffect(() => {
      setLoadingChapters(true);
      const forceLocal = localStorage.getItem("imgCacheForceLocal") === "1";
      const qs = forceLocal ? "?forceLocal=true" : "";

      Promise.all([
        cacheOrFetch<MangaChapter[]>(
          `manga:${book.id}:chapters${forceLocal ? ":local" : ""}`,
          () =>
            apiFetch(`${API_BASE}/books/manga/${book.id}/chapters${qs}`).then(async (r) => {
              if (!r.ok) throw new Error("chapters fetch failed");
              const data = await r.json();
              if (!Array.isArray(data)) throw new Error("chapters shape invalid");
              return data as MangaChapter[];
            }),
          TTL.MEDIUM,
        ),
        apiFetch(`${API_BASE}/versions/title/${book.id}`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ])
        .then(([mangaDexChapters, versions]: [MangaChapter[], any[]]) => {
          const tagged = mangaDexChapters.map((ch) => ({ ...ch, source: "mangadex" as const }));
          const userChapters: MangaChapter[] = (versions ?? []).map((v: any) => ({
            id: `ver:${v.versionId}`,
            chapterNumber: v.chapterNumber || null,
            title: v.chapterTitle || null,
            translatedLanguage: v.language || "th",
            uploadedAt: v.createdAt || "",
            pageCount: v.pages?.length ?? 0,
            readerAvailable: v.backendAvailable !== false,
            source: "user" as const,
            translatorName: v.translatorName ?? null,
            priceCoins: v.priceCoins ?? 0,
            versionId: v.versionId,
            backendAvailable: v.backendAvailable !== false,
          }));
          const merged = [...tagged, ...userChapters].sort((a, b) => {
            const numA = parseFloat(a.chapterNumber ?? "0") || 0;
            const numB = parseFloat(b.chapterNumber ?? "0") || 0;
            return numA - numB;
          });
          setChapters(merged);
          setLoadingChapters(false);
          if (effectiveHighlightId) {
            const lang = merged.find((c) => c.id === effectiveHighlightId)?.translatedLanguage;
            if (lang) setLangFilter(lang);
          }
        })
        .catch(() => setLoadingChapters(false));
    // book.id is stable for the modal's lifetime — intentional single-run
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [book.id]);

    // Surface loading/firstReadable/isEmpty to parent for CTA buttons
    useEffect(() => {
      if (!onReadyState) return;
      const firstReadable = chapters.find((ch) => chapterAccess(ch, { unlockedVersions }).readable);
      onReadyState(loadingChapters, firstReadable, chapters.length === 0);
    }, [loadingChapters, chapters, unlockedVersions, onReadyState]);

    // Auto-scroll highlighted chapter row into view after chapters load
    useEffect(() => {
      if (!loadingChapters && effectiveHighlightId) {
        setTimeout(() => {
          highlightChapterRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 400);
      }
    }, [loadingChapters, effectiveHighlightId]);

    // Lenis smooth scroll for chapter list inner viewport
    useLocalLenis(
      chaptersListScrollRef,
      "vertical",
      !asPage && visible && chapters.length > 0,
      chaptersLenisRef,
      chaptersContentRef,
    );

    // Tell Lenis to recalculate scroll height when group expand animation runs
    useEffect(() => {
      const el = chaptersContentRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => chaptersLenisRef.current?.resize());
      ro.observe(el);
      return () => ro.disconnect();
    }, [chapters.length]);

    const handleSelect = useCallback(
      (ch: MangaChapter) => {
        addToHistory({ ...book, lastChapterId: ch.id, lastChapterNumber: ch.chapterNumber });
        onChapterSelect({ id: ch.id, chapterNumber: ch.chapterNumber, title: ch.title });
      },
      [book, onChapterSelect],
    );

    const langs = [
      "all",
      ...Array.from(new Set(chapters.map((c) => c.translatedLanguage))).sort((a, b) => {
        if (a === "th") return -1;
        if (b === "th") return 1;
        return a.localeCompare(b);
      }),
    ];
    const labelFor = (l: string) =>
      l === "all" ? "ทั้งหมด" : l === "th" ? "ภาษาไทย" : l.toUpperCase();

    return (
      <div ref={sectionRef} className="px-6 pb-7 scroll-mt-4">
        {/* Header row */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <h3 className="text-sm font-semibold text-white/80">
              {loadingChapters
                ? "กำลังโหลดตอน..."
                : langFilter === "all"
                ? `ตอนทั้งหมด (${chapters.length})`
                : `ตอนทั้งหมด (${chapters.filter((c) => c.translatedLanguage === langFilter).length})`}
            </h3>
            {coinBalance !== null && (
              <button
                onClick={() => setTopupOpen(true)}
                className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 transition hover:bg-amber-500/25"
                title="เติมเหรียญ"
              >
                🪙 {coinBalance}
              </button>
            )}
          </div>

          {!loadingChapters && chapters.length > 0 && langs.length > 2 && (
            <div className="flex gap-1 flex-wrap justify-end">
              {langs.map((l) => (
                <button
                  key={l}
                  onClick={() => setLangFilter(l)}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                    langFilter === l
                      ? "bg-white/20 text-white"
                      : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70"
                  }`}
                >
                  {labelFor(l)}
                </button>
              ))}
            </div>
          )}
        </div>

        {loadingChapters ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg bg-white/10" />
            ))}
          </div>
        ) : chapters.length > 0 ? (
          <div
            ref={chaptersListScrollRef}
            className={asPage ? "" : "max-h-[50vh] md:max-h-80 overflow-y-auto custom-scrollbar"}
          >
            <div ref={chaptersContentRef} className="space-y-1.5">
              {(() => {
                const filtered = chapters.filter(
                  (ch) => langFilter === "all" || ch.translatedLanguage === langFilter,
                );
                const shouldGroup = langFilter === "all";
                const groupMap = new Map<string, MangaChapter[]>();
                for (const ch of filtered) {
                  const key = shouldGroup ? (ch.chapterNumber ?? "?") : ch.id;
                  if (!groupMap.has(key)) groupMap.set(key, []);
                  groupMap.get(key)!.push(ch);
                }

                return Array.from(groupMap.entries()).map(([chNum, grp]) => {
                  if (grp.length === 1) {
                    return (
                      <ChapterRowInner
                        key={grp[0].id}
                        ch={grp[0]}
                        isTreeChild={false}
                        unlockedVersions={unlockedVersions}
                        effectiveHighlightId={effectiveHighlightId}
                        purchasingId={purchasingId}
                        highlightRef={highlightChapterRef}
                        onSelect={handleSelect}
                        onPurchase={purchase}
                      />
                    );
                  }
                  const groupKey = chNum;
                  const isOpen = expandedGroups.has(groupKey);
                  const groupHasHighlight = grp.some((c) => c.id === effectiveHighlightId);
                  return (
                    <div key={groupKey}>
                      <button
                        onClick={() =>
                          setExpandedGroups((prev) => {
                            const next = new Set(prev);
                            if (next.has(groupKey)) next.delete(groupKey);
                            else next.add(groupKey);
                            return next;
                          })
                        }
                        className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left transition ${
                          groupHasHighlight && !isOpen
                            ? "border-blue-400/50 bg-blue-500/10 ring-1 ring-blue-400/30 hover:border-blue-400/60 hover:bg-blue-500/15"
                            : "border-white/10 hover:border-white/25 hover:bg-white/8"
                        }`}
                      >
                        <span className="w-20 shrink-0 text-xs font-semibold text-white">
                          ตอนที่ {chNum}
                        </span>
                        <span className="flex-1 text-xs text-white/40">{grp.length} เวอร์ชัน</span>
                        {groupHasHighlight && !isOpen && (
                          <span className="shrink-0 rounded bg-blue-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">
                            อ่านค้างไว้
                          </span>
                        )}
                        <div className="flex gap-1">
                          {Array.from(new Set(grp.map((c) => c.translatedLanguage))).map((lang) => (
                            <span
                              key={lang}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                lang === "th"
                                  ? "bg-blue-500/20 text-blue-300"
                                  : "bg-white/8 text-white/40"
                              }`}
                            >
                              {lang === "th" ? "ภาษาไทย" : lang.toUpperCase()}
                            </span>
                          ))}
                        </div>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={`h-3.5 w-3.5 shrink-0 text-white/30 transition-transform duration-200 ${
                            isOpen ? "rotate-90" : ""
                          }`}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <div
                        className="grid transition-all duration-300 ease-in-out"
                        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                      >
                        <div className="overflow-hidden">
                          <div className="ml-3 mt-1">
                            {grp.map((ch, i) => (
                              <ChapterRowInner
                                key={ch.id}
                                ch={ch}
                                isTreeChild
                                isLast={i === grp.length - 1}
                                unlockedVersions={unlockedVersions}
                                effectiveHighlightId={effectiveHighlightId}
                                purchasingId={purchasingId}
                                highlightRef={highlightChapterRef}
                                onSelect={handleSelect}
                                onPurchase={purchase}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        ) : (
          <p className="text-xs text-white/40">ไม่พบตอนที่แปลแล้ว</p>
        )}

        <TopupModal isOpen={topupOpen} onClose={() => setTopupOpen(false)} />
      </div>
    );
  }
  ```

- [ ] **Step 2: Verify TypeScript**

  ```bash
  cd Frontend && bunx tsc --noEmit 2>&1 | grep -v "MermaidRenderer" | head -20
  ```

  Expected: empty output (zero errors).

- [ ] **Step 3: ESLint the new file**

  ```bash
  cd Frontend && bunx eslint app/components/ChapterList.tsx --max-warnings 0
  ```

  Expected: no output (zero findings).

- [ ] **Step 4: Commit**

  ```bash
  cd Frontend && git add app/components/ChapterList.tsx
  git commit -m "feat(components): add ChapterList component (#584)"
  ```

---

### Task 3: Slim `BookDetailModal.tsx`

**Files:**
- Modify: `Frontend/app/components/BookDetailModal.tsx`

**Interfaces:**
- Consumes from Task 1: `ActiveChapter` type
- Consumes from Task 2: `ChapterList` default export

- [ ] **Step 1: Update imports**

  Remove these 3 import lines (around lines 5, 14, 19):
  ```tsx
  import TopupModal from "./TopupModal";            // remove
  import { useChapterUnlock } from "../hooks/useChapterUnlock";  // remove
  import { chapterAccess } from "../lib/chapterAccess";          // remove
  ```

  Add these 2 lines after the existing imports:
  ```tsx
  import ChapterList from "./ChapterList";
  import type { ActiveChapter } from "../lib/types";
  ```

  Also check if `useAuth` is used anywhere in BookDetailModal other than for `useChapterUnlock`. Run:
  ```bash
  cd Frontend && grep -n "user\b\|getIdToken" app/components/BookDetailModal.tsx
  ```
  If the only results are the `useAuth` destructure and the `useChapterUnlock` call (both being removed), also remove:
  ```tsx
  import { useAuth } from "../contexts/AuthContext";  // remove if no other usage
  ```

- [ ] **Step 2: Replace `ActiveChapter` local type with import**

  Find and remove the local type definition (around line 25–29):
  ```tsx
  // REMOVE this block:
  type ActiveChapter = {
    id: string;
    chapterNumber: string | null;
    title: string | null;
  };
  ```
  (It's now exported from `manga.ts` and imported above.)

- [ ] **Step 3: Replace chapter state + hook call**

  Find and remove these 5 state lines + the `useChapterUnlock` block (around lines 104–140):
  ```tsx
  // REMOVE:
  const [chapters, setChapters] = useState<MangaChapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [langFilter, setLangFilter] = useState<string>("all");
  // ...
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // REMOVE (the entire useChapterUnlock call):
  const { user, getIdToken } = useAuth();
  const { coinBalance, unlockedVersions, purchasingId, topupOpen, setTopupOpen, purchase } =
    useChapterUnlock({ ... });
  ```

  Add these 3 state lines in their place:
  ```tsx
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [firstReadableChapter, setFirstReadableChapter] = useState<MangaChapter | undefined>();
  const [chaptersEmpty, setChaptersEmpty] = useState(false);
  ```

- [ ] **Step 4: Remove chapter-specific refs**

  Find and remove these 4 refs (around lines 115–120 — keep `chaptersRef` which drives scroll-to-section):
  ```tsx
  // REMOVE:
  const highlightChapterRef = useRef<HTMLButtonElement>(null);
  const chaptersListScrollRef = useRef<HTMLDivElement>(null);
  const chaptersContentRef = useRef<HTMLDivElement>(null);
  const chaptersLenisRef = useRef<Lenis | null>(null);
  ```

  Keep:
  ```tsx
  const chaptersRef = useRef<HTMLDivElement>(null);  // ← keep; used in scrollToChapters effect
  ```

- [ ] **Step 5: Remove chapter-specific Lenis effects**

  Find and remove the 2 chapter Lenis effects (around lines 147–159):
  ```tsx
  // REMOVE this useLocalLenis call for the chapter list:
  useLocalLenis(chaptersListScrollRef, "vertical", !asPage && visible && activeChapter === null && chapters.length > 0, chaptersLenisRef, chaptersContentRef);

  // REMOVE this ResizeObserver effect for chapters:
  useEffect(() => {
    const el = chaptersContentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => chaptersLenisRef.current?.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [chapters.length]);
  ```

  Keep the main modal Lenis (line 145) — it uses `modalScrollRef`/`lenisRef`/`modalContentRef`:
  ```tsx
  useLocalLenis(modalScrollRef, "vertical", !asPage && visible && activeChapter === null, lenisRef, modalContentRef);
  ```

- [ ] **Step 6: Remove chapter fetch from `useEffect([])`**

  Inside the big `useEffect([], [])` (around lines 194–335), find and remove:
  - The `setLoadingChapters(true)` line (inside `if (isManga)` block, ~line 235)
  - The entire `Promise.all([cacheOrFetch ... apiFetch versions ...])...then...catch` block (lines 276–324)

  Leave `setLoadingDetail(true)` and the detail `cacheOrFetch` block untouched.

- [ ] **Step 7: Remove `firstReadableChapter` + `hasReadableChapter` derived consts**

  Find and remove these 3 lines (around lines 392–395):
  ```tsx
  // REMOVE:
  const firstReadableChapter = chapters.find(
    (ch) => chapterAccess(ch, { unlockedVersions }).readable,
  );
  const hasReadableChapter = !!firstReadableChapter;
  ```
  (`firstReadableChapter` is now a state variable set via `onReadyState`.)

- [ ] **Step 8: Update the `scrollToChapters` effect**

  Find the effect (around lines 359–371). Remove the inner highlight scroll (now handled inside ChapterList):
  ```tsx
  // BEFORE:
  useEffect(() => {
    if (scrollToChapters && !loadingChapters) {
      setTimeout(() => {
        chaptersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        if (effectiveHighlightId) {
          setTimeout(() => {
            highlightChapterRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 400);
        }
      }, 150);
    }
  }, [scrollToChapters, loadingChapters, effectiveHighlightId]);

  // AFTER:
  useEffect(() => {
    if (scrollToChapters && !loadingChapters) {
      setTimeout(() => {
        chaptersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [scrollToChapters, loadingChapters]);
  ```

- [ ] **Step 9: Update CTA buttons to use new state vars**

  There are 2 CTA button sites. Apply to both (~lines 547–577 and ~lines 710–725):

  Replace `chapters.length === 0` → `chaptersEmpty`
  Replace `hasReadableChapter` → `!!firstReadableChapter`
  Replace `chapters.length === 0 || !hasReadableChapter` → `chaptersEmpty || !firstReadableChapter`

  Specifically:

  **Site 1 (~line 548):**
  ```tsx
  // BEFORE:
  !loadingChapters && chapters.length === 0 ? (
  // AFTER:
  !loadingChapters && chaptersEmpty ? (
  ```

  **Site 1 (~line 563):**
  ```tsx
  // BEFORE:
  disabled={!hasReadableChapter || loadingChapters}
  // AFTER:
  disabled={!firstReadableChapter || loadingChapters}
  ```

  **Site 2 (~line 718):**
  ```tsx
  // BEFORE:
  disabled={chapters.length === 0 || !hasReadableChapter}
  // AFTER:
  disabled={chaptersEmpty || !firstReadableChapter}
  ```

- [ ] **Step 10: Replace the 250-LOC chapter render block with `<ChapterList />`**

  Find the entire `{isManga && ( <div ref={chaptersRef} ...> ... </div> )}` block (lines 958–1207).
  Replace with:
  ```tsx
  {isManga && (
    <ChapterList
      book={book}
      effectiveHighlightId={effectiveHighlightId}
      asPage={asPage}
      visible={visible && activeChapter === null}
      onChapterSelect={setActiveChapter}
      sectionRef={chaptersRef}
      onReadyState={(loading, firstReadable, isEmpty) => {
        setLoadingChapters(loading);
        setFirstReadableChapter(firstReadable);
        setChaptersEmpty(isEmpty);
      }}
    />
  )}
  ```

- [ ] **Step 11: Remove both `<TopupModal>` renders**

  Find and remove both (lines 1242 and 1263):
  ```tsx
  <TopupModal isOpen={topupOpen} onClose={() => setTopupOpen(false)} />
  ```
  (Both are now rendered inside ChapterList.)

- [ ] **Step 12: Verify TypeScript — no new errors**

  ```bash
  cd Frontend && bunx tsc --noEmit 2>&1 | grep -v "MermaidRenderer" | head -20
  ```

  Expected: empty output.

- [ ] **Step 13: ESLint both touched files**

  ```bash
  cd Frontend && bunx eslint app/components/BookDetailModal.tsx app/components/ChapterList.tsx --max-warnings 0
  ```

  Expected: no output (zero new findings vs HEAD).

- [ ] **Step 14: Confirm LOC reduction**

  ```bash
  wc -l Frontend/app/components/BookDetailModal.tsx Frontend/app/components/ChapterList.tsx
  ```

  Expected: `BookDetailModal.tsx` ~960 LOC (down from 1266), `ChapterList.tsx` ~280 LOC, total ~1240 (net reduction from splitting).

- [ ] **Step 15: Commit**

  ```bash
  cd Frontend && git add app/components/BookDetailModal.tsx
  git commit -m "refactor(modal): extract ChapterList from BookDetailModal (#584)"
  ```

---

## Self-Review

**Spec coverage:**
- ✅ `ChapterList` created, owns fetch + `useChapterUnlock` + Lenis + `TopupModal` + `ChapterRowInner`
- ✅ `ActiveChapter` exported from `manga.ts`
- ✅ `onReadyState` surfaces `loading/firstReadable/isEmpty` for CTA buttons
- ✅ `chaptersRef`/`sectionRef` pattern preserves `scrollToChapters` UX
- ✅ highlight scroll moved inside ChapterList
- ✅ Behaviour contract preserved: same fetch logic, same CSS, same badges, same animations
- ✅ `TopupModal` removed from BookDetailModal (both occurrences)
- ✅ `chapterAccess` import removed from BookDetailModal

**Placeholder scan:** None — all steps contain exact code.

**Type consistency:**
- `ActiveChapter` defined in Task 1, imported in Task 2 and Task 3 ✅
- `ChapterListProps.sectionRef` typed `React.RefObject<HTMLDivElement | null>` matches `chaptersRef` in BookDetailModal ✅
- `onReadyState(loading, firstReadable, isEmpty)` — 3 params match between Task 2 definition and Task 3 call site ✅
- `ChapterRowInnerProps.highlightRef` typed `React.RefObject<HTMLButtonElement | null>` matches `useRef<HTMLButtonElement>(null)` in Task 2 ✅
