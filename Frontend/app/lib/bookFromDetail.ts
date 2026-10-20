import type { LandingBook, MangaDetail } from "./types";

/** The popup opened by a direct /book/<id> link has no card to copy the book from, so it
 *  is rebuilt from the detail API. Null when the API knows no title (unknown id). */
export function bookFromDetail(detail: MangaDetail): LandingBook | null {
  const title = detail.title?.trim();
  if (!title) return null;
  const cover = detail.covers[0];
  return {
    id: detail.id,
    title,
    subtitle: "",
    authors: detail.authors,
    description: detail.description ?? "",
    thumbnail: cover?.url ?? "",
    ...(cover?.localUrl ? { thumbnailLocal: cover.localUrl } : {}),
    publishedDate: "",
    categories: detail.genres,
    averageRating: 0,
    ratingsCount: 0,
  };
}
