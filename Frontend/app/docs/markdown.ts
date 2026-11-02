// Pure helpers for the docs Markdown reader: language blocks, heading slugs, outline extraction,
// and cutting a document into parts that can be translated. No React, so they unit-test in isolation.

import type { Lang } from './lang-context';

/** Keeps `<!-- lang:th -->` / `<!-- lang:en -->` blocks for `lang`; `<!-- lang:end -->` returns to "all". */
export function filterLangBlocks(raw: string, lang: Lang): string {
  const out: string[] = [];
  let active: Lang | 'all' = 'all';
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (t === '<!-- lang:th -->') { active = 'th'; continue; }
    if (t === '<!-- lang:en -->') { active = 'en'; continue; }
    if (t === '<!-- lang:end -->') { active = 'all'; continue; }
    if (active === 'all' || active === lang) out.push(line);
  }
  return out.join('\n');
}

/** Strips the inline markers the renderer understands, leaving the visible text. */
export function plainInline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

/** Unicode-aware (Thai headings keep their letters), stable, and unique per document: `a`, `a-2`, `a-3`. */
export function makeSlugger() {
  const seen = new Map<string, number>();
  return (text: string): string => {
    const base = plainInline(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'section';
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
}

export interface Heading { id: string; level: 2 | 3; text: string }

/**
 * A document shown in pieces (see DocBody) gets its heading ids from one pass over all the pieces, in order,
 * so a repeated heading is `setup`, `setup-2`... across the whole document and not once per piece.
 * Returns the h2/h3 for the outline, and `ids[i]` = the id of every heading (any level) in piece `i`, in order
 * (what the renderer of that piece is handed). Fenced code is skipped.
 */
export function headingsOfUnits(units: readonly string[]): { headings: Heading[]; ids: string[][] } {
  const slug = makeSlugger();
  const headings: Heading[] = [];
  const ids: string[][] = [];
  let fenced = false;
  for (const unit of units) {
    const mine: string[] = [];
    for (const line of unit.split('\n')) {
      if (line.startsWith('```')) { fenced = !fenced; continue; }
      if (fenced) continue;
      const m = line.match(/^(#{1,4}) (.+)/);
      if (!m) continue;
      const id = slug(m[2]); // every heading consumes a slug, or ids drift from the renderer's
      mine.push(id);
      if (m[1].length === 2 || m[1].length === 3) headings.push({ id, level: m[1].length as 2 | 3, text: plainInline(m[2]) });
    }
    ids.push(mine);
  }
  return { headings, ids };
}

/** h2/h3 of the (already language-filtered) document, in order, skipping fenced code. Ids match the renderer's. */
export function extractHeadings(filtered: string): Heading[] {
  return headingsOfUnits([filtered]).headings;
}

// The Thai block, built from code points so the source holds no invisible characters.
const THAI = new RegExp('[' + String.fromCharCode(0x0e00) + '-' + String.fromCharCode(0x0e7f) + ']', 'g');
const LATIN = /[A-Za-z]/g;

/** Rough reading time. Thai has no spaces, so count characters for it and words for Latin text. */
export function readingMinutes(text: string): number {
  const thai = (text.match(THAI) ?? []).length;
  const words = text.replace(THAI, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220 + thai / 900));
}

// ─── Translating a document ──────────────────────────────────────────────────
// A document is cut into parts the backend can translate one request at a time. Fenced code is lifted
// out first ([[CODE_n]]) and put back after: code is never translated, and it would only cost tokens.

/** Share of the letters in `text` that are Thai (fenced and inline code ignored). 0 when there are no letters. */
export function thaiShare(text: string): number {
  const prose = text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ');
  const thai = (prose.match(THAI) ?? []).length;
  const latin = (prose.match(LATIN) ?? []).length;
  return thai + latin === 0 ? 0 : thai / (thai + latin);
}

/**
 * Must this document be translated to be read in `target`? Documents with `<!-- lang -->` blocks already
 * carry both languages. Mixed ones sit around 0.3: each part is judged again on its own.
 */
export function needsTranslation(content: string, target: Lang): boolean {
  if (content.includes('<!-- lang:th -->') && content.includes('<!-- lang:en -->')) return false;
  const share = thaiShare(content);
  return target === 'th' ? share < 0.3 : share >= 0.3;
}

export interface DocPart {
  /** The part as written (code included): what is shown until its translation arrives. */
  original: string;
  /** What is sent to be translated: the original with fenced code replaced by [[CODE_n]]. */
  text: string;
  /** Puts the code back into a translation of `text`; null when a marker went missing or was repeated. */
  restore: (translated: string) => string | null;
}

// The backend takes the text in a GET query string, and Thai costs 9 bytes per character once encoded:
// bound each part by characters (the provider) and by encoded length (the URL).
const MAX_CHARS = 2000;
const MAX_ENCODED = 7000;
const HARD_SPLIT_AT = 1500;

/** Blocks separated by blank lines; a fenced block is one block however many blank lines it holds. */
function blocksOf(content: string): string[] {
  const blocks: string[] = [];
  let cur: string[] = [];
  let fenced = false;
  const flush = () => { if (cur.length) { blocks.push(cur.join('\n')); cur = []; } };
  for (const line of content.split('\n')) {
    if (line.startsWith('```')) {
      if (!fenced) flush();
      fenced = !fenced;
      cur.push(line);
      if (!fenced) flush();
      continue;
    }
    if (!fenced && line.trim() === '') { flush(); continue; }
    cur.push(line);
  }
  flush();
  return blocks;
}

const isFence = (b: string) => b.startsWith('```');

/** A prose block that alone exceeds a limit is cut at line boundaries (a fence counts as one marker). */
function hardSplit(block: string): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let len = 0;
  for (const line of block.split('\n')) {
    if (cur.length && len + line.length > HARD_SPLIT_AT) { out.push(cur.join('\n')); cur = []; len = 0; }
    cur.push(line);
    len += line.length + 1;
  }
  if (cur.length) out.push(cur.join('\n'));
  return out;
}

export function splitParts(content: string): DocPart[] {
  const groups: string[][] = [];
  let cur: string[] = [];
  let chars = 0;
  let enc = 0;
  const flush = () => { if (cur.length) { groups.push(cur); cur = []; chars = 0; enc = 0; } };
  for (const block of blocksOf(content)) {
    const tooBig = !isFence(block) && (block.length > MAX_CHARS || encodeURIComponent(block).length > MAX_ENCODED);
    for (const piece of tooBig ? hardSplit(block) : [block]) {
      const w = isFence(piece) ? 12 : piece.length; // what is actually sent for it
      const e = isFence(piece) ? 24 : encodeURIComponent(piece).length;
      const startsSection = /^#{1,2} /.test(piece);
      if (cur.length && (chars + w > MAX_CHARS || enc + e > MAX_ENCODED || (startsSection && chars > MAX_CHARS / 2))) flush();
      cur.push(piece);
      chars += w + 2;
      enc += e + 6;
    }
  }
  flush();

  return groups.map(blocks => {
    const codes: string[] = [];
    const text = blocks.map(b => (isFence(b) ? `[[CODE_${codes.push(b) - 1}]]` : b)).join('\n\n');
    return {
      original: blocks.join('\n\n'),
      text,
      restore: (translated: string) => {
        let ok = true;
        const back = translated.replace(/\[\[CODE_(\d+)\]\]/g, (_m, n: string) => codes[Number(n)] ?? ((ok = false), ''));
        // Every marker exactly once: a dropped or duplicated one means the model mangled the part.
        const seen = (translated.match(/\[\[CODE_\d+\]\]/g) ?? []).length;
        return ok && seen === codes.length ? back : null;
      },
    };
  });
}

/** Does this part have anything to translate into `to`? (A part of only code markers, or prose already in `to`, does not.) */
export function partNeedsTranslation(part: DocPart, to: Lang): boolean {
  const prose = part.text.replace(/\[\[CODE_\d+\]\]/g, ' ');
  if (!/\p{L}/u.test(prose)) return false;
  const share = thaiShare(prose);
  return to === 'th' ? share < 0.25 : share >= 0.02;
}
