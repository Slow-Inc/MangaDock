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
import { fallbackTarget } from "../lib/targetLangs";

// Target options + source-guard live in lib/targetLangs (#163); re-exported
// so existing consumers (MangaReader) keep their import path.
export { TARGET_LANG_OPTIONS } from "../lib/targetLangs";

type Options = {
  /** Chapter source language — null until the chapter list arrives. */
  sourceLang: string | null;
  /** Currently visible page index — translated first for instant feedback. */
  currentPage: number;
  /** True while either translate menu is open — model list loads lazily then. */
  menusOpen: boolean;
  /** Display derivative the Reader is showing (#156) — patches must be
   *  generated from the same derivative or their screentone tone visibly
   *  mismatches the page. Defaults to "hd". */
  derivative?: "hd" | "saver";
  /** Catalog id of the manga being read (#157) — the Backend resolves
   *  title/synopsis itself and feeds the translator its series context.
   *  Absent → context-free translation, identical to today. */
  mangaId?: string;
};

/**
 * All translate orchestration for one chapter (#142): start/cancel/resume,
 * per-page progress, target-language + Gemini-model selection, MIT health.
 * Extracted from MangaReader so the desktop dropdown and the mobile sheet
 * consume the same state instead of interleaving it with viewport/zoom
 * concerns. Pure mechanical move — behavior identical.
 *
 * `pages` are the Reader's display-matched translation sources (#156, see
 * buildTranslationSources): backend-local /img-cache paths when that is what
 * the Reader displays, raw CDN URLs otherwise — never browser-relative proxy
 * routes.
 */
export function useChapterTranslation(
  chapterId: string,
  pages: string[],
  { sourceLang, currentPage, menusOpen, derivative = "hd", mangaId }: Options,
) {
  const [translating, setTranslating] = useState(false);
  const [translatingCurrentPage, setTranslatingCurrentPage] = useState(false);
  const [translatingCurrentPageIndex, setTranslatingCurrentPageIndex] = useState<number | null>(null);
  const [transProgress, setTransProgress] = useState({ done: 0, failed: 0, total: 0 });
  // Perceived-progress state: a ticking timer, session-average ETA and the
  // live MIT stage keep the 20-60s per-page wait from feeling frozen.
  const [pageElapsedSec, setPageElapsedSec] = useState(0);
  const [avgPageSec, setAvgPageSec] = useState<number | null>(null);
  const [currentStage, setCurrentStage] = useState<{ pageIndex: number; stage: string } | null>(null);
  const pageStartRef = useRef<number | null>(null);
  const durationsRef = useRef<number[]>([]);
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

  // Tick the per-page timer once a second while any translation runs — a
  // number that visibly moves is the cheapest "the system is alive" signal.
  useEffect(() => {
    if (!translating && !translatingCurrentPage) {
      setPageElapsedSec(0);
      return;
    }
    const id = setInterval(() => {
      if (pageStartRef.current !== null) {
        setPageElapsedSec(Math.floor((Date.now() - pageStartRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [translating, translatingCurrentPage]);
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
    setTransProgress({ done: 0, failed: 0, total: 0 });
    setTranslatedPages(new Map());
    setPatchedPages(new Map());
    setCompletedTranslatedPages(new Set());
    setShowTranslation(true);
  }, [chapterId]);

  // Reset translated state when target language or display derivative changes
  // (different cache key — and patches from one derivative must not overlay
  // the other, #156)
  useEffect(() => {
    translateControllerRef.current?.abort();
    translateControllerRef.current = null;
    setTranslating(false);
    setTranslatingCurrentPage(false);
    setTranslatingCurrentPageIndex(null);
    setTransProgress({ done: 0, failed: 0, total: 0 });
    setPatchedPages(new Map());
    setCompletedTranslatedPages(new Set());
  }, [targetLang, derivative]);

  // Never keep target language equal to current chapter/source language.
  useEffect(() => {
    const next = fallbackTarget(sourceLang, targetLang);
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
    if (pendingIndices.length === 0) {
      // Everything is already translated — the user's intent is "show me the
      // translation", not "make a network call" (#162). Without this flip the
      // call is a silent no-op while the original view stays on.
      setShowTranslation(true);
      return;
    }

    const controller = new AbortController();
    translateControllerRef.current = controller;
    setTranslating(true);
    setShowTranslation(true);
    setTransProgress({ done: completedTranslatedPages.size, failed: 0, total });
    pageStartRef.current = Date.now();
    durationsRef.current = [];
    setAvgPageSec(null);
    setPageElapsedSec(0);
    setCurrentStage(null);

    // Build page list in priority order — visible page first for instant feedback
    const pendingSet = new Set(pendingIndices);
    const otherIndices = pendingIndices.filter((i) => i !== currentPage);
    const orderedIndices = pendingSet.has(currentPage) ? [currentPage, ...otherIndices] : otherIndices;
    const batchPages = orderedIndices.map((idx) => ({
      pageIndex: idx,
      pageUrl: pages[idx],
    }));

    const doneSet = new Set<number>(completedTranslatedPages);
    // Pages whose webhook came back with an error — kept out of doneSet so a
    // re-run of "แปลทั้งตอน" retries them, and reported truthfully in the UI
    // (a fast all-error batch used to render as "แปลแล้ว" with nothing to show).
    const failedMap = new Map<number, string>();
    const handlePageEvent = (pageIndex: number, patches: PatchData[], error?: string) => {
      if (controller.signal.aborted) return;
      // Page finished (success or error): record its duration for the ETA
      // average, then restart the per-page clock for the next page.
      if (pageStartRef.current !== null) {
        durationsRef.current.push((Date.now() - pageStartRef.current) / 1000);
        setAvgPageSec(durationsRef.current.reduce((a, b) => a + b, 0) / durationsRef.current.length);
      }
      pageStartRef.current = Date.now();
      setPageElapsedSec(0);
      setCurrentStage(null);
      if (error) {
        failedMap.set(pageIndex, error);
        setTransProgress({ done: doneSet.size, failed: failedMap.size, total });
        return;
      }
      failedMap.delete(pageIndex); // succeeded on a retry
      if (patches.length > 0) {
        setPatchedPages((prev) => new Map(prev).set(pageIndex, patches));
      }
      doneSet.add(pageIndex);
      setCompletedTranslatedPages(new Set(doneSet));
      setTransProgress({ done: doneSet.size, failed: failedMap.size, total });
    };
    const handleProgressEvent = (pageIndex: number, stage: string) => {
      if (controller.signal.aborted) return;
      setCurrentStage({ pageIndex, stage });
    };
    // User-selected Gemini model (#87), gated on the deployment's translator (#134);
    // undefined = server default / non-Gemini deployment
    const imageModel = await getEffectiveImageModel();
    try {
      await translateMangaChapterBatchPatches(
        chapterId,
        batchPages,
        handlePageEvent,
        controller.signal,
        { sourceLang: sourceLang ?? undefined, targetLang, imageModel, derivative, mangaId },
        handleProgressEvent,
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
                handlePageEvent,
                controller.signal,
                { sourceLang: sourceLang ?? undefined, targetLang, imageModel, derivative, mangaId },
                handleProgressEvent,
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
      pageStartRef.current = null;
      setCurrentStage(null);
      if (!controller.signal.aborted) {
        if (failedMap.size > 0) {
          const firstError = failedMap.values().next().value ?? "";
          showToast({
            message: `แปลไม่สำเร็จ ${failedMap.size}/${total} หน้า — ${firstError}`,
            type: "error",
          });
        }
        setTranslating(false);
      }
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
    // Patches already in memory → just show them; re-fetching would only hit
    // the server cache and return the same data (#162).
    if (patchedPages.has(pageIndex)) {
      setShowTranslation(true);
      return;
    }
    const pageUrl = pages[pageIndex];
    if (!pageUrl) return;
    setTranslatingCurrentPage(true);
    setTranslatingCurrentPageIndex(pageIndex);
    pageStartRef.current = Date.now();
    setPageElapsedSec(0);
    console.log(`[PageTranslate] Translating page ${pageIndex + 1} (index ${pageIndex}):`, pageUrl);
    try {
      const patches = await translateMangaPagePatches(chapterId, pageIndex, pageUrl, undefined, {
        sourceLang: sourceLang ?? undefined,
        targetLang,
        imageModel: await getEffectiveImageModel(),
        derivative,
      });
      console.log(`[PageTranslate] Page ${pageIndex + 1} done — ${patches.length} patches:`, patches);
      if (patches.length > 0) {
        setPatchedPages((prev) => new Map(prev).set(pageIndex, patches));
      }
      setCompletedTranslatedPages((prev) => new Set([...prev, pageIndex]));
      setShowTranslation(true);
    } catch (err) {
      console.error(`[PageTranslate] Page ${pageIndex + 1} failed:`, err);
      showToast({
        message: `แปลหน้า ${pageIndex + 1} ไม่สำเร็จ — ${err instanceof Error ? err.message : String(err)}`,
        type: "error",
      });
    } finally {
      setTranslatingCurrentPage(false);
      setTranslatingCurrentPageIndex(null);
      pageStartRef.current = null;
    }
  };

  // Derived perceived-progress values for the UI.
  const remainingPages = Math.max(0, transProgress.total - transProgress.done - transProgress.failed);
  const etaSec =
    translating && avgPageSec !== null && remainingPages > 0
      ? Math.max(0, Math.round(avgPageSec * remainingPages - pageElapsedSec))
      : null;
  // First page taking unusually long ⇒ MIT is likely loading models cold.
  const coldStart =
    (translating || translatingCurrentPage) &&
    durationsRef.current.length === 0 &&
    pageElapsedSec >= 15;

  return {
    mitStatus,
    translating,
    translatingCurrentPage,
    translatingCurrentPageIndex,
    transProgress,
    pageElapsedSec,
    etaSec,
    avgPageSec,
    coldStart,
    currentStage,
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
