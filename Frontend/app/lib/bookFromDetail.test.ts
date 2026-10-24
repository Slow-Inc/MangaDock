import { describe, expect, test } from "bun:test";
import { bookFromDetail } from "./bookFromDetail";
import type { MangaDetail } from "./types";

const detail: MangaDetail = {
  id: "9c0d4c00-0000-4000-8000-000000000001",
  title: "Lout of Count's Family",
  authors: ["PING"],
  artists: ["PAN4"],
  covers: [
    { volume: "1", url: "https://uploads.mangadex.org/covers/x/1.jpg", localUrl: "/img-cache/x/1.jpg" },
    { volume: "2", url: "https://uploads.mangadex.org/covers/x/2.jpg" },
  ],
  genres: ["Reincarnation", "Action"],
  description: "A man wakes up as the villain.",
};

describe("bookFromDetail (the popup opened by a direct /book/<id> link has no card to copy from)", () => {
  test("maps a manga detail to the book the popup renders", () => {
    expect(bookFromDetail(detail)).toEqual({
      id: detail.id,
      title: "Lout of Count's Family",
      subtitle: "",
      authors: ["PING"],
      description: "A man wakes up as the villain.",
      thumbnail: "https://uploads.mangadex.org/covers/x/1.jpg",
      thumbnailLocal: "/img-cache/x/1.jpg",
      publishedDate: "",
      categories: ["Reincarnation", "Action"],
      averageRating: 0,
      ratingsCount: 0,
    });
  });

  test("tolerates a missing description and no covers", () => {
    const book = bookFromDetail({ ...detail, description: undefined, covers: [] });
    expect(book?.description).toBe("");
    expect(book?.thumbnail).toBe("");
    expect(book?.thumbnailLocal).toBeUndefined();
  });

  test("returns null when the API knows no title (unknown id) so the page can say not found", () => {
    expect(bookFromDetail({ ...detail, title: undefined })).toBeNull();
    expect(bookFromDetail({ ...detail, title: "  " })).toBeNull();
  });
});
