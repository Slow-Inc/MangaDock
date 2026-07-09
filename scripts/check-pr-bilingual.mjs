#!/usr/bin/env node
// Bilingual PR-body gate (CLAUDE.md / docs/agents/issue-tracker.md): Issue, PR, and PRD bodies
// must mirror English with a full Thai translation. This checks for a real Thai mirror
// (structure-only — a minimum Thai-script character count), not translation quality or
// depth-parity; a human/agent reviewer still enforces "same depth, not a summary".

const MIN_THAI_CHARS = 30;
const THAI_RANGE = /[฀-๿]/g;

export function countThaiChars(text) {
  if (!text) return 0;
  const matches = text.match(THAI_RANGE);
  return matches ? matches.length : 0;
}

export function checkBilingualPrBody(body, opts = {}) {
  const { title = '', author = '' } = opts;
  if (/\[skip-bilingual\]/i.test(title)) {
    return { ok: true, skipped: true, reason: 'skipped: [skip-bilingual] in title' };
  }
  if (author === 'dependabot[bot]') {
    return { ok: true, skipped: true, reason: 'skipped: automated dependency PR' };
  }
  const thaiChars = countThaiChars(body);
  if (thaiChars < MIN_THAI_CHARS) {
    return {
      ok: false,
      reason: `PR body is missing a Thai mirror (found ${thaiChars} Thai characters, need >= ${MIN_THAI_CHARS}). ` +
        'Add a "## สรุปภาษาไทย" section (or EN/TH paired paragraphs) mirroring the English at the same depth.',
    };
  }
  return { ok: true };
}

// CLI entry point (used by the GitHub Actions workflow): reads PR body/title/author from env.
import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const body = process.env.PR_BODY || '';
  const title = process.env.PR_TITLE || '';
  const author = process.env.PR_AUTHOR || '';
  const result = checkBilingualPrBody(body, { title, author });
  if (!result.ok) {
    console.error(result.reason);
    process.exit(1);
  }
  console.log(result.skipped ? result.reason : 'OK: PR body has a Thai mirror.');
}
