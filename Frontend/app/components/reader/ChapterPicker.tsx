"use client";

import { useEffect } from "react";
import { useLocalLenis } from "../../hooks/useLocalLenis";
import type { ChapterPageItem } from "../../hooks/useChapters";

export interface ChapterPickerProps {
  mounted: boolean;
  visible: boolean;
  langFilter: string;
  setLangFilter: (l: string) => void;
  chapterList: ChapterPageItem[];
  currentChapterId: string;
  onSelect: (chapter: ChapterPageItem) => void;
  onClose: () => void;
  pickerRef: React.RefObject<HTMLDivElement | null>;
  pickerScrollRef: React.RefObject<HTMLDivElement | null>;
  activeChapterBtnRef: React.RefObject<HTMLButtonElement | null>;
}

/**
 * Chapter picker modal — extracted from MangaReader (#582) verbatim JSX, same
 * class names/animation/list-filtering/active-chapter highlight. Owns its own
 * scroll-to-active effect and Lenis smooth-scroll instance for the list.
 */
export default function ChapterPicker({
  mounted,
  visible,
  langFilter,
  setLangFilter,
  chapterList,
  currentChapterId,
  onSelect,
  onClose,
  pickerRef,
  pickerScrollRef,
  activeChapterBtnRef,
}: ChapterPickerProps) {
  const currentLang = chapterList.find((c) => c.id === currentChapterId)?.translatedLanguage ?? null;

  // Scroll picker to active chapter when it opens / lang filter changes
  useEffect(() => {
    if (!visible) return;
    requestAnimationFrame(() => {
      activeChapterBtnRef.current?.scrollIntoView({ block: "center" });
    });
  }, [visible, langFilter, activeChapterBtnRef]);

  useLocalLenis(pickerScrollRef, "vertical", mounted && visible);

  if (!mounted) return null;

  const allLangs = Array.from(new Set(chapterList.map((c) => c.translatedLanguage))).sort((a, b) => {
    if (a === currentLang) return -1;
    if (b === currentLang) return 1;
    if (a === "th") return -1;
    if (b === "th") return 1;
    return a.localeCompare(b);
  });
  const tabs = ["all", ...allLangs];
  const labelFor = (l: string) =>
    l === "all" ? "ทั้งหมด" : l === "th" ? "ภาษาไทย" : l.toUpperCase();
  const filtered = langFilter === "all"
    ? chapterList
    : chapterList.filter((c) => c.translatedLanguage === langFilter);

  return (
    <div
      className={`absolute inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={pickerRef}
        className={`relative mx-4 mt-16 flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/15 bg-zinc-900/95 shadow-2xl shadow-black/80 backdrop-blur-xl transition-all duration-300 ${visible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
      >
        {/* Picker header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">เลือกตอน</h3>
          <button onClick={onClose} title="ปิด" className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Language filter tabs */}
        {tabs.length > 2 && (
          <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-white/10 px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((l) => (
              <button
                key={l}
                onClick={() => setLangFilter(l)}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition ${
                  langFilter === l
                    ? "bg-white/20 text-white"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70"
                }`}
              >
                {labelFor(l)}
                {l === currentLang && (
                  <span className="ml-1 text-[9px] text-blue-400/80">●</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Chapter list */}
        <div
          ref={pickerScrollRef}
          data-lenis-prevent
          className="flex-1 overflow-y-auto p-3 custom-scrollbar"
        >
          <div className="space-y-1">
            {filtered.map((ch) => {
              const isCurrent = ch.id === currentChapterId;
              return (
                <button
                  key={ch.id}
                  ref={isCurrent ? activeChapterBtnRef : undefined}
                  onClick={() => onSelect(ch)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition ${
                    isCurrent
                      ? "border-blue-400/50 bg-blue-500/10 ring-1 ring-blue-400/30"
                      : "border-white/8 hover:border-white/20 hover:bg-white/8"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-white">
                      ตอนที่ {ch.chapterNumber ?? "?"}{ch.title ? ` — ${ch.title}` : ""}
                    </span>
                  </span>
                  {langFilter === "all" && (
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      ch.translatedLanguage === "th"
                        ? "bg-blue-500/20 text-blue-300"
                        : "bg-white/8 text-white/40"
                    }`}>
                      {labelFor(ch.translatedLanguage)}
                    </span>
                  )}
                  {isCurrent && (
                    <span className="shrink-0 rounded bg-blue-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">
                      กำลังอ่าน
                    </span>
                  )}
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-white/25">
                    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
