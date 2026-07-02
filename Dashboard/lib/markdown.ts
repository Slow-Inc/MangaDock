/** Minimal markdown tokenizer for LLM chat output. Pure — unit-tested in markdown.test.ts.
 *  Covers the inline syntax the model actually emits: **bold**, `code`, *italic*.
 *  Block-level syntax (headings, bullet/numbered lists) is handled in components/markdown.tsx. */

export type InlineToken = { type: "text" | "bold" | "code" | "italic"; value: string };

const SPLIT = /(\*\*.+?\*\*|`.+?`|\*[^*\s].*?\*)/g;

export function tokenizeInline(text: string): InlineToken[] {
  return text
    .split(SPLIT)
    .filter((p) => p !== "")
    .map((p): InlineToken => {
      if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return { type: "bold", value: p.slice(2, -2) };
      if (p.startsWith("`") && p.endsWith("`") && p.length > 2) return { type: "code", value: p.slice(1, -1) };
      if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return { type: "italic", value: p.slice(1, -1) };
      return { type: "text", value: p };
    });
}
