import { toRelativeProxyUrl } from "./imgUrl";

/**
 * Translates a single manga page using the backend manga-image-translator endpoint.
 *
 * The backend calls the local manga-image-translator Python server, which uses
 * Gemini + LaMa inpainting to produce a clean Thai-translated PNG.
 *
 * @param chapterId  MangaDex chapter UUID
 * @param pageIndex  Zero-based page index
 * @param pageUrl    Original (external) page image URL to translate
 * @returns Absolute URL to the translated PNG served from the backend
 */


/**
 * Checks whether the manga-image-translator microservice is reachable.
 * Returns true if the service responds, false otherwise.
 */
export async function checkMitHealth(): Promise<boolean> {
  try {
    const res = await fetch("/api/proxy/books/translate/mit-health", {
      method: "GET",
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { available: boolean };
    return json.available === true;
  } catch {
    return false;
  }
}

// ─── Patch overlay ────────────────────────────────────────────────────────────

/** A single translated region rendered as a PNG patch to overlay on the original page. */
export type PatchData = {
  /** Left edge as fraction of the original image width  (0–1) */
  xPct: number;
  /** Top edge as fraction of the original image height (0–1) */
  yPct: number;
  /** Patch width as fraction of original image width   (0–1) */
  wPct: number;
  /** Patch height as fraction of original image height (0–1) */
  hPct: number;
  /** URL of the PNG patch served from the backend */
  url: string;
};

/**
 * Translates a single manga page and returns per-region patch data
 * for client-side overlay rendering on top of the original image.
 */
export async function translateMangaPagePatches(
  chapterId: string,
  pageIndex: number,
  pageUrl: string,
  signal?: AbortSignal,
  options?: { sourceLang?: string; targetLang?: string; imageModel?: string; derivative?: "hd" | "saver" },
): Promise<PatchData[]> {
  const res = await fetch(
    `/api/proxy/books/chapters/${encodeURIComponent(chapterId)}/pages/${pageIndex}/translate-patches`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageUrl,
        sourceLang: options?.sourceLang,
        targetLang: options?.targetLang,
        imageModel: options?.imageModel,
        derivative: options?.derivative,
      }),
      signal,
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Manga page patch translation failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as {
    patches: Array<{ xPct: number; yPct: number; wPct: number; hPct: number; url: string }>;
  };
  return json.patches.map((p) => ({ ...p, url: toRelativeProxyUrl(p.url) }));
}

// ─── Batch / streaming ────────────────────────────────────────────────────────

/**
 * Translate ALL pages of a chapter in a single batch request.
 *
 * The backend fetches all source images in parallel, then submits them to
 * manga-image-translator as one multipart POST.  MIT processes pages in the
 * order received and streams NDJSON results back; the backend forwards them as
 * Server-Sent Events.  `onPageDone` is called once per page as it finishes.
 *
 * @param pages      Array of `{pageIndex, pageUrl}` in desired processing order
 *                   (put the currently-visible page first for best UX).
 * @param onPageDone Called with (pageIndex, patches) each time a page is ready.
 * @param signal     Optional AbortSignal — cancels the streaming connection.
 */
export async function translateMangaChapterBatchPatches(
  chapterId: string,
  pages: Array<{ pageIndex: number; pageUrl: string }>,
  onPageDone: (pageIndex: number, patches: PatchData[], error?: string) => void,
  signal?: AbortSignal,
  options?: { sourceLang?: string; targetLang?: string; imageModel?: string; derivative?: "hd" | "saver" },
  onPageProgress?: (pageIndex: number, stage: string) => void,
): Promise<void> {
  const res = await fetch(
    `/api/proxy/books/chapters/${encodeURIComponent(chapterId)}/batch-translate-patches`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pages,
        sourceLang: options?.sourceLang,
        targetLang: options?.targetLang,
        imageModel: options?.imageModel,
        derivative: options?.derivative,
      }),
      signal,
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Batch translate failed (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.body) throw new Error("No response body from batch-translate endpoint");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // SSE lines: each event is "data: {...}\n\n"
    // Split on double-newline to get individual events
    const events = buf.split("\n\n");
    buf = events.pop() ?? "";

    for (const event of events) {
      const dataLine = event
        .split("\n")
        .find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      const jsonStr = dataLine.slice(6).trim();
      if (!jsonStr) continue;

      try {
        const data = JSON.parse(jsonStr) as {
          type?: string;
          stage?: string;
          pageIndex: number;
          patches: Array<{ xPct: number; yPct: number; wPct: number; hPct: number; url: string }>;
          error?: string | null;
        };

        if (typeof data.pageIndex !== "number" || data.pageIndex < 0) continue;

        // Live MIT stage updates — informational only, never a completed page.
        if (data.type === "progress") {
          if (data.stage) onPageProgress?.(data.pageIndex, data.stage);
          continue;
        }

        if (!Array.isArray(data.patches)) continue;

        if (data.error) {
          console.warn(`[BatchTranslate] page ${data.pageIndex} error: ${data.error}`);
          onPageDone(data.pageIndex, [], data.error);
          continue;
        }

        const patches: PatchData[] = data.patches.map((p) => ({
          ...p,
          url: toRelativeProxyUrl(p.url),
        }));
        onPageDone(data.pageIndex, patches);
      } catch {
        // skip malformed events
      }
    }
  }
}
