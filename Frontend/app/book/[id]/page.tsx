import Home from "../../page";
import BookRouteModal from "../../components/BookRouteModal";

/**
 * Direct visit to /book/<id>: the home page renders behind the book popup. (When the popup
 * is opened from a page in the app, BookDetailModal pushes this same URL itself and this
 * route is never rendered.)
 */
export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <Home searchParams={Promise.resolve({})} />
      <BookRouteModal id={id} />
    </>
  );
}
