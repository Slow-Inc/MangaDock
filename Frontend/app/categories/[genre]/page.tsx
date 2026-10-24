import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GENRES } from "../../lib/genres";
import GenrePage from "./GenrePage";

type Props = { params: Promise<{ genre: string }> };

/** Only the genres the app offers; any other slug is the 404 page, not an empty genre named after the slug (#971). */
async function genreOf({ params }: Props) {
  const { genre } = await params;
  return GENRES.find((g) => g.slug === genre) ?? notFound();
}

// The genre's name is in the server HTML (link previews, the tab before hydration), not only set by the client
export async function generateMetadata(props: Props): Promise<Metadata> {
  return { title: `${(await genreOf(props)).label} · MangaDock` };
}

export default async function Page(props: Props) {
  const { slug, label } = await genreOf(props);
  return <GenrePage slug={slug} label={label} />;
}
