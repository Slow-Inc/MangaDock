"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type Lenis from "lenis";
import TopupModal from "./TopupModal";
import { useChapterUnlock } from "../hooks/useChapterUnlock";
import { useLocalLenis } from "../hooks/useLocalLenis";
import { apiFetch } from "../lib/apiFetch";
import { cacheOrFetch, TTL } from "../lib/apiCache";
import { chapterAccess } from "../lib/chapterAccess";
import { addToHistory } from "../lib/readingHistory";
import { useAuth } from "../contexts/AuthContext";
import Loader from "./ui/Loader";
import type { LandingBook, MangaChapter, ActiveChapter } from "../lib/types";
import Coin from "./ui/Coin";
import { scrollBehavior } from "../hooks/reducedMotion";

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
          ? "border-accent/50 bg-accent/10 ring-1 ring-accent/30 cursor-pointer"
          : coinLocked
          ? "border-coin/20 hover:border-coin/40 hover:bg-coin/5 cursor-pointer"
          : readable
          ? "border-line hover:border-ink-3 hover:bg-fill cursor-pointer"
          : "border-line opacity-50 cursor-not-allowed"
      }`}
    >
      {!isTreeChild && (
        <span className="w-20 shrink-0 text-xs font-semibold text-ink">
          ตอนที่ {ch.chapterNumber ?? "?"}
        </span>
      )}
      {ch.title ? (
        <span className="flex-1 truncate text-xs text-ink-2">{ch.title}</span>
      ) : (
        <span className="flex-1" />
      )}
      {isHighlighted && (
        <span className="shrink-0 rounded bg-accent/25 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
          อ่านค้างไว้
        </span>
      )}
      {ch.source === "user" && (
        <span
          className="shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent"
          title={ch.translatorName ? `แปลโดย ${ch.translatorName}` : "แปลโดยผู้ใช้"}
        >
          {ch.translatorName ? ch.translatorName : "ผู้ใช้แปล"}
        </span>
      )}
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
          ch.translatedLanguage === "th"
            ? "bg-accent/20 text-accent"
            : "bg-fill text-ink-3"
        }`}
      >
        {ch.translatedLanguage === "th" ? "ภาษาไทย" : ch.translatedLanguage.toUpperCase()}
      </span>
      {coinLocked ? (
        isPurchasing ? (
          <span className="shrink-0 flex items-center gap-1 rounded bg-coin/20 px-2 py-0.5 text-[10px] font-semibold text-coin">
            <Loader context="inline" label="กำลังปลดล็อค" />
            ปลดล็อค...
          </span>
        ) : (
          <span className="shrink-0 rounded bg-coin/20 px-2 py-0.5 text-[10px] font-semibold text-coin">
            <Coin className="mr-0.5 inline align-[-0.125em]" />{ch.priceCoins} ปลดล็อค
          </span>
        )
      ) : readable ? (
        <span className="shrink-0 rounded bg-ok/15 px-1.5 py-0.5 text-[10px] font-medium text-ok">
          {ch.pageCount > 0 ? `${ch.pageCount} หน้า` : "พร้อมอ่าน"}
        </span>
      ) : (
        <span className="shrink-0 rounded bg-fill px-1.5 py-0.5 text-[10px] font-medium text-ink-3">
          {unavailableLabel}
        </span>
      )}
      {readable && (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-ink-3">
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
          className="absolute left-2.5 top-0 w-px bg-line"
          style={{ bottom: isLast ? "50%" : "0" }}
        />
        <div className="absolute left-2.5 top-4 flex items-center">
          <div className="h-px w-3 bg-line" />
          <div className="h-1 w-1 rounded-full bg-ink-3" />
        </div>
      </div>
      <div className="flex-1">{row}</div>
    </div>
  );
}

type ChapterListProps = {
  book: LandingBook;
  effectiveHighlightId?: string;
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
  visible,
  onChapterSelect,
  sectionRef,
  onReadyState,
}: ChapterListProps) {
  const [chapters, setChapters] = useState<MangaChapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(true);
  const [langFilter, setLangFilter] = useState<string>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const groupIdBase = useId(); // a popup can open over another popup: keep group ids unique per list

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(([mangaDexChapters, versions]: [MangaChapter[], any[]]) => {
        const tagged = mangaDexChapters.map((ch) => ({ ...ch, source: "mangadex" as const }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        highlightChapterRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
      }, 400);
    }
  }, [loadingChapters, effectiveHighlightId]);

  // Lenis smooth scroll for chapter list inner viewport
  useLocalLenis(
    chaptersListScrollRef,
    "vertical",
    visible && chapters.length > 0,
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
          <h3 className="text-sm font-semibold text-ink">
            {loadingChapters
              ? "กำลังโหลดตอน..."
              : langFilter === "all"
              ? `ตอนทั้งหมด (${chapters.length})`
              : `ตอนทั้งหมด (${chapters.filter((c) => c.translatedLanguage === langFilter).length})`}
          </h3>
          {coinBalance !== null && (
            <button
              onClick={() => setTopupOpen(true)}
              className="flex items-center gap-1 rounded-full bg-coin/15 px-2 py-0.5 text-[10px] font-semibold text-coin transition hover:bg-coin/25"
              title="เติมเหรียญ"
            >
              <Coin /> {coinBalance}
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
                    ? "bg-ink text-bg"
                    : "bg-fill text-ink-2 hover:bg-raised hover:text-ink"
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
            <div key={i} className="h-11 animate-pulse rounded-lg bg-fill" />
          ))}
        </div>
      ) : chapters.length > 0 ? (
        <div
          ref={chaptersListScrollRef}
          className="max-h-[50vh] md:max-h-80 overflow-y-auto custom-scrollbar"
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
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`${groupIdBase}-${groupKey}`}
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
                          ? "border-accent/50 bg-accent/10 ring-1 ring-accent/30 hover:border-accent/60 hover:bg-accent/15"
                          : "border-line hover:border-ink-3 hover:bg-fill"
                      }`}
                    >
                      <span className="w-20 shrink-0 text-xs font-semibold text-ink">
                        ตอนที่ {chNum}
                      </span>
                      <span className="flex-1 text-xs text-ink-3">{grp.length} เวอร์ชัน</span>
                      {groupHasHighlight && !isOpen && (
                        <span className="shrink-0 rounded bg-accent/25 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                          อ่านค้างไว้
                        </span>
                      )}
                      <div className="flex gap-1">
                        {Array.from(new Set(grp.map((c) => c.translatedLanguage))).map((lang) => (
                          <span
                            key={lang}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              lang === "th"
                                ? "bg-accent/20 text-accent"
                                : "bg-fill text-ink-3"
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
                        className={`h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform duration-200 ${
                          isOpen ? "rotate-90" : ""
                        }`}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <div
                      id={`${groupIdBase}-${groupKey}`}
                      inert={!isOpen} // collapsed is only 0fr: keep its rows out of the Tab order (#952)
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
        <p className="text-xs text-ink-3">ไม่พบตอนที่แปลแล้ว</p>
      )}

      <TopupModal isOpen={topupOpen} onClose={() => setTopupOpen(false)} />
    </div>
  );
}
