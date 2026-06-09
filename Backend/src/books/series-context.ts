/** Series context for context-aware translation (#157).
 *
 *  Pure composer: already-fetched catalog metadata in, translator-facing
 *  context string out. Returns undefined when there is nothing to anchor on
 *  (no title) so the translate path stays byte-identical to the context-free
 *  behavior — the local-first rule. Fetching/caching is the caller's job.
 */

/** Keep the prompt overhead bounded: a runaway catalog synopsis must not eat
 *  the token budget of the text actually being translated. */
const SYNOPSIS_MAX_CHARS = 500;

export function composeSeriesContext(meta?: {
  title?: string | null;
  description?: string | null;
}): string | undefined {
  const title = collapse(meta?.title);
  if (!title) return undefined;

  const synopsis = collapse(meta?.description)?.slice(0, SYNOPSIS_MAX_CHARS);
  return synopsis
    ? `You are translating the manga series "${title}". Synopsis: ${synopsis}`
    : `You are translating the manga series "${title}".`;
}

/** Trim + collapse all internal whitespace runs (catalog descriptions carry
 *  markdown line breaks) to a single space; undefined when nothing remains. */
function collapse(text?: string | null): string | undefined {
  const t = text?.replace(/\s+/g, ' ').trim();
  return t || undefined;
}
