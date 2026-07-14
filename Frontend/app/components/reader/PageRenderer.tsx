"use client";

import { memo, type Dispatch, type SetStateAction } from "react";
import type { ReaderViewport } from "../../hooks/useReaderViewport";
import type { ChapterPages } from "../MangaReader";
import type { ChapterPageItem } from "../../hooks/useChapters";
import type { PatchData } from "../../lib/mangaTranslatePage";

export interface PageRendererProps {
  viewport: ReaderViewport;
  /** Non-null — the orchestrator renders this component only when chapter
   *  page data exists (`{data && <PageRenderer .../>}`); the type keeps that
   *  invariant checked at the call site even though the body below reads the
   *  already-derived `pages` array instead of `data` directly. */
  data: ChapterPages;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  continuousMode: boolean;
  pages: string[];
  totalPages: number;
  showTranslation: boolean;
  translatedPages: Map<number, string>;
  patchedPages: Map<number, PatchData[]>;
  completedTranslatedPages: Set<number>;
  translating: boolean;
  translatingCurrentPageIndex: number | null;
  currentStage: { pageIndex: number; stage: string } | null;
  translateDetail: string;
  imgLoading: boolean;
  setImgLoading: (v: boolean) => void;
  hasNextSameLang: boolean;
  hasNextOtherLang: boolean;
  nextSameLang: ChapterPageItem | null;
  otherLangNextMap: Map<string, ChapterPageItem>;
  currentLang: string | null;
  langLabel: (l: string) => string;
  goToChapter: (ch: ChapterPageItem) => void;
}

/**
 * Presentational page render (#582): the paged + continuous page subtrees —
 * the four `<img>` blocks (src selection for saver/full + translated/original,
 * per-page patch overlays, per-page loading), the zoom transform wrapper, nav
 * buttons and the next-chapter banners. Extracted verbatim from MangaReader;
 * behavior identical, no new logic.
 *
 * The orchestrator keeps the loading/error/noCacheError branches AND the
 * outer scroll/zoom container refs (`scrollContainerRef`, `continuousContentRef`)
 * — those refs must attach as soon as the reader mounts (useReaderViewport's
 * Lenis setup reads them on mount, before chapter data has loaded), so their
 * containing elements cannot be gated behind `data`.
 */
function PageRendererImpl({
  viewport,
  page,
  setPage,
  continuousMode,
  pages,
  totalPages,
  showTranslation,
  translatedPages,
  patchedPages,
  completedTranslatedPages,
  translating,
  translatingCurrentPageIndex,
  currentStage,
  translateDetail,
  imgLoading,
  setImgLoading,
  hasNextSameLang,
  hasNextOtherLang,
  nextSameLang,
  otherLangNextMap,
  currentLang,
  langLabel,
  goToChapter,
}: PageRendererProps) {
  const {
    zoom,
    refs: { zoomWrapperRef, pageRefs },
  } = viewport;

  if (continuousMode) {
    return (
      <>
        {pages.map((src, i) => {
          const pageIsPending = (translating && !completedTranslatedPages.has(i)) || translatingCurrentPageIndex === i;
          return (
            <div key={src} className="relative manga-continuous-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={(el) => { pageRefs.current[i] = el; }}
                data-page-idx={i}
                src={showTranslation && translatedPages.has(i) ? translatedPages.get(i)! : src}
                alt={`หน้า ${i + 1}`}
                draggable={false}
                loading="lazy"
                className="w-full select-none"
              />
              {showTranslation && patchedPages.has(i) && patchedPages.get(i)!.map((p, pi) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={pi}
                  src={p.url}
                  alt=""
                  aria-hidden
                  draggable={false}
                  style={{
                    position: "absolute",
                    left: `${p.xPct * 100}%`,
                    top: `${p.yPct * 100}%`,
                    width: `${p.wPct * 100}%`,
                    height: `${p.hPct * 100}%`,
                    pointerEvents: "none",
                  }}
                />
              ))}
              {/* Per-page translation status badge — continuous mode */}
              {pageIsPending && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-center pb-2">
                  <div className="flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-black/75 px-3 py-1 shadow-lg backdrop-blur-sm">
                    <div className="h-2.5 w-2.5 animate-spin rounded-full border border-blue-400/40 border-t-blue-400" />
                    <span className="text-[10px] font-medium text-blue-300">
                      {currentStage?.pageIndex === i || translatingCurrentPageIndex === i
                        ? `กำลังแปลหน้า ${i + 1}${translateDetail ? ` · ${translateDetail}` : "..."}`
                        : translating
                          ? `อยู่ในคิวแปล...`
                          : `กำลังแปลหน้า ${i + 1}...`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {/* Next chapter banner — continuous mode */}
        {(hasNextSameLang || hasNextOtherLang) && (
          <div className="flex w-full max-w-lg flex-col items-center gap-4 py-16 text-center">
            <p className="text-sm text-white/40">อ่านจบตอนแล้ว</p>
            {hasNextSameLang ? (
              <button
                onClick={() => goToChapter(nextSameLang!)}
                className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-white/85 active:scale-95"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
                ตอนถัดไป{nextSameLang!.chapterNumber ? ` (ตอนที่ ${nextSameLang!.chapterNumber})` : ""}
              </button>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs text-white/50">
                  ไม่มีตอนถัดไปใน{currentLang ? ` ${langLabel(currentLang)}` : ""}
                </p>
                <p className="text-xs text-white/35">มีตอนถัดไปในภาษาอื่น:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {Array.from(otherLangNextMap.entries()).map(([lang, ch]) => (
                    <button
                      key={lang}
                      onClick={() => goToChapter(ch)}
                      className="rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold text-white/80 transition hover:border-white/50 hover:bg-white/10 hover:text-white"
                    >
                      {langLabel(lang)}{ch.chapterNumber ? ` • ตอนที่ ${ch.chapterNumber}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  if (totalPages === 0) return null;

  return (
    <>
      <div ref={zoomWrapperRef} className="manga-zoom-wrapper relative flex items-center justify-center select-none">
        {imgLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
          </div>
        )}
        {/* Tight wrapper so absolute-positioned patches are relative to the img */}
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={showTranslation && translatedPages.has(page) ? `tr-${pages[page]}` : pages[page]}
            src={showTranslation && translatedPages.has(page) ? translatedPages.get(page)! : pages[page]}
            alt={`หน้า ${page + 1}`}
            draggable={false}
            className={`block max-h-[calc(100vh-120px)] max-w-full transition-opacity duration-200 ${imgLoading ? "opacity-0" : "opacity-100"}`}
            onLoad={() => setImgLoading(false)}
            onLoadStart={() => setImgLoading(true)}
          />
          {/* Patch overlay: translated text regions overlaid on the original image */}
          {showTranslation && patchedPages.has(page) && patchedPages.get(page)!.map((p, pi) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={pi}
              src={p.url}
              alt=""
              aria-hidden
              draggable={false}
              style={{
                position: "absolute",
                left: `${p.xPct * 100}%`,
                top: `${p.yPct * 100}%`,
                width: `${p.wPct * 100}%`,
                height: `${p.hPct * 100}%`,
                pointerEvents: "none",
              }}
            />
          ))}
        </div>
      </div>

      {zoom === 1 && (
        <>
          <button onClick={() => setPage((p) => Math.max(p - 1, 0))} disabled={page === 0} className="absolute left-0 top-0 h-full w-1/3 cursor-pointer disabled:cursor-default" aria-label="หน้าก่อนหน้า" />
          <button onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))} disabled={page === totalPages - 1} className="absolute right-0 top-0 h-full w-1/3 cursor-pointer disabled:cursor-default" aria-label="หน้าถัดไป" />
        </>
      )}

      {page > 0 && (
        <button onClick={() => setPage((p) => Math.max(p - 1, 0))} title="หน้าก่อน" className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-black/80">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>
        </button>
      )}
      {page < totalPages - 1 && (
        <button onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))} title="หน้าถัดไป" className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-black/80">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
        </button>
      )}
      {/* Next chapter banner — paged mode */}
      {page === totalPages - 1 && (hasNextSameLang || hasNextOtherLang) && (
        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
          {hasNextSameLang ? (
            <button
              onClick={() => goToChapter(nextSameLang!)}
              className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black shadow-xl shadow-black/50 transition hover:bg-white/85 active:scale-95"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
              ตอนถัดไป{nextSameLang!.chapterNumber ? ` (ตอนที่ ${nextSameLang!.chapterNumber})` : ""}
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/15 bg-black/85 px-5 py-4 text-center shadow-xl shadow-black/50 backdrop-blur-sm">
              <p className="text-xs text-white/50">ไม่มีตอนถัดไปใน{currentLang ? ` ${langLabel(currentLang)}` : ""}</p>
              <p className="mb-1 text-[11px] text-white/30">มีตอนถัดไปในภาษาอื่น:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {Array.from(otherLangNextMap.entries()).map(([lang, ch]) => (
                  <button
                    key={lang}
                    onClick={() => goToChapter(ch)}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:border-white/50 hover:bg-white/10 hover:text-white"
                  >
                    {langLabel(lang)}{ch.chapterNumber ? ` • ตอนที่ ${ch.chapterNumber}` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Memoized: the parent (MangaReader) re-renders once per second during batch
 * translation (page-elapsed tick) and on every scroll-driven setPage. With
 * stable props (plan 2026-07-11 Task 5 + memoized viewport) memo skips
 * re-reconciling all N page <img> subtrees when nothing this component reads
 * has changed.
 */
const PageRenderer = memo(PageRendererImpl);
export default PageRenderer;
