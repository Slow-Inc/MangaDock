/**
 * Shared types for the MIT batch translation path (#294).
 *
 * Extracted from mit-batch-orchestrator.service.ts so both the orchestrator and
 * the transport module (mit-batch-stream.ts) can import them without a circular
 * dependency (the orchestrator imports the stream CLASS at runtime).
 */
import { type TextLayerRegion } from './translation-memory.repository';

/** A translated patch as the batch path stores/serves it (percent-positioned). */
export type PatchEntry = {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  url: string;
};

export type PageResult = { patches: PatchEntry[]; error?: string };

export type BatchPageListener = (pageIndex: number, result: PageResult) => void;

/**
 * Collaborators BooksService injects so the batch path can persist a page,
 * resolve series context, and fall back to the single-page translate without
 * owning PatchStore / TranslationMemory / MangaDex / MitTranslationService.
 * These stay in BooksService (shared with the single-page path), so the
 * dependency stays one-way (BooksService → MitBatchOrchestrator).
 */
export interface MitBatchDeps {
  persistPage: (p: {
    chapterId: string;
    pageIndex: number;
    srcMIT: string;
    tgtMIT: string;
    storeModel?: string;
    cacheKey: string;
    cacheStrategy: 'plain7d' | 'tiered';
    rects: Array<{ x: number; y: number; w: number; h: number }>;
    buffers: Buffer[];
    imgW: number;
    imgH: number;
    regions?: TextLayerRegion[];
    tmModel?: string;
    recoverIfEmpty?: () => Promise<PatchEntry[]>;
  }) => Promise<PatchEntry[]>;
  seriesContextFor: (mangaId?: string) => Promise<string | undefined>;
  translateSinglePage: (
    chapterId: string,
    pageIndex: number,
    pageUrl: string,
    sourceLang?: string,
    targetLang?: string,
    opts?: {
      maxStartupRetries?: number;
      imageModel?: string;
      derivative?: 'hd' | 'saver';
      mangaId?: string;
    },
  ) => Promise<{ patches: PatchEntry[] }>;
}
