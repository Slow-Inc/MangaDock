/**
 * Flatten a markdown description to plain text for truncated previews (cards, hero).
 * A preview is cut at a fixed length and sits inside a clickable card, so links are
 * reduced to their label instead of being rendered; the detail modal renders the
 * full markdown (see MarkdownDescription).
 */
export function stripMarkdown(md: string | null | undefined): string {
  if (!md) return "";
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [label](url) -> label
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // headings
    .replace(/^[ \t]*(?:[-*_][ \t]*){3,}$/gm, " ") // horizontal rules
    .replace(/^[ \t]*[-*+][ \t]+/gm, "") // list bullets
    .replace(/^[ \t]*>[ \t]?/gm, "") // blockquotes
    .replace(/\*\*([^*\n]+)\*\*/g, "$1") // **bold**
    .replace(/__([^_\n]+)__/g, "$1") // __bold__
    .replace(/\*([^*\n]+)\*/g, "$1") // *italic*
    .replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, "$1$2") // _italic_ (not snake_case)
    .replace(/~~([^~\n]+)~~/g, "$1") // ~~strike~~
    .replace(/`([^`\n]+)`/g, "$1") // `code`
    .replace(/\s+/g, " ")
    .trim();
}
