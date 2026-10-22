import { notFound } from "next/navigation";
import { GENRES } from "../../lib/genres";
import GenrePage from "./GenrePage";

/** Only the genres the app offers; any other slug is the 404 page, not an empty genre named after the slug (#971). */
export default async function Page({ params }: { params: Promise<{ genre: string }> }) {
  const { genre } = await params;
  if (!GENRES.some((g) => g.slug === genre)) notFound();
  return <GenrePage />;
}
