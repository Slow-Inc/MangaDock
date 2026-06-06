"use client";

import { useEffect, useRef, useState } from "react";
import {
  translateMangaChapterBatchPatches,
  translateMangaPagePatches,
  checkMitHealth,
  type PatchData,
} from "../lib/mangaTranslatePage";
import {
  fetchAvailableMangaModels,
  fetchImageTranslator,
  getEffectiveImageModel,
  isGeminiImageTranslator,
  MANGA_IMAGE_TRANSLATE_MODEL_KEY,
} from "../lib/mangaTranslateModel";
import { useToast } from "../contexts/ToastContext";

export const TARGET_LANG_OPTIONS: { code: string; label: string }[] = [
  { code: "th", label: "→ TH" },
  { code: "en", label: "→ EN" },
  { code: "zh", label: "→ ZH" },
];

type Options = {
  /** Chapter source language — null until the chapter list arrives. */
  sourceLang: string | null;
  /** Currently visible page index — translated first for instant feedback. */
  currentPage: number;
  /** True while either translate menu is open — model list loads lazily then. */
  menusOpen: boolean;
};

/**
 * All translate orchestration for one chapter (#142): start/cancel/resume,
 * per-page progress, target-language + Gemini-model selection, MIT health.
 * Extracted from MangaReader so the desktop dropdown and the mobile sheet
 * consume the same state instead of interleaving it with viewport/zoom
 * concerns. Pure mechanical move — behavior identical.
 *
 * `pages` are the RAW page URLs (`data.pages`) — the translate API needs the
 * original CDN URLs, not the proxied/img-cache ones the reader displays.
 */
export function useChapterTranslation(
  chapterId: string,
  pages: string[],
  { sourceLang, currentPage, menusOpen }: Options,
) {
  const [translating, setTranslating] = useState(false);
  const [translatingCurrentPage, setTranslatingCurrentPage] = useState(false);
  const [translatingCurrentPageIndex, setTranslatingCurrentPageIndex] = useState<number | null>(null);
  const [transProgress, setTransProgress] = useState({ done: 0, total: 0 });
  const [translatedPages, setTranslatedPages] = useState<Map<number, string>>(new Map());
  const [patchedPages, setPatchedPages] = useState<Map<number, PatchData[]>>(new Map());
  const [completedTranslatedPages, setCompletedTranslatedPages] = useState<Set<number>>(new Set());
  const [showTranslation, setShowTranslation] = useState(true);
  const [targetLang, setTargetLang] = useState<string>("th");
  const { showToast } = useToast();

  // Image-translation Gemini model (#87). null = อัตโนมัติ — let the server's
  // env default decide. Persisted under MANGA_IMAGE_TRANSLATE_MODEL_KEY; the
  // translate calls read it back via getSelectedMangaImageTranslateModel().
  const [imageModel, setImageModel] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  // Show Gemini model choices only when MIT runs a Gemini-family translator
  // (#134, PRD #131). Defaults to visible (fail-open) until the flag arrives.
  const [showModelSelector, setShowModelSelector] = useState(true);

  const translateControllerRef = useRef<AbortController | null>(null);
  const [mitStatus, setMitStatus] = useState<"unknown" | "online" | "offline">("unknown");

  useEffect(() => {
    setImageModel(localStorage.getItem(MANGA_IMAGE_TRANSLATE_MODEL_KEY));
  }, []);

  // Fetch the model list lazily, the first time either translate menu opens
  useEffect(() => {
    if (!menusOpen || availableModels.length > 0) return;
    let alive = true;
    void fetchAvailableMangaModels().then((models) => {
      if (alive) setAvailableModels(models);
    });
    void fetchImageTranslator().then((translator) => {
      if (alive) setShowModelSelector(isGeminiImageTranslator(translator));
    });
    return () => { alive = false; };
  }, [menusOpen, availableModels.length]);

  const selectImageModel = (model: string | null) => {
    setImageModel(model);
    if (model) localStorage.setItem(MANGA_IMAGE_TRANSLATE_MODEL_KEY, model);
    else localStorage.removeItem(MANGA_IMAGE_TRANSLATE_MODEL_KEY);
  };

  // Check MIT service health on mount
  useEffect(() => {
    checkMitHealth().then((ok) => setMitStatus(ok ? "online" : "offline"));
  }, []);

  // Reset translation state whenever the chapter changes
  useEffect(() => {
    translateControllerRef.current?.abort();
    translateControllerRef.current = null;
    setTranslating(false);
    setTranslatingCurrentPage(false);
    setTranslatingCurrentPageIndex(null);
    setTransProgress({ done: 0, total: 0 });
    setTranslatedPages(new Map());
    setPatchedPages(new Map());
    setCompletedTranslatedPages(new Set());
    setShowTranslation(true);
  }, [chapterId]);

  // Reset translated state when target language changes (different cache key)
  useEffect(() => {
    translateControllerRef.current?.abort();
    translateControllerRef.current = null;
    setTranslating(false);
    setTranslatingCurrentPage(false);
    setTranslatingCurrentPageIndex(null);
    setTransProgress({ done: 0, total: 0 });
    setPatchedPages(new Map());
    setCompletedTranslatedPages(new Set());
  }, [targetLang]);

  // Never keep target language equal to current chapter/source language.
  useEffect(() => {
    const source = (sourceLang ?? "").toLowerCase();
    if (!source) return;
    if (targetLang.toLowerCase() !== source) return;
    const next = TARGET_LANG_OPTIONS.find((l) => l.code !== source)?.code;
    if (next) setTargetLang(next);
  }, [sourceLang, targetLang]);

  const startTranslate = async () => {
    if (pages.length === 0) return;
    // Re-verify service before starting
    const healthy = await checkMitHealth();
    setMitStatus(healthy ? "online" : "offline");
    if (!healthy) return;

    const total = pages.length;
    const pendingIndices = Array.from({ length: total }, (_, i) => i).filter(
      (idx) => !completedTranslatedPages.has(idx),
    );
    if (pendingIndices.length === 0) return;

    const controller = new AbortController();
    translateControllerRef.current = controller;
    setTranslating(true);
    setShowTranslation(true);
    setTransProgress({ done: completedTranslatedPages.size, total });

    // Build page list in priority order — visible page first for instant feedback
    const pendingSet = new Set(pendingIndices);
    const otherIndices = pendingIndices.filter((i) => i !== currentPage);
    const orderedIndices = pendingSet.has(currentPage) ? [currentPage, ...otherIndices] : otherIndices;
    const batchPages = orderedIndices.map((idx) => ({
      pageIndex: idx,
      pageUrl: pages[idx],
    }));

    const doneSet = new Set<number>(completedTranslatedPages);
    // User-selected Gemini model (#87), gated on the deployment's translator (#134);
    // undefined = server default / non-Gemini deployment
    const imageModel = await getEffectiveImageModel();
    try {
      await translateMangaChapterBatchPatches(
        chapterId,
        batchPages,
        (pageIndex, patches) => {
          if (controller.signal.aborted) return;
          if (patches.length > 0) {
            setPatchedPages((prev) => new Map(prev).set(pageIndex, patches));
          }
          doneSet.add(pageIndex);
          setCompletedTranslatedPages(new Set(doneSet));
          setTransProgress({ done: doneSet.size, total });
        },
        controller.signal,
        { sourceLang: sourceLang ?? undefined, targetLang, imageModel },
      );
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        console.error("[BatchTranslate] Failed:", err);

        const msg = err instanceof Error ? err.message : String(err);
        const shouldRetryBatch =
          /Batch translate failed \(500\)/i.test(msg) ||
          /network error|failed to fetch|fetch failed/i.test(msg);

        if (shouldRetryBatch) {
          const maxBatchRetries = 2;
          for (let attempt = 1; attempt <= maxBatchRetries; attempt++) {
            if (controller.signal.aborted) break;

            const remainingIndices = orderedIndices.filter((idx) => !doneSet.has(idx));
            if (remainingIndices.length === 0) break;

            const retryBatchPages = remainingIndices.map((idx) => ({
              pageIndex: idx,
              pageUrl: pages[idx],
            }));

            await new Promise((resolve) => setTimeout(resolve, 800 * attempt));

            try {
              await translateMangaChapterBatchPatches(
                chapterId,
                retryBatchPages,
                (pageIndex, patches) => {
                  if (controller.signal.aborted) return;
                  if (patches.length > 0) {
                    setPatchedPages((prev) => new Map(prev).set(pageIndex, patches));
                  }
                  doneSet.add(pageIndex);
                  setCompletedTranslatedPages(new Set(doneSet));
                  setTransProgress({ done: doneSet.size, total });
                },
                controller.signal,
                { sourceLang: sourceLang ?? undefined, targetLang, imageModel },
              );
            } catch (retryErr) {
              if (retryErr instanceof Error && retryErr.name === "AbortError") break;
              console.warn(`[BatchTranslate] Retry ${attempt}/${maxBatchRetries} failed:`, retryErr);
            }
          }
        }
      }
    } finally {
      if (translateControllerRef.current === controller) {
        translateControllerRef.current = null;
      }
      if (!controller.signal.aborted) setTranslating(false);
    }
  };

  const cancelTranslate = () => {
    translateControllerRef.current?.abort();
    translateControllerRef.current = null;
    setTranslating(false);
    // Cancellation is cooperative at page boundaries (ADR: MIT/ARCHITECTURE.md §6,
    // #129) — the server stops before the next page; a page already mid-inference
    // finishes (and its result is dropped). Tell the user the truth.
    showToast({
      message: "หยุดการแปลแล้ว — หน้าที่กำลังประมวลผลอยู่จะหยุดเมื่อจบหน้านั้น",
      type: "info",
    });
  };

  /** Translate only the current page — for debugging specific pages */
  const translateCurrentPage = async () => {
    if (translatingCurrentPage || translating) return;
    const pageIndex = currentPage;
    const pageUrl = pages[pageIndex];
    if (!pageUrl) return;
    setTranslatingCurrentPage(true);
    setTranslatingCurrentPageIndex(pageIndex);
    console.log(`[PageTranslate] Translating page ${pageIndex + 1} (index ${pageIndex}):`, pageUrl);
    try {
      const patches = await translateMangaPagePatches(chapterId, pageIndex, pageUrl, undefined, {
        sourceLang: sourceLang ?? undefined,
        targetLang,
        imageModel: await getEffectiveImageModel(),
      });
      console.log(`[PageTranslate] Page ${pageIndex + 1} done — ${patches.length} patches:`, patches);
      if (patches.length > 0) {
        setPatchedPages((prev) => new Map(prev).set(pageIndex, patches));
      }
      setCompletedTranslatedPages((prev) => new Set([...prev, pageIndex]));
      setShowTranslation(true);
    } catch (err) {
      console.error(`[PageTranslate] Page ${pageIndex + 1} failed:`, err);
    } finally {
      setTranslatingCurrentPage(false);
      setTranslatingCurrentPageIndex(null);
    }
  };

  return {
    mitStatus,
    translating,
    translatingCurrentPage,
    translatingCurrentPageIndex,
    transProgress,
    translatedPages,
    patchedPages,
    completedTranslatedPages,
    showTranslation,
    setShowTranslation,
    targetLang,
    setTargetLang,
    imageModel,
    selectImageModel,
    availableModels,
    showModelSelector,
    startTranslate,
    cancelTranslate,
    translateCurrentPage,
  };
}
