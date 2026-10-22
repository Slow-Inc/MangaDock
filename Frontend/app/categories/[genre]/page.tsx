import { GENRES } from "../../lib/genres";
import GenrePage from "./GenrePage";

// Only the genres the app offers; any other slug is the 404 page with a 404 status, not an empty genre (#971)
export const dynamicParams = false;

export function generateStaticParams() {
  return GENRES.map((g) => ({ genre: g.slug }));
}

export default GenrePage;
