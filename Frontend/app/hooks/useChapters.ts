"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/apiFetch";

const API_BASE = "/api/proxy";

export type ChapterPageItem = {
  id: string;
  chapterNumber: string | null;
  title: string | null;
  translatedLanguage: string;
};

/** Entry from GET /versions/title/:mangaId (user-uploaded chapter versions). */
type UserVersionItem = {
  versionId: string;
  chapterNumber?: string | null;
  chapterTitle?: string | null;
  language?: string | null;
  backendAvailable?: boolean;
};

/**
 * The navigable chapter list for a manga (#302): MangaDex chapters + the user's
 * uploaded versions, merged and sorted by chapter number. Extracted verbatim
 * from MangaReader's inline effect so the fetch is isolated from the reader's
 * viewport/zoom/translation concerns. Returns the list (empty until loaded) and
 * re-fetches when `mangaId` changes.
 */
export function useChapters(mangaId?: string): ChapterPageItem[] {
  const [chapterList, setChapterList] = useState<ChapterPageItem[]>([]);

  useEffect(() => {
    if (!mangaId) return;
    // Fetch MangaDex chapters + user-uploaded versions and merge
    Promise.all([
      apiFetch(`${API_BASE}/books/manga/${mangaId}/chapters`).then((r) => r.json()).catch(() => []),
      apiFetch(`${API_BASE}/versions/title/${mangaId}`).then((r) => r.ok ? r.json() : []).catch(() => []),
    ]).then(([mangaDexChapters, userVersions]: [ChapterPageItem[], UserVersionItem[]]) => {
      const mdxList = Array.isArray(mangaDexChapters) ? mangaDexChapters : [];
      const userList: ChapterPageItem[] = (userVersions ?? [])
        .filter((v) => v?.backendAvailable !== false)
        .map((v) => ({
          id: `ver:${v.versionId}`,
          chapterNumber: v.chapterNumber || null,
          title: v.chapterTitle || null,
          translatedLanguage: v.language || "th",
        }));
      const merged = [...mdxList, ...userList].sort((a, b) => {
        const numA = parseFloat(a.chapterNumber ?? "0") || 0;
        const numB = parseFloat(b.chapterNumber ?? "0") || 0;
        return numA - numB;
      });
      setChapterList(merged);
    });
  }, [mangaId]);

  return chapterList;
}
