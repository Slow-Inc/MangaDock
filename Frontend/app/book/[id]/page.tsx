import type { Metadata } from "next";
import Home from "../../page";
import BookRouteModal from "../../components/BookRouteModal";
import { SERVER_FETCH_TIMEOUT_MS } from "../../lib/serverFetch";
import { stripMarkdown } from "../../lib/markdownText";
import type { MangaDetail } from "../../lib/types/manga";

const BACKEND = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type Props = { params: Promise<{ id: string }> };

/**
 * The book's name and blurb in the server HTML, so a shared link previews the book rather than the site (#974).
 * Any miss (unknown book, failed or slow fetch, no title) keeps the site's defaults; the page itself is unaffected.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    // Not kept by Next: the backend caches details itself, and an outage answer (200, no title) must not stick (#974)
    const r = await fetch(`${BACKEND}/books/manga/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS),
    });
    if (!r.ok) return {};
    const detail = (await r.json()) as MangaDetail;
    const title = detail.title?.trim();
    if (!title) return {};
    // MangaDex descriptions are markdown: the preview shows the text, not the [link](url) syntax
    const blurb = stripMarkdown(detail.description).replace(/\s+/g, " ").trim().slice(0, 160) || undefined;
    return { title: `${title} · MangaDock`, description: blurb, openGraph: { title, description: blurb } };
  } catch {
    return {};
  }
}

/**
 * Direct visit to /book/<id>: the home page renders behind the book popup. (When the popup
 * is opened from a page in the app, BookDetailModal pushes this same URL itself and this
 * route is never rendered.)
 */
export default async function BookPage({ params }: Props) {
  const { id } = await params;
  return (
    <>
      <Home searchParams={Promise.resolve({})} />
      <BookRouteModal id={id} />
    </>
  );
}
